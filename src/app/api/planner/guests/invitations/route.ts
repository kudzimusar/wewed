import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

function csvCell(value: string | null | undefined) {
  return `"${(value ?? '').replaceAll('"', '""')}"`
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return access.error

  try {
    const [wedding, guests] = await Promise.all([
      db.wedding.findUnique({
        where: { id: access.context.weddingId },
        select: { slug: true, title: true },
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

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://wewed.app').replace(/\/$/, '')
    const data = guests.map((guest) => {
      const invitationUrl = guest.rsvp?.token
        ? `${siteUrl}/w/${encodeURIComponent(wedding.slug)}?rsvp=${encodeURIComponent(guest.rsvp.token)}`
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
      }
    })

    if (request.nextUrl.searchParams.get('format') === 'csv') {
      const csv = [
        'Name,Email,Phone,RSVP Status,Checked In,Table,Invitation URL',
        ...data.map((row) =>
          [
            csvCell(row.name),
            csvCell(row.email),
            csvCell(row.phone),
            csvCell(row.status),
            csvCell(row.checkedIn ? 'yes' : 'no'),
            csvCell(row.tableNumber?.toString()),
            csvCell(row.invitationUrl),
          ].join(','),
        ),
      ].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="wewed-invitations-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json({
      success: true,
      wedding,
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
