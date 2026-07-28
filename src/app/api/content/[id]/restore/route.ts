import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-gate'
import { db } from '@/lib/db'
import {
  isRevisionStatus,
  mapsToWeddingField,
  syncWeddingField,
} from '@/lib/content/wedding-fields'

/* ============================================================
   /api/content/[id]/restore
   ------------------------------------------------------------
   POST → create a NEW revision whose value is taken from the
          revision identified by [id]. This is non-destructive:
          the original revision is left intact, and a fresh row
          is appended to the history.

          Body (optional):
            { status?: 'draft' | 'published' }

          Default status is 'draft' so the couple can review the
          restored value before going live. If status='published'
          is requested, the same publish side-effects as
          POST /api/content apply (archive others, sync Wedding).

          Returns the new revision.
   ============================================================ */

type RouteContext = { params: Promise<{ id: string }> }

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
}) {
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

export async function POST(request: NextRequest, context: RouteContext) {
  const gateFail = requireAdmin(request)
  if (gateFail) return gateFail

  try {
    const { id } = await context.params
    const source = await db.contentRevision.findUnique({ where: { id } })
    if (!source) {
      return NextResponse.json({ success: false, error: 'Revision not found' }, { status: 404 })
    }

    // Optional body: choose the new status
    let requestedStatus: string = 'draft'
    try {
      const body = (await request.json()) as { status?: unknown }
      if (typeof body.status === 'string') {
        requestedStatus = body.status.trim()
      }
    } catch {
      /* no body or not JSON — that's fine, default to draft */
    }

    if (!isRevisionStatus(requestedStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status "${requestedStatus}". Valid: draft, pending, approved, scheduled, published, hidden, rejected, archived`,
        },
        { status: 400 },
      )
    }
    const status = requestedStatus

    // Capture the current published value as previousValue
    const previous = await db.contentRevision.findFirst({
      where: {
        weddingId: source.weddingId,
        section: source.section,
        fieldKey: source.fieldKey,
        status: 'published',
      },
      orderBy: { createdAt: 'desc' },
      select: { value: true },
    })

    const now = new Date()
    const restored = await db.contentRevision.create({
      data: {
        section: source.section,
        fieldKey: source.fieldKey,
        value: source.value,
        status,
        previousValue: previous?.value ?? null,
        weddingId: source.weddingId,
        publishedAt: status === 'published' ? now : null,
      },
    })

    if (status === 'published') {
      try {
        await db.contentRevision.updateMany({
          where: {
            weddingId: restored.weddingId,
            section: restored.section,
            fieldKey: restored.fieldKey,
            status: 'published',
            id: { not: restored.id },
          },
          data: { status: 'archived' },
        })
      } catch (err) {
        console.warn('[CONTENT RESTORE] could not archive previous published revisions:', err)
      }

      if (mapsToWeddingField(restored.section, restored.fieldKey)) {
        try {
          await syncWeddingField(restored.weddingId, restored.section, restored.fieldKey, restored.value)
        } catch (err) {
          console.warn('[CONTENT RESTORE] could not sync Wedding field:', err)
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: formatRevision(restored),
        message: `Restored revision from ${new Date(source.createdAt).toISOString()}`,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[CONTENT RESTORE] error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to restore revision' },
      { status: 500 },
    )
  }
}
