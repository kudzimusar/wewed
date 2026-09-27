import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { applyRevisionPublication, retractRevisionPublication } from '@/lib/wedding-site/server'
import { db } from '@/lib/db'
import { isRevisionStatus } from '@/lib/content/wedding-fields'

/* ============================================================
   /api/content/[id]
   ------------------------------------------------------------
   GET     → fetch a single revision
   PATCH   → update a revision's status (and optionally value)
             body: { status?, value? }

             On status="published":
               • publishedAt is set
               • Previously-published revisions of the same
                 section+fieldKey are archived
               • If the field maps to a Wedding column, the
                 Wedding row is updated.

   DELETE  → delete a revision (admin-gated). Cannot delete the
             only published revision — return 409 in that case so
             the UI can prompt the user to publish another first.
   ============================================================ */

type RouteContext = { params: Promise<{ id: string }> }

const MAX_VALUE_BYTES = 256 * 1024

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

// ─── GET /api/content/[id] ───────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  // QRO07: wedding-scoped content.edit — never merely "some session exists".
  const access = await requireWeddingPermission(request, 'content.edit')
  if (access.error) return access.error

  try {
    const { id } = await context.params
    const revision = await db.contentRevision.findFirst({ where: { id, weddingId: access.context.weddingId } })
    if (!revision) {
      return NextResponse.json({ success: false, error: 'Revision not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: formatRevision(revision) })
  } catch (err) {
    console.error('[CONTENT GET id] error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to fetch revision' },
      { status: 500 },
    )
  }
}

// ─── PATCH /api/content/[id] ─────────────────────────────────
interface PatchBody {
  status?: unknown
  value?: unknown
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  // QRO07: wedding-scoped content.edit — never merely "some session exists".
  const access = await requireWeddingPermission(request, 'content.edit')
  if (access.error) return access.error

  try {
    const { id } = await context.params
    const revision = await db.contentRevision.findFirst({ where: { id, weddingId: access.context.weddingId } })
    if (!revision) {
      return NextResponse.json({ success: false, error: 'Revision not found' }, { status: 404 })
    }

    let body: PatchBody
    try {
      body = (await request.json()) as PatchBody
    } catch {
      return NextResponse.json({ success: false, error: 'Expected JSON body' }, { status: 400 })
    }

    const data: { status?: string; value?: string; publishedAt?: Date | null } = {}

    if (typeof body.status === 'string') {
      const status = body.status.trim()
      if (!isRevisionStatus(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status "${status}". Valid: draft, pending, approved, scheduled, published, hidden, rejected, archived`,
          },
          { status: 400 },
        )
      }
      data.status = status
      if (status === 'published') {
        data.publishedAt = new Date()
      } else if (revision.status === 'published') {
        // Un-publishing: clear the publishedAt timestamp
        data.publishedAt = null
      }
    }

    if (typeof body.value === 'string') {
      if (body.value.length === 0) {
        return NextResponse.json({ success: false, error: 'value cannot be empty' }, { status: 400 })
      }
      if (Buffer.byteLength(body.value, 'utf8') > MAX_VALUE_BYTES) {
        return NextResponse.json(
          { success: false, error: `value too large (max ${MAX_VALUE_BYTES / 1024} KB)` },
          { status: 413 },
        )
      }
      data.value = body.value
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nothing to update — provide status and/or value' },
        { status: 400 },
      )
    }

    // Publishing/unpublishing and its effects happen in ONE transaction, so the public site, the
    // Wedding row and the revision history never disagree.
    const updated = await db.$transaction(async (tx) => {
      const next = await tx.contentRevision.update({ where: { id: revision.id }, data })
      if (data.status === 'published') await applyRevisionPublication(tx, next)
      else if (data.status && revision.status === 'published') await retractRevisionPublication(tx, next)
      return next
    })

    return NextResponse.json({ success: true, data: formatRevision(updated) })
  } catch (err) {
    console.error('[CONTENT PATCH id] error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to update revision' },
      { status: 500 },
    )
  }
}

// ─── DELETE /api/content/[id] ────────────────────────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  // QRO07: wedding-scoped content.edit — never merely "some session exists".
  const access = await requireWeddingPermission(request, 'content.edit')
  if (access.error) return access.error

  try {
    const { id } = await context.params
    const revision = await db.contentRevision.findFirst({ where: { id, weddingId: access.context.weddingId } })
    if (!revision) {
      return NextResponse.json({ success: false, error: 'Revision not found' }, { status: 404 })
    }

    // Don't allow deleting the only published revision
    if (revision.status === 'published') {
      const otherPublished = await db.contentRevision.findFirst({
        where: {
          weddingId: revision.weddingId,
          section: revision.section,
          fieldKey: revision.fieldKey,
          status: 'published',
          id: { not: revision.id },
        },
        select: { id: true },
      })
      if (!otherPublished) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Cannot delete the only published revision. Publish another version first or archive this one.',
          },
          { status: 409 },
        )
      }
    }

    await db.contentRevision.delete({ where: { id } })
    return NextResponse.json({ success: true, deleted: id })
  } catch (err) {
    console.error('[CONTENT DELETE id] error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to delete revision' },
      { status: 500 },
    )
  }
}
