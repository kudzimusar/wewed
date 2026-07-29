import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

export const APP_SESSION_COOKIE = 'wewed_admin_auth'
export const APP_SESSION_TTL_SECONDS = 8 * 60 * 60

export type DashboardRole = 'admin' | 'couple' | 'planner'

export interface AppSession {
  version: 2
  userId: string
  email: string
  role: DashboardRole
  coupleId: string | null
  activeWeddingId: string
  expiresAt: number
}

interface CreateAppSessionInput {
  userId: string
  email: string
  role: DashboardRole
  coupleId: string | null
  activeWeddingId: string
}

export function isDashboardRole(value: unknown): value is DashboardRole {
  return value === 'admin' || value === 'couple' || value === 'planner'
}

function getSigningSecret(): string {
  const secret =
    process.env.WEWED_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!secret) {
    throw new Error(
      '[wewed] Missing WEWED_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  return secret
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url')
}

function signaturesMatch(actual: string, expected: string): boolean {
  try {
    const actualBuffer = Buffer.from(actual, 'base64url')
    const expectedBuffer = Buffer.from(expected, 'base64url')

    if (actualBuffer.length !== expectedBuffer.length) return false
    return timingSafeEqual(actualBuffer, expectedBuffer)
  } catch {
    return false
  }
}

export function createAppSessionToken(input: CreateAppSessionInput): string {
  const payload: AppSession = {
    version: 2,
    userId: input.userId,
    email: input.email,
    role: input.role,
    coupleId: input.coupleId,
    activeWeddingId: input.activeWeddingId,
    expiresAt: Date.now() + APP_SESSION_TTL_SECONDS * 1000,
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  )

  return `${encodedPayload}.${signPayload(encodedPayload)}`
}

export function verifyAppSessionToken(token: string): AppSession | null {
  try {
    const [encodedPayload, signature, extra] = token.split('.')

    if (!encodedPayload || !signature || extra) return null

    const expectedSignature = signPayload(encodedPayload)
    if (!signaturesMatch(signature, expectedSignature)) return null

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as Partial<AppSession>

    if (
      payload.version !== 2 ||
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      !isDashboardRole(payload.role) ||
      typeof payload.activeWeddingId !== 'string' ||
      payload.activeWeddingId.length === 0 ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now() ||
      (payload.coupleId !== null && typeof payload.coupleId !== 'string')
    ) {
      return null
    }

    if (payload.role !== 'admin' && !payload.coupleId) return null

    return payload as AppSession
  } catch {
    return null
  }
}

export function readAppSession(request: NextRequest): AppSession | null {
  const token = request.cookies.get(APP_SESSION_COOKIE)?.value
  return token ? verifyAppSessionToken(token) : null
}

export function setAppSessionCookie(
  response: NextResponse,
  input: CreateAppSessionInput
): AppSession {
  const token = createAppSessionToken(input)
  const session = verifyAppSessionToken(token)

  if (!session) {
    throw new Error('[wewed] Failed to create application session.')
  }

  response.cookies.set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: APP_SESSION_TTL_SECONDS,
  })

  return session
}

export function clearAppSessionCookie(response: NextResponse): void {
  response.cookies.set(APP_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
