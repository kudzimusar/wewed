import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildDigitalInvitationMessage,
  buildDigitalInvitationUrl,
  normalizeInvitationCardStyle,
} from '@/lib/digital-invitation-card'
import { requireWeddingPermission } from '@/lib/wedding-access'

function csvCell(value: string | null | undefined) {
  return `"${(value ?? '').replaceAll('"', '""')}"`
}

function invitationWeddingSelect() {
  return {
    slug: true,
    title: true,
    monogram: true,
    tagline: true,
    date: true,
    venue: true,
    venueCity: true,
    venueCountry: true,
    primaryColor: true,
    accentColor: true,
    backgroundColor: true,
    invitationCardStyle: true,
    invitationCardMessage: true,
    rsvpDeadline: true,
  } as const
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return access.error

  try {
    const [wedding, guests] = await Promise.all([
      db.wedding.findUnique({
        where: { id: access.context.weddingId },
        select: invitationWeddingSelect(),
      }),
      db.guest.findMany({
        where: { weddingId: access.context.weddingId },
        include: { rsvp: { select: { token: true, attending: true, checkedIn: true } } },
        orderBy: { name: 'asc' },
      }),
    ])

    if (!wedding) {
      return NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 })
    }

    const style = normalizeInvitationCardStyle(wedding.invitationCardStyle)
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://wewed.app').replace(/\/$/, '')
    const data = guests.map((guest) => {
      const invitationUrl = guest.rsvp?.token
        ? buildDigitalInvitationUrl({
            siteUrl,
            weddingSlug: wedding.slug,
            token: guest.rsvp.token,
            style,
          })
        : null
      return {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        tableNumber: guest.tableNumber,
        status:
          guest.rsvp?.attending === true
            ? 'attending'
            : guest.rsvp?.attending === false
              ? 'declined'
              : 'pending',
        checkedIn: guest.rsvp?.checkedIn ?? false,
        token: guest.rsvp?.token ?? null,
        invitationUrl,
        qrValue: invitationUrl,
        shareMessage: invitationUrl
          ? buildDigitalInvitationMessage({
              guestName: guest.name,
              weddingTitle: wedding.title,
              invitationUrl,
            })
          : null,
      }
    })

    if (request.nextUrl.searchParams.get('format') === 'csv') {
      const csv = [
        'Name,Email,Phone,RSVP Status,Checked In,Table,Card Style,Digital Invitation URL,Share Message',
        ...data.map((row) =>
          [
            csvCell(row.name),
            csvCell(row.email),
            csvCell(row.phone),
            csvCell(row.status),
            csvCell(row.checkedIn ? 'yes' : 'no'),
            csvCell(row.tableNumber?.toString()),
            csvCell(style),
            csvCell(row.invitationUrl),
            csvCell(row.shareMessage),
          ].join(','),
        ),
      ].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="wewed-digital-invitations-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json({
      success: true,
      wedding: { ...wedding, invitationCardStyle: style },
      count: data.length,
      missingTokens: data.filter((row) => !row.token).length,
      data,
    })
  } catch (error) {
    console.error('[guest invitations GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load invitation links.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return access.error

  try {
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
    return NextResponse.json({ success: true, generated: guests.length })
  } catch (error) {
    console.error('[guest invitations POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to generate invitation links.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json().catch(() => null)) as {
      style?: unknown
      message?: unknown
      rsvpDeadline?: unknown
    } | null
    if (!body) {
      return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
    }

    const style = normalizeInvitationCardStyle(body.style)
    if (body.style !== style) {
      return NextResponse.json({ success: false, error: 'Choose a supported invitation card style.' }, { status: 400 })
    }

    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (message.length > 500) {
      return NextResponse.json({ success: false, error: 'Invitation message must be 500 characters or fewer.' }, { status: 400 })
    }

    let rsvpDeadline: Date | null = null
    if (typeof body.rsvpDeadline === 'string' && body.rsvpDeadline.trim()) {
      rsvpDeadline = new Date(`${body.rsvpDeadline.trim()}T23:59:59.999Z`)
      if (Number.isNaN(rsvpDeadline.getTime())) {
        return NextResponse.json({ success: false, error: 'Choose a valid RSVP deadline.' }, { status: 400 })
      }
    }

    const before = await db.wedding.findUnique({
      where: { id: access.context.weddingId },
      select: {
        id: true,
        date: true,
        invitationCardStyle: true,
        invitationCardMessage: true,
        rsvpDeadline: true,
      },
    })
    if (!before) {
      return NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 })
    }
    if (rsvpDeadline && rsvpDeadline > before.date) {
      return NextResponse.json({ success: false, error: 'RSVP deadline cannot be after the wedding date.' }, { status: 400 })
    }

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
      await tx.auditEvent.create({
        data: {
          action: 'wedding.invitation_card_updated',
          resourceType: 'wedding',
          resourceId: before.id,
          beforeValue: JSON.stringify({
            style: before.invitationCardStyle,
            message: before.invitationCardMessage,
            rsvpDeadline: before.rsvpDeadline,
          }),
          afterValue: JSON.stringify({ style, message: message || null, rsvpDeadline }),
          weddingId: before.id,
          actorId: access.context.session.userId,
        },
      })
      return updated
    })

    return NextResponse.json({
      success: true,
      wedding: { ...wedding, invitationCardStyle: style },
    })
  } catch (error) {
    console.error('[guest invitations PUT] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to save invitation card design.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json().catch(() => null)) as { guestId?: unknown } | null
    const guestId = typeof body?.guestId === 'string' ? body.guestId : ''
    if (!guestId) {
      return NextResponse.json({ success: false, error: 'Guest ID is required.' }, { status: 400 })
    }

    const guest = await db.guest.findFirst({
      where: { id: guestId, weddingId: access.context.weddingId },
      include: { rsvp: { select: { id: true, token: true } } },
    })
    if (!guest) {
      return NextResponse.json({ success: false, error: 'Guest not found.' }, { status: 404 })
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[guest invitations PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to rotate invitation.' }, { status: 500 })
  }
}
