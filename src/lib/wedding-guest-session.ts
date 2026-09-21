import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

export const WEDDING_GUEST_SESSION_COOKIE = 'wewed_wedding_guest'
const DAY = 24 * 60 * 60 * 1000
export const WEDDING_GUEST_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

/** No sliding renewal: 30-day minimum, wedding + 90 days, capped at 400 days. */
export function weddingGuestSessionExpiry(weddingDate?: Date | string | null, now = Date.now()): number {
  const date = weddingDate ? new Date(weddingDate).getTime() : NaN
  const end = Number.isFinite(date) ? date + 90 * DAY : now + 30 * DAY
  return Math.min(now + 400 * DAY, Math.max(now + 30 * DAY, end))
}

export interface LegacyWeddingGuestSession {
  version: 1
  weddingId: string
  guestId: string
  rsvpToken: string
  expiresAt: number
}

export interface WeddingGuestSessionV2 {
  version: 2
  weddingId: string
  guestId: string
  invitationVersionFingerprint: string
  expiresAt: number
}
export type WeddingGuestSession = LegacyWeddingGuestSession | WeddingGuestSessionV2

export function invitationVersionFingerprint(input: { weddingId: string; guestId: string; rsvpToken: string }): string {
  return createHmac('sha256', getSigningSecret())
    .update(JSON.stringify(['wewed.guest.invitation-version.v2', input.weddingId, input.guestId, input.rsvpToken]))
    .digest('base64url')
}

export function guestSessionMatchesInvitation(session: WeddingGuestSession, input: { weddingId: string; guestId: string; rsvpToken: string }): boolean {
  if (session.weddingId !== input.weddingId || session.guestId !== input.guestId || session.expiresAt <= Date.now()) return false
  const actual = session.version === 1 ? invitationVersionFingerprint({ ...input, rsvpToken: session.rsvpToken }) : session.invitationVersionFingerprint
  return signaturesMatch(actual, invitationVersionFingerprint(input))
}

function getSigningSecret(): string {
  const isProduction =
    process.env.NODE_ENV === 'production' && !isLocalCiBrowserMode()
  const dedicated = process.env.WEWED_SESSION_SECRET?.trim()

  if (isProduction) {
    if (!dedicated) {
      throw new Error(
        '[wewed] Missing dedicated WEWED_SESSION_SECRET in production.',
      )
    }
    return dedicated
  }

  const secret = dedicated || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!secret) {
    throw new Error(
      '[wewed] Missing WEWED_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY.',
    )
  }

  return secret
}

function isLocalCiBrowserMode(): boolean {
  const databaseUrl = process.env.DATABASE_URL?.toLowerCase() ?? ''
  const localDatabase =
    databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')

  return (
    process.env.WEWED_E2E_MODE === '1' &&
    process.env.CI === 'true' &&
    !process.env.VERCEL &&
    localDatabase
  )
}

function shouldUseSecureCookie(): boolean {
  return process.env.NODE_ENV === 'production' && !isLocalCiBrowserMode()
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url')
}

function signaturesMatch(actual: string, expected: string): boolean {
  try {
    const actualBuffer = Buffer.from(actual, 'base64url')
    const expectedBuffer = Buffer.from(expected, 'base64url')
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    )
  } catch {
    return false
  }
}

export function createWeddingGuestSessionToken(input: {
  weddingId: string
  guestId: string
  rsvpToken: string
  weddingDate?: Date | string | null
  expiresAt?: number
}): string {
  const payload: WeddingGuestSessionV2 = {
    version: 2,
    weddingId: input.weddingId,
    guestId: input.guestId,
    invitationVersionFingerprint: invitationVersionFingerprint(input),
    expiresAt: Math.min(input.expiresAt ?? Infinity, weddingGuestSessionExpiry(input.weddingDate)),
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  )
  return `${encoded}.${sign(encoded)}`
}

export function verifyWeddingGuestSessionToken(
  token: string,
): WeddingGuestSession | null {
  try {
    const [encoded, signature, extra] = token.split('.')
    if (!encoded || !signature || extra) return null
    if (!signaturesMatch(signature, sign(encoded))) return null

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as { version?: number; weddingId?: string; guestId?: string; rsvpToken?: string; invitationVersionFingerprint?: string; expiresAt?: number }

    if (
      (payload.version !== 1 && payload.version !== 2) ||
      typeof payload.weddingId !== 'string' ||
      typeof payload.guestId !== 'string' ||
      (payload.version === 1 ? typeof payload.rsvpToken !== 'string' : (typeof payload.invitationVersionFingerprint !== 'string' || 'rsvpToken' in payload)) ||
      typeof payload.expiresAt !== 'number' || !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }

    return payload as WeddingGuestSession
  } catch {
    return null
  }
}

export function readWeddingGuestSession(
  request: NextRequest,
): WeddingGuestSession | null {
  const token = request.cookies.get(WEDDING_GUEST_SESSION_COOKIE)?.value
  return token ? verifyWeddingGuestSessionToken(token) : null
}

export function setWeddingGuestSessionCookie(
  response: NextResponse,
  input: { weddingId: string; guestId: string; rsvpToken: string; weddingDate?: Date | string | null; expiresAt?: number },
): void {
  response.cookies.set(
    WEDDING_GUEST_SESSION_COOKIE,
    createWeddingGuestSessionToken(input),
    {
      httpOnly: true,
      secure: shouldUseSecureCookie(),
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor((Math.min(input.expiresAt ?? Infinity, weddingGuestSessionExpiry(input.weddingDate)) - Date.now()) / 1000),
    },
  )
}

export function clearWeddingGuestSessionCookie(response: NextResponse): void {
  response.cookies.set(WEDDING_GUEST_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
