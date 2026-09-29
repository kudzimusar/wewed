import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

const DELIVERY_CHANNELS = new Set(['whatsapp', 'email', 'sms', 'other', 'in_person'])

type DeliveryAction = 'mark_sent' | 'reset'

function guestIdsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(
    value.flatMap((item) => typeof item === 'string' && item.trim() ? [item.trim()] : []),
  )).slice(0, 250)
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return access.error

  try {
    const body = await request.json() as Record<string, unknown>
    const action = body.action === 'reset' ? 'reset' : body.action === 'mark_sent' ? 'mark_sent' : null
    const guestIds = guestIdsFrom(body.guestIds)

    if (!action) {
      return NextResponse.json({ success: false, error: 'Choose a valid invitation tracking action.' }, { status: 400 })
    }
    if (guestIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Choose at least one guest.' }, { status: 400 })
    }

    const channel = typeof body.channel === 'string' ? body.channel.trim().toLowerCase() : ''
    if (action === 'mark_sent' && !DELIVERY_CHANNELS.has(channel)) {
      return NextResponse.json({ success: false, error: 'Choose how the invitation was sent.' }, { status: 400 })
    }

    const guests = await db.guest.findMany({
      where: {
        weddingId: access.context.weddingId,
        id: { in: guestIds },
      },
      select: { id: true },
    })
    if (guests.length !== guestIds.length) {
      return NextResponse.json({ success: false, error: 'One or more guests are not in the active wedding.' }, { status: 404 })
    }

    const eventAction = action === 'mark_sent'
      ? 'guest.invitation_marked_sent'
      : 'guest.invitation_delivery_reset'

    await db.auditEvent.createMany({
      data: guests.map((guest) => ({
        action: eventAction,
        resourceType: 'Guest',
        resourceId: guest.id,
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        afterValue: action === 'mark_sent' ? JSON.stringify({ channel }) : null,
      })),
    })

    return NextResponse.json({
      success: true,
      data: {
        action,
        count: guests.length,
        channel: action === 'mark_sent' ? channel : null,
      },
    })
  } catch (error) {
    console.error('[PLANNER INVITATION DELIVERY] error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to update invitation delivery tracking.' },
      { status: 500 },
    )
  }
}
