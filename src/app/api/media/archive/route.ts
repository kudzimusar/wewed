import { NextRequest, NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import {
  getWeddingArchiveSummary,
  Phase5MediaError,
  transitionWeddingArchive,
  type WeddingArchiveState,
} from '@/lib/media/phase5'
import { requireWeddingPermission } from '@/lib/wedding-access'

const STATES = new Set<WeddingArchiveState>(['ACTIVE_PLANNING', 'LIVE_EVENT', 'POST_WEDDING', 'ARCHIVED'])

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof Phase5MediaError) {
    return noStore(NextResponse.json({ success: false, error: error.message, field: error.field }, { status: error.status }))
  }
  console.error('[MEDIA ARCHIVE] error:', error)
  return noStore(NextResponse.json({ success: false, error: 'Wewed could not load or update the wedding archive.' }, { status: 500 }))
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return noStore(access.error)
  try {
    const data = await getWeddingArchiveSummary(access.context.weddingId)
    return noStore(NextResponse.json({ success: true, data }))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return noStore(access.error)
  try {
    const body = await request.json().catch(() => ({}))
    const targetState = String(body?.targetState || '') as WeddingArchiveState
    if (!STATES.has(targetState)) {
      return noStore(NextResponse.json({ success: false, error: 'A valid target archive state is required.' }, { status: 400 }))
    }
    const data = await transitionWeddingArchive({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      targetState,
    })
    await logAuditEvent({
      action: 'wedding_media.archive_lifecycle_transition',
      resourceType: 'Wedding',
      resourceId: access.context.weddingId,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      afterValue: { targetState },
    })
    return noStore(NextResponse.json({ success: true, data }))
  } catch (error) {
    return errorResponse(error)
  }
}
