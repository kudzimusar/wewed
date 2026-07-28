import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-gate'
import { db } from '@/lib/db'
import {
  getFlagshipWeddingId,
  isRevisionStatus,
  mapsToWeddingField,
  syncWeddingField,
} from '@/lib/content/wedding-fields'

/* ============================================================
   /api/content
   ------------------------------------------------------------
   GET    → list content revisions for a section
            (query: ?section=our-story&weddingId=...&fieldKey=...
                     &status=published&limit=50)

   POST   → create a new ContentRevision
            body: { section, fieldKey, value, status?, weddingId? }

            On status="published":
              • publishedAt is set
              • The previously-published revision of the same
                section+fieldKey is marked "archived"
              • If the (section, fieldKey) maps to a Wedding
                column, the Wedding row is also updated so the
                public site (which reads the Wedding model)
                sees the change immediately.

            previousValue is stored from the most recent
            published revision so the restore endpoint can
            re-create an older version without a DB lookup.

   Admin-gated. Revisions are immutable history; PATCH/DELETE
   live on /api/content/[id].
   ============================================================ */

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 50
const MAX_VALUE_BYTES = 256 * 1024 // 256 KB per revision value

type FormattedRevision = {
  id: string
  section: string
  fieldKey: string
  value: string
  status: string
  previousValue: string | null
  weddingId: string
  authorId: string | null
  publishedAt: string | null
  scheduledFor: string | null
  createdAt: string
  updatedAt: string
}

function formatRevision(r: {
  id: string
  section: string
  fieldKey: string
  value: string
  status: string
  previousValue: string | null
  weddingId: string
  authorId: string | null
  publishedAt: Date | null
  scheduledFor: Date | null
  createdAt: Date
  updatedAt: Date
}): FormattedRevision {
  return {
    id: r.id,
    section: r.section,
    fieldKey: r.fieldKey,
    value: r.value,
    status: r.status,
    previousValue: r.previousValue,
    weddingId: r.weddingId,
    authorId: r.authorId,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    scheduledFor: r.scheduledFor ? r.scheduledFor.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

// ─── GET /api/content ────────────────────────────────────────
export async function GET(request: NextRequest) {
  const gateFail = requireAdmin(request)
  if (gateFail) return gateFail

  try {
    const url = new URL(request.url)
    const section = url.searchParams.get('section')?.trim() || undefined
    const fieldKey = url.searchParams.get('fieldKey')?.trim() || undefined
    const status = url.searchParams.get('status')?.trim() || undefined
    const weddingIdParam = url.searchParams.get('weddingId')?.trim() || undefined

    // Resolve wedding id (query overrides flagship default)
    const weddingId = weddingIdParam ?? (await getFlagshipWeddingId())
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'Flagship wedding not found. Seed the database first.' },
        { status: 404 },
      )
    }

    // Parse limit
    const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(MAX_LIMIT, limitRaw) : DEFAULT_LIMIT

    const where: {
      weddingId: string
      section?: string
      fieldKey?: string
      status?: string
    } = { weddingId }
    if (section) where.section = section
    if (fieldKey) where.fieldKey = fieldKey
    if (status) where.status = status

    const revisions = await db.contentRevision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      success: true,
      count: revisions.length,
      data: revisions.map(formatRevision),
    })
  } catch (err) {
    console.error('[CONTENT GET] error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch content revisions' },
      { status: 500 },
    )
  }
}

// ─── POST /api/content ───────────────────────────────────────
interface CreateRevisionBody {
  section?: unknown
  fieldKey?: unknown
  value?: unknown
  status?: unknown
  weddingId?: unknown
}

export async function POST(request: NextRequest) {
  const gateFail = requireAdmin(request)
  if (gateFail) return gateFail

  try {
    let body: CreateRevisionBody
    try {
      body = (await request.json()) as CreateRevisionBody
    } catch {
      return NextResponse.json(
        { success: false, error: 'Expected JSON body with section, fieldKey, value.' },
        { status: 400 },
      )
    }

    const section = typeof body.section === 'string' ? body.section.trim() : ''
    const fieldKey = typeof body.fieldKey === 'string' ? body.fieldKey.trim() : ''
    const value = typeof body.value === 'string' ? body.value : ''
    const statusRaw = typeof body.status === 'string' ? body.status.trim() : 'draft'

    if (!section) {
      return NextResponse.json({ success: false, error: 'section is required' }, { status: 400 })
    }
    if (!fieldKey) {
      return NextResponse.json({ success: false, error: 'fieldKey is required' }, { status: 400 })
    }
    if (value.length === 0) {
      return NextResponse.json({ success: false, error: 'value cannot be empty' }, { status: 400 })
    }
    // Limit section/fieldKey to a reasonable length
    if (section.length > 80 || fieldKey.length > 80) {
      return NextResponse.json(
        { success: false, error: 'section/fieldKey too long (max 80 chars each)' },
        { status: 400 },
      )
    }
    if (Buffer.byteLength(value, 'utf8') > MAX_VALUE_BYTES) {
      return NextResponse.json(
        { success: false, error: `value too large (max ${MAX_VALUE_BYTES / 1024} KB)` },
        { status: 413 },
      )
    }

    if (!isRevisionStatus(statusRaw)) {
      return NextResponse.json(
        { success: false, error: `Invalid status "${statusRaw}". Valid: draft, pending, approved, scheduled, published, hidden, rejected, archived` },
        { status: 400 },
      )
    }
    const status = statusRaw

    // Resolve wedding
    const weddingId =
      typeof body.weddingId === 'string' && body.weddingId.trim()
        ? body.weddingId.trim()
        : await getFlagshipWeddingId()
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'Flagship wedding not found. Seed the database first.' },
        { status: 404 },
      )
    }

    // Capture previousValue = the most recent published revision's value
    // (or the most recent non-draft revision if none published).
    const previous = await db.contentRevision.findFirst({
      where: { weddingId, section, fieldKey, status: 'published' },
      orderBy: { createdAt: 'desc' },
      select: { value: true },
    })
    const previousValue = previous?.value ?? null

    // Create the new revision. If publishing, set publishedAt too.
    const now = new Date()
    const revision = await db.contentRevision.create({
      data: {
        section,
        fieldKey,
        value,
        status,
        previousValue,
        weddingId,
        publishedAt: status === 'published' ? now : null,
      },
    })

    // If publishing, archive previously-published revisions of the
    // same section+fieldKey (excluding the one we just created),
    // and sync the Wedding row if applicable.
    if (status === 'published') {
      try {
        await db.contentRevision.updateMany({
          where: {
            weddingId,
            section,
            fieldKey,
            status: 'published',
            id: { not: revision.id },
          },
          data: { status: 'archived' },
        })
      } catch (err) {
        console.warn('[CONTENT POST] could not archive previous published revisions:', err)
      }

      if (mapsToWeddingField(section, fieldKey)) {
        try {
          await syncWeddingField(weddingId, section, fieldKey, value)
        } catch (err) {
          console.warn('[CONTENT POST] could not sync Wedding field:', err)
        }
      }
    }

    return NextResponse.json(
      { success: true, data: formatRevision(revision) },
      { status: 201 },
    )
  } catch (err) {
    console.error('[CONTENT POST] error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to create revision' },
      { status: 500 },
    )
  }
}
