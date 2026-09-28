import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'
import {
  legacySessionVerificationSecrets,
  primarySessionSigningSecret,
} from '@/lib/session-signing-secret'

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
  return createHmac('sha256', primarySessionSigningSecret())
    .update(JSON.stringify(['wewed.guest.invitation-version.v2', input.weddingId, input.guestId, input.rsvpToken]))
    .digest('base64url')
}

export function guestSessionMatchesInvitation(session: WeddingGuestSession, input: { weddingId: string; guestId: string; rsvpToken: string }): boolean {
  if (session.weddingId !== input.weddingId || session.guestId !== input.guestId || session.expiresAt <= Date.now()) return false
  const actual = session.version === 1 ? invitationVersionFingerprint({ ...input, rsvpToken: session.rsvpToken }) : session.invitationVersionFingerprint
  return signaturesMatch(actual, invitationVersionFingerprint(input))
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

function sign(encodedPayload: string, secret = primarySessionSigningSecret()): string {
  return createHmac('sha256', secret)
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

export function computeWeddingGuestSessionExpiresAt(input: {
  weddingDate?: Date | string | null
  expiresAt?: number
  now?: number
}): number {
  const current = input.now ?? Date.now()
  const cappedExpiry = weddingGuestSessionExpiry(input.weddingDate, current)
  return Math.min(input.expiresAt ?? Infinity, cappedExpiry)
}

export function createWeddingGuestSessionToken(input: {
  weddingId: string
  guestId: string
  rsvpToken: string
  weddingDate?: Date | string | null
  expiresAt?: number
  effectiveExpiresAt?: number
}): string {
  const effectiveExpiresAt =
    input.effectiveExpiresAt ??
    computeWeddingGuestSessionExpiresAt({
      weddingDate: input.weddingDate,
      expiresAt: input.expiresAt,
    })

  const payload: WeddingGuestSessionV2 = {
    version: 2,
    weddingId: input.weddingId,
    guestId: input.guestId,
    invitationVersionFingerprint: invitationVersionFingerprint(input),
    expiresAt: effectiveExpiresAt,
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

    const decodedText = Buffer.from(encoded, 'base64url').toString('utf8')
    let untrustedVersion: number | undefined
    try {
      untrustedVersion = (JSON.parse(decodedText) as { version?: number }).version
    } catch {
      return null
    }

    const verificationSecrets =
      untrustedVersion === 1
        ? legacySessionVerificationSecrets()
        : [primarySessionSigningSecret()]
    if (!verificationSecrets.some((secret) => signaturesMatch(signature, sign(encoded, secret)))) {
      return null
    }

    const payload = JSON.parse(decodedText) as { version?: number; weddingId?: string; guestId?: string; rsvpToken?: string; invitationVersionFingerprint?: string; expiresAt?: number }

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
  input: {
    weddingId: string
    guestId: string
    rsvpToken: string
    weddingDate?: Date | string | null
    expiresAt?: number
    now?: number
  },
): { token: string; effectiveExpiresAt: number; maxAge: number } {
  const currentTime = input.now ?? Date.now()
  const effectiveExpiresAt = computeWeddingGuestSessionExpiresAt({
    weddingDate: input.weddingDate,
    expiresAt: input.expiresAt,
    now: currentTime,
  })
  const token = createWeddingGuestSessionToken({
    ...input,
    effectiveExpiresAt,
  })
  const maxAge = Math.max(
    0,
    Math.floor((effectiveExpiresAt - currentTime) / 1000),
  )

  response.cookies.set(
    WEDDING_GUEST_SESSION_COOKIE,
    token,
    {
      httpOnly: true,
      secure: shouldUseSecureCookie(),
      sameSite: 'lax',
      path: '/',
      maxAge,
    },
  )

  return { token, effectiveExpiresAt, maxAge }
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
