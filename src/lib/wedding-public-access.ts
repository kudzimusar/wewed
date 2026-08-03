import 'server-only'

import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  APP_SESSION_COOKIE,
  verifyAppSessionToken,
  type AppSession,
} from '@/lib/app-session'
import {
  WEDDING_GUEST_SESSION_COOKIE,
  verifyWeddingGuestSessionToken,
  type WeddingGuestSession,
} from '@/lib/wedding-guest-session'

export type WeddingPrivacy = 'public' | 'link_only' | 'private'
export type WeddingAccessKind = 'public' | 'couple_owner' | 'invited_guest'

export interface WeddingAccessRecord {
  id: string
  slug: string
  title: string
  monogram: string | null
  tagline: string | null
  date: Date
  venue: string
  venueCity: string
  venueCountry: string
  privacy: WeddingPrivacy
  coupleId: string
  partner1: string
  partner2: string
}

export interface WeddingGuestIdentity {
  id: string
  name: string
  email: string | null
  tableNumber: number | null
  rsvpToken: string
  attending: boolean | null
  mealChoice: string | null
  plusOne: boolean
  plusOneName: string | null
  plusOneMeal: string | null
  kidsAttending: boolean
  kidsCount: number
  dietaryNotes: string | null
  message: string | null
  checkedIn: boolean
  checkedInAt: Date | null
}

export interface WeddingAccessResolution {
  wedding: WeddingAccessRecord | null
  allowed: boolean
  accessKind: WeddingAccessKind | null
  guest: WeddingGuestIdentity | null
  status: 200 | 401 | 403 | 404
  reason: 'allowed' | 'access_required' | 'private' | 'not_found'
}

function normalizePrivacy(value: string | null | undefined): WeddingPrivacy {
  if (value === 'public' || value === 'link_only' || value === 'private') {
    return value
  }
  return 'private'
}

export function weddingSlugFromRequest(
  request: NextRequest,
  explicit?: string | null,
): string | null {
  const direct = explicit?.trim() || request.nextUrl.searchParams.get('slug')?.trim()
  if (direct) return direct

  const referer = request.headers.get('referer')
  if (!referer) return null
  try {
    const pathname = new URL(referer).pathname
    const match = /^\/w\/([^/]+)/.exec(pathname)
    return match?.[1] ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

export async function loadWeddingAccessRecord(
  slug: string,
): Promise<WeddingAccessRecord | null> {
  const wedding = await db.wedding.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      monogram: true,
      tagline: true,
      date: true,
      venue: true,
      venueCity: true,
      venueCountry: true,
      privacy: true,
      coupleId: true,
      couple: { select: { partner1: true, partner2: true } },
    },
  })

  if (!wedding) return null

  return {
    id: wedding.id,
    slug: wedding.slug,
    title: wedding.title,
    monogram: wedding.monogram,
    tagline: wedding.tagline,
    date: wedding.date,
    venue: wedding.venue,
    venueCity: wedding.venueCity,
    venueCountry: wedding.venueCountry,
    privacy: normalizePrivacy(wedding.privacy),
    coupleId: wedding.coupleId,
    partner1: wedding.couple.partner1,
    partner2: wedding.couple.partner2,
  }
}

async function isCoupleOwner(
  wedding: WeddingAccessRecord,
  session: AppSession | null,
): Promise<boolean> {
  if (!session || session.role !== 'couple') return false
  if (session.coupleId !== wedding.coupleId) return false

  const membership = await db.weddingMembership.findFirst({
    where: {
      weddingId: wedding.id,
      userId: session.userId,
      role: 'owner',
      status: 'active',
    },
    select: { id: true },
  })

  return Boolean(membership)
}

