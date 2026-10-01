import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import {
  normalizeAdditionalAdultPolicy,
  type AdditionalAdultPolicy,
} from '@/lib/invitation-content-contract'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { repairMissingInvitationLinks, rotateGuestInvitation } from '@/lib/planner-invitation-operations'
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
        'Name,Email,Phone,RSVP Status,Checked In,Table,Delivery Status,Delivery Channel,Sent At,Opened At,Card Style,Digital Invitation URL,Share Message',
        ...data.map((row) =>
          [
            csvCell(row.name),
            csvCell(row.email),
            csvCell(row.phone),
            csvCell(row.status),
            csvCell(row.checkedIn ? 'yes' : 'no'),
            csvCell(row.tableNumber?.toString()),
            csvCell(row.deliveryStatus),
            csvCell(row.deliveryChannel),
            csvCell(row.deliveredAt),
            csvCell(row.openedAt),
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
    const result = await repairMissingInvitationLinks({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
    })
    return privateJson({ success: true, generated: result.ok ? result.data.generated : 0 })
  } catch (error) {
    console.error('[guest invitations POST] Error:', error)
    return privateJson({ success: false, error: 'Unable to generate invitation links.' }, 500)
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
      additionalAdultPolicy?: unknown
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

    let requestedAdditionalAdultPolicy: AdditionalAdultPolicy | null = null
    if (body.additionalAdultPolicy !== undefined) {
      const normalized = normalizeAdditionalAdultPolicy(body.additionalAdultPolicy)
      if (body.additionalAdultPolicy !== normalized) {
        return privateJson({ success: false, error: 'Choose a supported additional-adult policy.' }, 400)
      }
      requestedAdditionalAdultPolicy = normalized
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

    const [before, beforeChildrenPolicyRow, beforeAdditionalAdultPolicyRow] = await Promise.all([
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
      db.weddingContent.findUnique({
        where: {
          weddingId_section_field: {
            weddingId: access.context.weddingId,
            section: 'rsvp',
            field: 'additionalAdultPolicy',
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
    const beforeAdditionalAdultPolicy = normalizeAdditionalAdultPolicy(beforeAdditionalAdultPolicyRow?.value)
    const additionalAdultPolicy = requestedAdditionalAdultPolicy ?? beforeAdditionalAdultPolicy
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
      await tx.weddingContent.upsert({
        where: {
          weddingId_section_field: {
            weddingId: access.context.weddingId,
            section: 'rsvp',
            field: 'additionalAdultPolicy',
          },
        },
        update: { value: additionalAdultPolicy },
        create: {
          weddingId: access.context.weddingId,
          section: 'rsvp',
          field: 'additionalAdultPolicy',
          value: additionalAdultPolicy,
          order: 1,
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
            additionalAdultPolicy: beforeAdditionalAdultPolicy,
          }),
          afterValue: JSON.stringify({
            style,
            message: message || null,
            rsvpDeadline,
            childrenPolicy,
            additionalAdultPolicy,
          }),
          weddingId: before.id,
          actorId: access.context.session.userId,
        },
      })
      return updated
    })

    return privateJson({
      success: true,
      wedding: { ...wedding, invitationCardStyle: style, childrenPolicy, additionalAdultPolicy },
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
    const result = await rotateGuestInvitation(
      { weddingId: access.context.weddingId, actorId: access.context.session.userId },
      { guestId: body?.guestId },
    )
    if (!result.ok) return privateJson({ success: false, error: result.error }, result.status)
    return privateJson({ success: true })
  } catch (error) {
    console.error('[guest invitations PATCH] Error:', error)
    return privateJson({ success: false, error: 'Unable to rotate invitation.' }, 500)
  }
}
