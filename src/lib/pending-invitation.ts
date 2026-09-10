import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'
import {
  INVITATION_CARD_STYLES,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

export const PENDING_INVITATION_COOKIE = 'wewed_pending_invitation'
export const PENDING_INVITATION_TTL_SECONDS = 24 * 60 * 60

const INVITATION_CARD_STYLE_IDS = new Set<string>(
  INVITATION_CARD_STYLES.map((style) => style.id),
)

export interface PendingInvitation {
  version: 1
  weddingSlug: string
  rsvpToken: string
  card: InvitationCardStyle
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

export function createPendingInvitationToken(input: {
  weddingSlug: string
  rsvpToken: string
  card: InvitationCardStyle
}): string {
  const payload: PendingInvitation = {
    version: 1,
    weddingSlug: input.weddingSlug,
    rsvpToken: input.rsvpToken,
    card: input.card,
    expiresAt: Date.now() + PENDING_INVITATION_TTL_SECONDS * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  )
  return `${encoded}.${sign(encoded)}`
}

export function verifyPendingInvitationToken(
  token: string,
): PendingInvitation | null {
  try {
    const [encoded, signature, extra] = token.split('.')
    if (!encoded || !signature || extra) return null
    if (!signaturesMatch(signature, sign(encoded))) return null

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<PendingInvitation>

    if (
      payload.version !== 1 ||
      typeof payload.weddingSlug !== 'string' ||
      typeof payload.rsvpToken !== 'string' ||
      typeof payload.card !== 'string' ||
      !INVITATION_CARD_STYLE_IDS.has(payload.card) ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }

    return payload as PendingInvitation
  } catch {
    return null
  }
}

export function readPendingInvitation(
  request: NextRequest,
): PendingInvitation | null {
  const token = request.cookies.get(PENDING_INVITATION_COOKIE)?.value
  return token ? verifyPendingInvitationToken(token) : null
}

export function setPendingInvitationCookie(
  response: NextResponse,
  input: {
    weddingSlug: string
    rsvpToken: string
    card: InvitationCardStyle
  },
): void {
  response.cookies.set(
    PENDING_INVITATION_COOKIE,
    createPendingInvitationToken(input),
    {
      httpOnly: true,
      secure: useSecureCookie(),
      sameSite: 'lax',
      path: '/',
      maxAge: PENDING_INVITATION_TTL_SECONDS,
    },
  )
}

export function clearPendingInvitationCookie(response: NextResponse): void {
  response.cookies.set(PENDING_INVITATION_COOKIE, '', {
    httpOnly: true,
    secure: useSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
