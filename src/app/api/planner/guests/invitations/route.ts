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
    const guests = await db.guest.findMany({
      where: { weddingId: access.context.weddingId },
      include: { rsvp: { select: { token: true, attending: true } } },
      orderBy: { name: 'asc' },
    })
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://wewed.app').replace(/\/$/, '')
    const data = guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      email: guest.email,
      status:
        guest.rsvp?.attending === true
          ? 'attending'
          : guest.rsvp?.attending === false
            ? 'declined'
            : 'pending',
      token: guest.rsvp?.token ?? null,
      invitationUrl: guest.rsvp?.token
        ? `${siteUrl}/?rsvp=${encodeURIComponent(guest.rsvp.token)}`
        : null,
    }))

    if (new URL(request.url).searchParams.get('format') === 'csv') {
      const csv = [
        'Name,Email,RSVP Status,Invitation URL',
        ...data.map((row) =>
          [csvCell(row.name), csvCell(row.email), csvCell(row.status), csvCell(row.invitationUrl)].join(','),
        ),
      ].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="wewed-rsvp-invitations-${new Date().toISOString().slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json({
      success: true,
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
