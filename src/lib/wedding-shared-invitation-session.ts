import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextResponse } from 'next/server'

export const WEDDING_SHARED_INVITATION_COOKIE = 'wewed_wedding_shared_invitation'
export const WEDDING_SHARED_INVITATION_TTL_SECONDS = 180 * 24 * 60 * 60

export interface WeddingSharedInvitationSession {
  version: 1
  weddingId: string
  destinationId: string
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

export function createWeddingSharedInvitationSessionToken(input: {
  weddingId: string
  destinationId: string
}): string {
  const payload: WeddingSharedInvitationSession = {
    version: 1,
    weddingId: input.weddingId,
    destinationId: input.destinationId,
    expiresAt:
      Date.now() + WEDDING_SHARED_INVITATION_TTL_SECONDS * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  )
  return `${encoded}.${sign(encoded)}`
}

export function verifyWeddingSharedInvitationSessionToken(
  token: string,
): WeddingSharedInvitationSession | null {
  try {
    const [encoded, signature, extra] = token.split('.')
    if (!encoded || !signature || extra) return null
    if (!signaturesMatch(signature, sign(encoded))) return null

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<WeddingSharedInvitationSession>

    if (
      payload.version !== 1 ||
      typeof payload.weddingId !== 'string' ||
      typeof payload.destinationId !== 'string' ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }

    return payload as WeddingSharedInvitationSession
  } catch {
    return null
  }
}

export function setWeddingSharedInvitationCookie(
  response: NextResponse,
  input: { weddingId: string; destinationId: string },
): void {
  response.cookies.set(
    WEDDING_SHARED_INVITATION_COOKIE,
    createWeddingSharedInvitationSessionToken(input),
    {
      httpOnly: true,
      secure: useSecureCookie(),
      sameSite: 'lax',
      path: '/',
      maxAge: WEDDING_SHARED_INVITATION_TTL_SECONDS,
    },
  )
}

export function clearWeddingSharedInvitationCookie(
  response: NextResponse,
): void {
  response.cookies.set(WEDDING_SHARED_INVITATION_COOKIE, '', {
    httpOnly: true,
    secure: useSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
