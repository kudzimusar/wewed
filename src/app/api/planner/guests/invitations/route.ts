import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  invitationWeddingSelect,
  loadPlannerInvitationProjection,
  normalizeChildrenPolicy,
  type ChildrenPolicy,
} from '@/lib/planner-invitation-projection'

function csvCell(value: string | null | undefined) {
  return `"${(value ?? '').replaceAll('"', '""')}"`
}

function privateNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function privateJson(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return privateNoStore(NextResponse.json(body, { status }))
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return privateNoStore(access.error)

  try {
    // Shared canonical projection (QRO05-PIQR01): the native route reads the same function.
    const projection = await loadPlannerInvitationProjection(
      access.context.weddingId,
      request.nextUrl.origin,
    )
    if (!projection) {
      return privateJson({ success: false, error: 'Wedding not found.' }, 404)
    }
    const { data } = projection
    const style = projection.wedding.invitationCardStyle

    if (request.nextUrl.searchParams.get('format') === 'csv') {
      const csv = [
        'Name,Email,Phone,RSVP Status,Delivery Status,Last Sent At,Last Sent Via,Last Sent Recipient,Checked In,Table,Card Style,Digital Invitation URL,Share Message',
        ...data.map((row) =>
          [
            csvCell(row.name),
            csvCell(row.email),
            csvCell(row.phone),
            csvCell(row.status),
            csvCell(row.lastSentAt ? 'sent' : 'not_sent'),
            csvCell(row.lastSentAt),
            csvCell(row.lastSentVia),
            csvCell(row.lastSentRecipient),
            csvCell(row.checkedIn ? 'yes' : 'no'),
            csvCell(row.tableNumber?.toString()),
            csvCell(style),
            csvCell(row.invitationUrl),
            csvCell(row.shareMessage),
          ].join(','),
        ),
      ].join('\n')
      return privateNoStore(
        new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="wewed-digital-invitations-${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        }),
      )
    }

    return privateJson({ success: true, ...projection })
  } catch (error) {
    console.error('[guest invitations GET] Error:', error)
    return privateJson({ success: false, error: 'Unable to load invitation links.' }, 500)
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return privateNoStore(access.error)

  try {
    const body = (await request.json().catch(() => null)) as {
      action?: unknown
      guestIds?: unknown
      channel?: unknown
      note?: unknown
    } | null

    if (body?.action === 'mark_sent') {
      const guestIds = Array.isArray(body.guestIds)
        ? [...new Set(body.guestIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
        : []
      if (guestIds.length === 0 || guestIds.length > 500) {
        return privateJson({ success: false, error: 'Select between 1 and 500 guests.' }, 400)
      }

      const allowedChannels = new Set(['whatsapp', 'email', 'sms', 'copy_link', 'share_sheet', 'other'])
      const channel = typeof body.channel === 'string' ? body.channel.trim().toLowerCase() : ''
      if (!allowedChannels.has(channel)) {
        return privateJson({ success: false, error: 'Choose how the invitation was sent.' }, 400)
      }

      const note = typeof body.note === 'string'
        ? body.note.replace(/\u0000/g, '').trim().slice(0, 500) || null
        : null
      const guests = await db.guest.findMany({
        where: { weddingId: access.context.weddingId, id: { in: guestIds } },
        select: { id: true, email: true, phone: true },
      })
      if (guests.length !== guestIds.length) {
        return privateJson({ success: false, error: 'One or more selected guests are no longer in this wedding.' }, 409)
      }

      const recipientFor = (guest: (typeof guests)[number]) => {
        if (channel === 'email') return guest.email
        if (channel === 'whatsapp' || channel === 'sms') return guest.phone
        return guest.email ?? guest.phone
      }
      const sentAt = new Date()
      await db.$transaction(async (tx) => {
        await tx.guestInvitationDelivery.createMany({
          data: guests.map((guest) => ({
            weddingId: access.context.weddingId,
            guestId: guest.id,
            actorId: access.context.session.userId,
            channel,
            recipient: recipientFor(guest),
            note,
            sentAt,
          })),
        })
        await tx.auditEvent.create({
          data: {
            action: 'guest.invitation_marked_sent',
            resourceType: 'guest_batch',
            resourceId: guestIds.join(','),
            afterValue: JSON.stringify({
              count: guests.length,
              channel,
              sentAt: sentAt.toISOString(),
            }),
            weddingId: access.context.weddingId,
            actorId: access.context.session.userId,
          },
        })
      })
      return privateJson({
        success: true,
        marked: guests.length,
        sentAt: sentAt.toISOString(),
        channel,
      })
    }

    // Existing explicit credential repair. A plain POST (or action=repair_links)
    // preserves the historical API contract while remaining an operator-triggered write.
    if (body?.action !== undefined && body.action !== 'repair_links') {
      return privateJson({ success: false, error: 'Unsupported invitation action.' }, 400)
    }

    const guests = await db.guest.findMany({
      where: { weddingId: access.context.weddingId, rsvp: null },
      select: { id: true },
    })
    if (guests.length) {
      await db.rSVP.createMany({
        data: guests.map((guest) => ({ guestId: guest.id, token: randomUUID() })),
        skipDuplicates: true,
      })
      await db.auditEvent.create({
        data: {
          action: 'guest.invitation_links_repair',
          resourceType: 'rsvp',
          afterValue: JSON.stringify({ generated: guests.length }),
          weddingId: access.context.weddingId,
          actorId: access.context.session.userId,
        },
      })
    }
    return privateJson({ success: true, generated: guests.length })
  } catch (error) {
    console.error('[guest invitations POST] Error:', error)
    return privateJson({ success: false, error: 'Unable to update invitation delivery.' }, 500)
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return privateNoStore(access.error)

  try {
    const body = (await request.json().catch(() => null)) as {
      style?: unknown
      message?: unknown
      rsvpDeadline?: unknown
      childrenPolicy?: unknown
    } | null
    if (!body) {
      return privateJson({ success: false, error: 'Invalid JSON body.' }, 400)
    }

    const style = normalizeInvitationCardStyle(body.style)
    if (body.style !== style) {
      return privateJson(
        { success: false, error: 'Choose a supported invitation card style.' },
        400,
      )
    }

    let requestedChildrenPolicy: ChildrenPolicy | null = null
    if (body.childrenPolicy !== undefined) {
      const normalized = normalizeChildrenPolicy(body.childrenPolicy)
      if (body.childrenPolicy !== normalized) {
        return privateJson(
          { success: false, error: 'Choose a supported children policy.' },
          400,
        )
      }
      requestedChildrenPolicy = normalized
    }

    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (message.length > 500) {
      return privateJson(
        { success: false, error: 'Invitation message must be 500 characters or fewer.' },
        400,
      )
    }

    let rsvpDeadline: Date | null = null
    if (typeof body.rsvpDeadline === 'string' && body.rsvpDeadline.trim()) {
      rsvpDeadline = new Date(`${body.rsvpDeadline.trim()}T23:59:59.999Z`)
      if (Number.isNaN(rsvpDeadline.getTime())) {
        return privateJson({ success: false, error: 'Choose a valid RSVP deadline.' }, 400)
      }
    }

    const [before, beforeChildrenPolicyRow] = await Promise.all([
      db.wedding.findUnique({
        where: { id: access.context.weddingId },
        select: {
          id: true,
          date: true,
          invitationCardStyle: true,
          invitationCardMessage: true,
          rsvpDeadline: true,
        },
      }),
      db.weddingContent.findUnique({
        where: {
          weddingId_section_field: {
            weddingId: access.context.weddingId,
            section: 'rsvp',
            field: 'childrenPolicy',
          },
        },
        select: { value: true },
      }),
    ])
    if (!before) {
      return privateJson({ success: false, error: 'Wedding not found.' }, 404)
    }
    if (rsvpDeadline && rsvpDeadline > before.date) {
      return privateJson(
        { success: false, error: 'RSVP deadline cannot be after the wedding date.' },
        400,
      )
    }

    const beforeChildrenPolicy = normalizeChildrenPolicy(beforeChildrenPolicyRow?.value)
    const childrenPolicy = requestedChildrenPolicy ?? beforeChildrenPolicy
    const wedding = await db.$transaction(async (tx) => {
      const updated = await tx.wedding.update({
        where: { id: access.context.weddingId },
        data: {
          invitationCardStyle: style,
          invitationCardMessage: message || null,
          rsvpDeadline,
        },
        select: invitationWeddingSelect(),
      })
      await tx.weddingContent.upsert({
        where: {
          weddingId_section_field: {
            weddingId: access.context.weddingId,
            section: 'rsvp',
            field: 'childrenPolicy',
          },
        },
        update: { value: childrenPolicy },
        create: {
          weddingId: access.context.weddingId,
          section: 'rsvp',
          field: 'childrenPolicy',
          value: childrenPolicy,
          order: 0,
        },
      })
      await tx.auditEvent.create({
        data: {
          action: 'wedding.invitation_card_updated',
          resourceType: 'wedding',
          resourceId: before.id,
          beforeValue: JSON.stringify({
            style: before.invitationCardStyle,
            message: before.invitationCardMessage,
            rsvpDeadline: before.rsvpDeadline,
            childrenPolicy: beforeChildrenPolicy,
          }),
          afterValue: JSON.stringify({
            style,
            message: message || null,
            rsvpDeadline,
            childrenPolicy,
          }),
          weddingId: before.id,
          actorId: access.context.session.userId,
        },
      })
      return updated
    })

    return privateJson({
      success: true,
      wedding: { ...wedding, invitationCardStyle: style, childrenPolicy },
    })
  } catch (error) {
    console.error('[guest invitations PUT] Error:', error)
    return privateJson({ success: false, error: 'Unable to save invitation card design.' }, 500)
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return privateNoStore(access.error)

  try {
    const body = (await request.json().catch(() => null)) as { guestId?: unknown } | null
    const guestId = typeof body?.guestId === 'string' ? body.guestId : ''
    if (!guestId) {
      return privateJson({ success: false, error: 'Guest ID is required.' }, 400)
    }

    const guest = await db.guest.findFirst({
      where: { id: guestId, weddingId: access.context.weddingId },
      include: { rsvp: { select: { id: true, token: true } } },
    })
    if (!guest) {
      return privateJson({ success: false, error: 'Guest not found.' }, 404)
    }

    const token = randomUUID()
    if (guest.rsvp) {
      await db.rSVP.update({ where: { id: guest.rsvp.id }, data: { token } })
    } else {
      await db.rSVP.create({ data: { guestId: guest.id, token } })
    }

    await db.auditEvent.create({
      data: {
        action: 'guest.invitation_rotated',
        resourceType: 'rsvp',
        resourceId: guest.id,
        beforeValue: JSON.stringify({ tokenPresent: Boolean(guest.rsvp?.token) }),
        afterValue: JSON.stringify({ rotated: true }),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    return privateJson({ success: true })
  } catch (error) {
    console.error('[guest invitations PATCH] Error:', error)
    return privateJson({ success: false, error: 'Unable to rotate invitation.' }, 500)
  }
}