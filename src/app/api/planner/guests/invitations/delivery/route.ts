import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import type { InvitationDeliveryChannel } from '@/lib/planner-invitation-projection'

const CHANNELS = new Set<InvitationDeliveryChannel>(['whatsapp', 'email', 'sms', 'other'])
const MAX_BATCH = 500

function cleanGuestIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
}

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
    const guestIds = cleanGuestIds(body?.guestIds)
    const channel = typeof body?.channel === 'string' && CHANNELS.has(body.channel as InvitationDeliveryChannel)
      ? body.channel as InvitationDeliveryChannel
      : null

    if (guestIds.length === 0 || guestIds.length > MAX_BATCH) {
      return noStore(NextResponse.json(
        { success: false, error: `Select between 1 and ${MAX_BATCH} guests.` },
        { status: 400 },
      ))
    }
    if (!channel) {
      return noStore(NextResponse.json(
        { success: false, error: 'Choose how the invitation was sent.' },
        { status: 400 },
      ))
    }

    const guests = await db.guest.findMany({
      where: { weddingId: access.context.weddingId, id: { in: guestIds } },
      select: { id: true },
    })
    if (guests.length !== guestIds.length) {
      return noStore(NextResponse.json(
        { success: false, error: 'One or more selected guests are not part of the active wedding.' },
        { status: 400 },
      ))
    }

    const sentAt = new Date()
    await db.auditEvent.createMany({
      data: guestIds.map((guestId) => ({
        action: 'guest.invitation_delivery_marked',
        resourceType: 'guest_invitation',
        resourceId: guestId,
        afterValue: JSON.stringify({ channel, sentAt: sentAt.toISOString() }),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      })),
    })

    return noStore(NextResponse.json({
      success: true,
      count: guestIds.length,
      channel,
      sentAt: sentAt.toISOString(),
    }))
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
    const guestIds = cleanGuestIds(body?.guestIds)
    if (guestIds.length === 0 || guestIds.length > MAX_BATCH) {
      return noStore(NextResponse.json(
        { success: false, error: `Select between 1 and ${MAX_BATCH} guests.` },
        { status: 400 },
      ))
    }

    const guests = await db.guest.findMany({
      where: { weddingId: access.context.weddingId, id: { in: guestIds } },
      select: { id: true },
    })
    if (guests.length !== guestIds.length) {
      return noStore(NextResponse.json(
        { success: false, error: 'One or more selected guests are not part of the active wedding.' },
        { status: 400 },
      ))
    }

    await db.auditEvent.createMany({
      data: guestIds.map((guestId) => ({
        action: 'guest.invitation_delivery_unmarked',
        resourceType: 'guest_invitation',
        resourceId: guestId,
        afterValue: JSON.stringify({ clearedAt: new Date().toISOString() }),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      })),
    })

    return noStore(NextResponse.json({ success: true, count: guestIds.length }))
  } catch (error) {
    console.error('[guest invitation delivery DELETE] Error:', error)
    return noStore(NextResponse.json(
      { success: false, error: 'Unable to reset invitation delivery.' },
      { status: 500 },
    ))
  }
}
