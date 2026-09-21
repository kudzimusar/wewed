import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import { setWeddingGuestSessionCookie, invitationVersionFingerprint } from '@/lib/wedding-guest-session'
import {
  activateWeddingGuestPortfolioEntry,
  readWeddingGuestPortfolio,
  setWeddingGuestPortfolioCookie,
} from '@/lib/wedding-guest-portfolio'

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function invitationDestination(input: {
  slug: string
  card: string
}): string {
  const query = new URLSearchParams({
    invitation: '1',
    card: normalizeInvitationCardStyle(input.card),
  })
  return `/w/${encodeURIComponent(input.slug)}?${query.toString()}`
}

async function validatedGuestWedding(input: {
  weddingId: string
  guestId: string
  invitationVersionFingerprint?: string
  accessExpiresAt?: number
}) {
  const record = await db.guest.findFirst({
    where: {
      id: input.guestId,
      weddingId: input.weddingId,
    },
    select: {
      id: true,
      rsvp: { select: { token: true } },
      wedding: {
        select: {
          id: true,
          slug: true,
          date: true,
          monogram: true,
          invitationCardStyle: true,
          couple: {
            select: {
              partner1: true,
              partner2: true,
            },
          },
        },
      },
    },
  })
  if (!input.accessExpiresAt || input.accessExpiresAt <= Date.now() || !record?.rsvp || !input.invitationVersionFingerprint || input.invitationVersionFingerprint !== invitationVersionFingerprint({ weddingId: record.wedding.id, guestId: record.id, rsvpToken: record.rsvp.token })) return null
  return record
}

export async function GET(request: NextRequest) {
  const portfolio = readWeddingGuestPortfolio(request)
  if (!portfolio || portfolio.entries.length === 0) {
    return noStore(
      NextResponse.json({ success: true, activeWeddingId: null, weddings: [] }),
    )
  }

  const validated = await Promise.all(
    portfolio.entries.map(async (entry) => {
      const record = await validatedGuestWedding(entry)
      if (!record?.rsvp || record.wedding.id !== entry.weddingId) return null
      return {
        weddingId: record.wedding.id,
        slug: record.wedding.slug,
        coupleNames: `${record.wedding.couple.partner1} & ${record.wedding.couple.partner2}`,
        date: record.wedding.date.toISOString(),
        monogram: record.wedding.monogram,
        invitationCardStyle: normalizeInvitationCardStyle(
          entry.invitationCardStyle || record.wedding.invitationCardStyle,
        ),
      }
    }),
  )

  const weddings = validated.filter((item): item is NonNullable<typeof item> => Boolean(item))
  const validIds = new Set(weddings.map((item) => item.weddingId))
  const activeWeddingId =
    portfolio.activeWeddingId && validIds.has(portfolio.activeWeddingId)
      ? portfolio.activeWeddingId
      : weddings[0]?.weddingId ?? null

  return noStore(
    NextResponse.json({
      success: true,
      activeWeddingId,
      weddings,
    }),
  )
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { weddingId?: unknown } | null
  const weddingId = typeof body?.weddingId === 'string' ? body.weddingId.trim() : ''
  const portfolio = readWeddingGuestPortfolio(request)

  if (!weddingId || !portfolio) {
    return noStore(
      NextResponse.json(
        { success: false, error: 'Wedding selection is unavailable.' },
        { status: 400 },
      ),
    )
  }

  const selected = portfolio.entries.find((entry) => entry.weddingId === weddingId)
  if (!selected) {
    return noStore(
      NextResponse.json(
        { success: false, error: 'This wedding is not in your invitation portfolio.' },
        { status: 403 },
      ),
    )
  }

  const record = await validatedGuestWedding(selected)
  if (!record?.rsvp || record.wedding.id !== selected.weddingId) {
    return noStore(
      NextResponse.json(
        { success: false, error: 'This invitation is no longer active.' },
        { status: 410 },
      ),
    )
  }

  const activated = activateWeddingGuestPortfolioEntry(portfolio, weddingId)
  if (!activated) {
    return noStore(
      NextResponse.json(
        { success: false, error: 'Wedding selection is unavailable.' },
        { status: 400 },
      ),
    )
  }

  const card = normalizeInvitationCardStyle(
    selected.invitationCardStyle || record.wedding.invitationCardStyle,
  )
  const destination = invitationDestination({ slug: record.wedding.slug, card })
  const response = NextResponse.json({ success: true, destination })

  setWeddingGuestSessionCookie(response, {
    weddingId: record.wedding.id,
    guestId: record.id,
    rsvpToken: record.rsvp.token,
    weddingDate: record.wedding.date,
    expiresAt: selected.accessExpiresAt,
  })
  setWeddingGuestPortfolioCookie(response, activated)

  return noStore(response)
}