export async function resolveGuestSessionForWedding(
  wedding: WeddingAccessRecord,
  session: WeddingGuestSession | null,
): Promise<WeddingGuestIdentity | null> {
  if (!session || session.weddingId !== wedding.id) return null

  const rsvp = await db.rSVP.findUnique({
    where: { token: session.rsvpToken },
    include: {
      guest: {
        select: {
          id: true,
          weddingId: true,
          name: true,
          email: true,
          tableNumber: true,
        },
      },
    },
  })

  if (
    !rsvp ||
    rsvp.guest.id !== session.guestId ||
    rsvp.guest.weddingId !== wedding.id
  ) {
    return null
  }

  return {
    id: rsvp.guest.id,
    name: rsvp.guest.name,
    email: rsvp.guest.email,
    tableNumber: rsvp.guest.tableNumber,
    rsvpToken: rsvp.token,
    attending: rsvp.attending,
    mealChoice: rsvp.mealChoice,
    plusOne: rsvp.plusOne,
    plusOneName: rsvp.plusOneName,
    plusOneMeal: rsvp.plusOneMeal,
    kidsAttending: rsvp.kidsAttending,
    kidsCount: rsvp.kidsCount,
    dietaryNotes: rsvp.dietaryNotes,
    message: rsvp.message,
    checkedIn: rsvp.checkedIn,
    checkedInAt: rsvp.checkedInAt,
  }
}

export async function resolveWeddingAccessFromTokens(input: {
  slug: string
  appSessionToken?: string | null
  guestSessionToken?: string | null
}): Promise<WeddingAccessResolution> {
  const wedding = await loadWeddingAccessRecord(input.slug)
  if (!wedding) {
    return {
      wedding: null,
      allowed: false,
      accessKind: null,
      guest: null,
      status: 404,
      reason: 'not_found',
    }
  }

  const appSession = input.appSessionToken
    ? verifyAppSessionToken(input.appSessionToken)
    : null
  const guestSession = input.guestSessionToken
    ? verifyWeddingGuestSessionToken(input.guestSessionToken)
    : null

  const [owner, guest] = await Promise.all([
    isCoupleOwner(wedding, appSession),
    resolveGuestSessionForWedding(wedding, guestSession),
  ])

  if (owner) {
    return {
      wedding,
      allowed: true,
      accessKind: 'couple_owner',
      guest: null,
      status: 200,
      reason: 'allowed',
    }
  }

  if (wedding.privacy === 'public') {
    return {
      wedding,
      allowed: true,
      accessKind: guest ? 'invited_guest' : 'public',
      guest,
      status: 200,
      reason: 'allowed',
    }
  }

  if (wedding.privacy === 'link_only' && guest) {
    return {
      wedding,
      allowed: true,
      accessKind: 'invited_guest',
      guest,
      status: 200,
      reason: 'allowed',
    }
  }

  return {
    wedding,
    allowed: false,
    accessKind: null,
    guest: null,
    status: wedding.privacy === 'private' ? 403 : 401,
    reason: wedding.privacy === 'private' ? 'private' : 'access_required',
  }
}

export async function resolveWeddingAccessForRequest(
  request: NextRequest,
  slug: string,
): Promise<WeddingAccessResolution> {
  return resolveWeddingAccessFromTokens({
    slug,
    appSessionToken: request.cookies.get(APP_SESSION_COOKIE)?.value ?? null,
    guestSessionToken:
      request.cookies.get(WEDDING_GUEST_SESSION_COOKIE)?.value ?? null,
  })
}

export function weddingAccessErrorPayload(
  resolution: WeddingAccessResolution,
): Record<string, unknown> {
  return {
    success: false,
    code:
      resolution.reason === 'private'
        ? 'wedding_private'
        : resolution.reason === 'not_found'
          ? 'wedding_not_found'
          : 'wedding_access_required',
    privacy: resolution.wedding?.privacy ?? null,
    error:
      resolution.reason === 'private'
        ? 'This wedding site is private.'
        : resolution.reason === 'not_found'
          ? 'Wedding not found.'
          : 'An invitation credential is required to view this wedding.',
  }
}
