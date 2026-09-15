import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextResponse } from 'next/server'

export const ANDROID_INVITATION_APP_COOKIE = 'wewed_android_invitation_app'
const APP_SESSION_TTL_SECONDS = 15 * 60

interface AndroidInvitationAppSession {
  version: 1
  weddingId: string
  destinationId: string
  expiresAt: number
}

function signingSecret(): string {
  const secret =
    process.env.WEWED_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!secret) throw new Error('[wewed] Missing Android invitation app-session secret.')
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret())
    .update(`android-invitation-app:v1\0${payload}`, 'utf8')
    .digest('base64url')
}

function matches(a: string, b: string): boolean {
  try {
    const aa = Buffer.from(a, 'base64url')
    const bb = Buffer.from(b, 'base64url')
    return aa.length === bb.length && timingSafeEqual(aa, bb)
  } catch {
    return false
  }
}

function secureCookie(): boolean {
  const databaseUrl = process.env.DATABASE_URL?.toLowerCase() ?? ''
  const localCi =
    process.env.WEWED_E2E_MODE === '1' &&
    process.env.CI === 'true' &&
    !process.env.VERCEL &&
    (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1'))
  return process.env.NODE_ENV === 'production' && !localCi
}

export function createAndroidInvitationAppSession(input: {
  weddingId: string
  destinationId: string
}): string {
  const payload: AndroidInvitationAppSession = {
    version: 1,
    weddingId: input.weddingId,
    destinationId: input.destinationId,
    expiresAt: Date.now() + APP_SESSION_TTL_SECONDS * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyAndroidInvitationAppSession(
  token: string,
): AndroidInvitationAppSession | null {
  try {
    const [encoded, signature, extra] = token.split('.')
    if (!encoded || !signature || extra || !matches(signature, sign(encoded))) return null
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<AndroidInvitationAppSession>
    if (
      payload.version !== 1 ||
      typeof payload.weddingId !== 'string' ||
      typeof payload.destinationId !== 'string' ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }
    return payload as AndroidInvitationAppSession
  } catch {
    return null
  }
}

export function setAndroidInvitationAppCookie(
  response: NextResponse,
  input: { weddingId: string; destinationId: string },
): void {
  response.cookies.set(
    ANDROID_INVITATION_APP_COOKIE,
    createAndroidInvitationAppSession(input),
    {
      httpOnly: true,
      secure: secureCookie(),
      sameSite: 'lax',
      path: '/',
      maxAge: APP_SESSION_TTL_SECONDS,
    },
  )
}

export function clearAndroidInvitationAppCookie(response: NextResponse): void {
  response.cookies.set(ANDROID_INVITATION_APP_COOKIE, '', {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
