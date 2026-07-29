import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface RSVPPayload {
  name?: string
  fullName?: string
  email?: string
  attending?: boolean
  attendance?: 'accept' | 'decline'
  mealChoice?: string
  mealPreference?: string
  plusOne?: boolean
  plusOneName?: string
  plusOneMeal?: string
  kidsAttending?: boolean
  childrenAttending?: boolean
  kidsCount?: number
  numberOfChildren?: string | number
  songRequests?: string
  songRequest?: string
  dietaryNotes?: string
  dietaryRequirements?: string
  message?: string
  messageToCouple?: string
  weddingId?: string
}

function normalizePayload(body: RSVPPayload) {
  const name = (body.name ?? body.fullName ?? '').trim()
  const email = body.email?.trim().toLowerCase() || null
  const attending =
    typeof body.attending === 'boolean'
      ? body.attending
      : body.attendance === 'accept'
        ? true
        : body.attendance === 'decline'
          ? false
          : null
  const rawKids = body.kidsCount ?? body.numberOfChildren ?? 0
  const kidsCount = Math.max(0, Math.min(20, Number(rawKids) || 0))
  return {
    name,
    email,
    attending,
    mealChoice: body.mealChoice ?? body.mealPreference ?? null,
    plusOne: body.plusOne === true,
    plusOneName: body.plusOneName?.trim() || null,
    plusOneMeal: body.plusOneMeal || null,
    kidsAttending: body.kidsAttending === true || body.childrenAttending === true,
    kidsCount,
    songRequests: body.songRequests ?? body.songRequest ?? null,
    dietaryNotes: (body.dietaryNotes ?? body.dietaryRequirements)?.trim() || null,
    message: (body.message ?? body.messageToCouple)?.trim() || null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RSVPPayload
    const input = normalizePayload(body)
    if (input.name.length < 2) {
      return NextResponse.json({ success: false, error: 'Full name is required.' }, { status: 400 })
    }
    if (!input.email) {
      return NextResponse.json({ success: false, error: 'Email is required.' }, { status: 400 })
    }

    const weddingId =
      body.weddingId ??
      (await db.wedding.findFirst({
        where: { slug: 'charity-and-kudzie' },
        select: { id: true },
      }))?.id
    if (!weddingId) {
      return NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 })
    }

    const existingGuest = await db.guest.findFirst({
      where: { weddingId, email: input.email },
      include: { rsvp: true },
    })

    const result = await db.$transaction(async (tx) => {
      if (existingGuest) {
        const guest = await tx.guest.update({
          where: { id: existingGuest.id },
          data: { name: input.name },
        })
        const rsvp = existingGuest.rsvp
          ? await tx.rSVP.update({
              where: { guestId: existingGuest.id },
              data: {
                attending: input.attending,
                mealChoice: input.mealChoice,
                plusOne: input.plusOne,
                plusOneName: input.plusOneName,
                plusOneMeal: input.plusOneMeal,
                kidsAttending: input.kidsAttending,
                kidsCount: input.kidsCount,
                songRequests: input.songRequests,
                dietaryNotes: input.dietaryNotes,
                message: input.message,
              },
            })
          : await tx.rSVP.create({
              data: {
                token: randomUUID(),
                guestId: existingGuest.id,
                attending: input.attending,
                mealChoice: input.mealChoice,
                plusOne: input.plusOne,
                plusOneName: input.plusOneName,
                plusOneMeal: input.plusOneMeal,
                kidsAttending: input.kidsAttending,
                kidsCount: input.kidsCount,
                songRequests: input.songRequests,
                dietaryNotes: input.dietaryNotes,
                message: input.message,
              },
            })
        return { guest, rsvp, updated: true }
      }

      const guest = await tx.guest.create({
        data: {
          name: input.name,
          email: input.email,
          role: 'guest',
          weddingId,
        },
      })
      const rsvp = await tx.rSVP.create({
        data: {
          token: randomUUID(),
          guestId: guest.id,
          attending: input.attending,
          mealChoice: input.mealChoice,
          plusOne: input.plusOne,
          plusOneName: input.plusOneName,
          plusOneMeal: input.plusOneMeal,
          kidsAttending: input.kidsAttending,
          kidsCount: input.kidsCount,
          songRequests: input.songRequests,
          dietaryNotes: input.dietaryNotes,
          message: input.message,
        },
      })
      return { guest, rsvp, updated: false }
    })

    return NextResponse.json(
      {
        success: true,
        updated: result.updated,
        token: result.rsvp.token,
        guest: { id: result.guest.id, name: result.guest.name, email: result.guest.email },
      },
      { status: result.updated ? 200 : 201 },
    )
  } catch (error) {
    console.error('[rsvp POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save RSVP.' }, { status: 500 })
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
    return NextResponse.json({ success: false, error: 'Failed to fetch RSVPs.' }, { status: 500 })
  }
}
