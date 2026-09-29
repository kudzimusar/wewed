import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { recordInvitationDelivery, resetInvitationDelivery } from '@/lib/planner-invitation-operations'

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return noStore(access.error)

  try {
    const body = (await request.json().catch(() => null)) as {
      guestIds?: unknown
      channel?: unknown
    } | null
    const result = await recordInvitationDelivery(
      { weddingId: access.context.weddingId, actorId: access.context.session.userId },
      { guestIds: body?.guestIds, channel: body?.channel },
    )
    if (!result.ok) {
      return noStore(NextResponse.json({ success: false, error: result.error }, { status: result.status }))
    }
    return noStore(NextResponse.json({ success: true, ...result.data }))
  } catch (error) {
    console.error('[guest invitation delivery POST] Error:', error)
    return noStore(NextResponse.json(
      { success: false, error: 'Unable to record invitation delivery.' },
      { status: 500 },
    ))
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return noStore(access.error)

  try {
    const body = (await request.json().catch(() => null)) as { guestIds?: unknown } | null
    const result = await resetInvitationDelivery(
      { weddingId: access.context.weddingId, actorId: access.context.session.userId },
      { guestIds: body?.guestIds },
    )
    if (!result.ok) {
      return noStore(NextResponse.json({ success: false, error: result.error }, { status: result.status }))
    }
    return noStore(NextResponse.json({ success: true, ...result.data }))
  } catch (error) {
    console.error('[guest invitation delivery DELETE] Error:', error)
    return noStore(NextResponse.json(
      { success: false, error: 'Unable to reset invitation delivery.' },
      { status: 500 },
    ))
  }
}
