import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'
import type { InvitationCardStyle } from '@/lib/digital-invitation-card'

export const WEDDING_GUEST_PORTFOLIO_COOKIE = 'wewed_wedding_guest_portfolio'
export const WEDDING_GUEST_PORTFOLIO_TTL_SECONDS = 7 * 24 * 60 * 60
const MAX_PORTFOLIO_WEDDINGS = 8

export interface WeddingGuestPortfolioEntry {
  weddingId: string
  weddingSlug: string
  guestId: string
  invitationCardStyle: InvitationCardStyle
  invitationVersionFingerprint?: string
  accessExpiresAt?: number
  lastUsedAt: number
}

export interface WeddingGuestPortfolio {
  version: 1
  activeWeddingId: string | null
  entries: WeddingGuestPortfolioEntry[]
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
    .update(`wedding-guest-portfolio:v1\0${encodedPayload}`, 'utf8')
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

function validEntry(entry: Partial<WeddingGuestPortfolioEntry>): entry is WeddingGuestPortfolioEntry {
  return (
    typeof entry.weddingId === 'string' &&
    entry.weddingId.length > 0 &&
    typeof entry.weddingSlug === 'string' &&
    entry.weddingSlug.length > 0 &&
    typeof entry.guestId === 'string' &&
    entry.guestId.length > 0 &&
    typeof entry.invitationCardStyle === 'string' &&
    typeof entry.lastUsedAt === 'number' &&
    Number.isFinite(entry.lastUsedAt)
  )
}

export function createWeddingGuestPortfolioToken(
  portfolio: Omit<WeddingGuestPortfolio, 'version' | 'expiresAt'>,
): string {
  const payload: WeddingGuestPortfolio = {
    version: 1,
    activeWeddingId: portfolio.activeWeddingId,
    entries: portfolio.entries.slice(0, MAX_PORTFOLIO_WEDDINGS),
    expiresAt: Date.now() + WEDDING_GUEST_PORTFOLIO_TTL_SECONDS * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyWeddingGuestPortfolioToken(
  token: string,
): WeddingGuestPortfolio | null {
  try {
    const [encoded, signature, extra] = token.split('.')
    if (!encoded || !signature || extra) return null
    if (!signaturesMatch(signature, sign(encoded))) return null

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<WeddingGuestPortfolio>

    if (
      payload.version !== 1 ||
      (payload.activeWeddingId !== null && typeof payload.activeWeddingId !== 'string') ||
      !Array.isArray(payload.entries) ||
      !payload.entries.every((entry) => validEntry(entry)) ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now()
    ) {
      return null
    }

    const deduped = payload.entries.filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.weddingId === entry.weddingId) === index,
    )

    return {
      version: 1,
      activeWeddingId:
        payload.activeWeddingId && deduped.some((entry) => entry.weddingId === payload.activeWeddingId)
          ? payload.activeWeddingId
          : deduped[0]?.weddingId ?? null,
      entries: deduped.slice(0, MAX_PORTFOLIO_WEDDINGS),
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

export function readWeddingGuestPortfolio(request: NextRequest): WeddingGuestPortfolio | null {
  const token = request.cookies.get(WEDDING_GUEST_PORTFOLIO_COOKIE)?.value
  return token ? verifyWeddingGuestPortfolioToken(token) : null
}

export function mergeWeddingGuestPortfolio(
  current: WeddingGuestPortfolio | null,
  entry: Omit<WeddingGuestPortfolioEntry, 'lastUsedAt'> & { lastUsedAt?: number },
): Omit<WeddingGuestPortfolio, 'version' | 'expiresAt'> {
  const nextEntry: WeddingGuestPortfolioEntry = {
    ...entry,
    lastUsedAt: entry.lastUsedAt ?? Date.now(),
  }
  const entries = [
    nextEntry,
    ...(current?.entries ?? []).filter((item) => item.weddingId !== nextEntry.weddingId),
  ]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_PORTFOLIO_WEDDINGS)

  return {
    activeWeddingId: nextEntry.weddingId,
    entries,
  }
}

export function activateWeddingGuestPortfolioEntry(
  current: WeddingGuestPortfolio,
  weddingId: string,
): Omit<WeddingGuestPortfolio, 'version' | 'expiresAt'> | null {
  const selected = current.entries.find((entry) => entry.weddingId === weddingId)
  if (!selected) return null

  const now = Date.now()
  const entries = current.entries
    .map((entry) =>
      entry.weddingId === weddingId ? { ...entry, lastUsedAt: now } : entry,
    )
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)

  return { activeWeddingId: weddingId, entries }
}

export function removeWeddingGuestPortfolioEntry(
  current: WeddingGuestPortfolio | null,
  weddingId: string,
): Omit<WeddingGuestPortfolio, 'version' | 'expiresAt'> {
  const entries = (current?.entries ?? []).filter((entry) => entry.weddingId !== weddingId)
  const activeWeddingId =
    current?.activeWeddingId && current.activeWeddingId !== weddingId
      ? current.activeWeddingId
      : entries[0]?.weddingId ?? null
  return { activeWeddingId, entries }
}

export function setWeddingGuestPortfolioCookie(
  response: NextResponse,
  portfolio: Omit<WeddingGuestPortfolio, 'version' | 'expiresAt'>,
): void {
  if (portfolio.entries.length === 0) {
    clearWeddingGuestPortfolioCookie(response)
    return
  }

  response.cookies.set(
    WEDDING_GUEST_PORTFOLIO_COOKIE,
    createWeddingGuestPortfolioToken(portfolio),
    {
      httpOnly: true,
      secure: useSecureCookie(),
      sameSite: 'lax',
      path: '/',
      maxAge: WEDDING_GUEST_PORTFOLIO_TTL_SECONDS,
    },
  )
}

export function clearWeddingGuestPortfolioCookie(response: NextResponse): void {
  response.cookies.set(WEDDING_GUEST_PORTFOLIO_COOKIE, '', {
    httpOnly: true,
    secure: useSecureCookie(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
