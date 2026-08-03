import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

export const WEDDING_GUEST_SESSION_COOKIE = 'wewed_wedding_guest'
export const WEDDING_GUEST_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

export interface WeddingGuestSession {
  version: 1
  weddingId: string
  guestId: string
  rsvpToken: string
  expiresAt: number
}

function getSigningSecret(): string {
  const secret =
    process.env.WEWED_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

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

function useSecureCookie(): boolean {
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
}): string {
  const payload: WeddingGuestSession = {
    version: 1,
    weddingId: input.weddingId,
    guestId: input.guestId,
    rsvpToken: input.rsvpToken,
    expiresAt: Date.now() + WEDDING_GUEST_SESSION_TTL_SECONDS * 1000,
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
    ) as Partial<WeddingGuestSession>

    if (
      payload.version !== 1 ||
      typeof payload.weddingId !== 'string' ||
      typeof payload.guestId !== 'string' ||
      typeof payload.rsvpToken !== 'string' ||
      typeof payload.expiresAt !== 'number' ||
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
  input: { weddingId: string; guestId: string; rsvpToken: string },
): void {
  response.cookies.set(
    WEDDING_GUEST_SESSION_COOKIE,
    createWeddingGuestSessionToken(input),
    {
      httpOnly: true,
      secure: useSecureCookie(),
      sameSite: 'lax',
      path: '/',
      maxAge: WEDDING_GUEST_SESSION_TTL_SECONDS,
    },
  )
}

export function clearWeddingGuestSessionCookie(response: NextResponse): void {
  response.cookies.set(WEDDING_GUEST_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: useSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
