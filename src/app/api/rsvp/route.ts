import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  resolveWeddingAccessForRequest,
  weddingAccessErrorPayload,
  weddingSlugFromRequest,
} from '@/lib/wedding-public-access'

interface RSVPPayload {
  attending?: unknown
  attendance?: unknown
  mealChoice?: unknown
  mealPreference?: unknown
  plusOne?: unknown
  plusOneName?: unknown
  plusOneMeal?: unknown
  kidsAttending?: unknown
  childrenAttending?: unknown
  kidsCount?: unknown
  numberOfChildren?: unknown
  songRequests?: unknown
  songRequest?: unknown
  dietaryNotes?: unknown
  dietaryRequirements?: unknown
  message?: unknown
  messageToCouple?: unknown
  slug?: unknown
}

function value(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as RSVPPayload | null
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body.' },
        { status: 400 },
      )
    }

    const slug = weddingSlugFromRequest(
      request,
      typeof body.slug === 'string' ? body.slug : null,
    )
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Wedding route context is required.' },
        { status: 400 },
      )
    }

    const access = await resolveWeddingAccessForRequest(request, slug)
    if (!access.allowed || !access.wedding) {
      return NextResponse.json(weddingAccessErrorPayload(access), {
        status: access.status,
      })
    }
    if (!access.guest) {
      return NextResponse.json(
        {
          success: false,
          code: 'guest_invitation_required',
          error: 'Use your personal invitation QR or link to update an RSVP.',
        },
        { status: 403 },
      )
    }

    const attending =
      typeof body.attending === 'boolean'
        ? body.attending
        : body.attendance === 'accept'
          ? true
          : body.attendance === 'decline'
            ? false
            : access.guest.attending
    const rawKids = body.kidsCount ?? body.numberOfChildren
    const kidsCount =
      rawKids === undefined
        ? access.guest.kidsCount
        : Math.max(0, Math.min(20, Number(rawKids) || 0))

    const rsvp = await db.rSVP.update({
      where: { token: access.guest.rsvpToken },
      data: {
        attending,
        mealChoice:
          value(body.mealChoice ?? body.mealPreference) ?? access.guest.mealChoice,
        plusOne:
          typeof body.plusOne === 'boolean' ? body.plusOne : access.guest.plusOne,
        plusOneName: value(body.plusOneName),
        plusOneMeal: value(body.plusOneMeal),
        kidsAttending:
          typeof body.kidsAttending === 'boolean'
            ? body.kidsAttending
            : typeof body.childrenAttending === 'boolean'
              ? body.childrenAttending
              : access.guest.kidsAttending,
        kidsCount,
        songRequests: value(body.songRequests ?? body.songRequest),
        dietaryNotes: value(body.dietaryNotes ?? body.dietaryRequirements),
        message: value(body.message ?? body.messageToCouple),
      },
      select: {
        attending: true,
        mealChoice: true,
        plusOne: true,
        plusOneName: true,
        plusOneMeal: true,
        kidsAttending: true,
        kidsCount: true,
        songRequests: true,
        dietaryNotes: true,
        message: true,
      },
    })

    return NextResponse.json({
      success: true,
      updated: true,
      guest: {
        id: access.guest.id,
        name: access.guest.name,
        email: access.guest.email,
      },
      rsvp,
    })
  } catch (error) {
    console.error('[rsvp POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save RSVP.' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return access.error

  try {
    const rsvps = await db.rSVP.findMany({
      where: { guest: { weddingId: access.context.weddingId } },
      include: {
        guest: {
          select: { id: true, name: true, email: true, role: true, side: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, count: rsvps.length, data: rsvps })
  } catch (error) {
    console.error('[rsvp GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch RSVPs.' },
      { status: 500 },
    )
  }
}
