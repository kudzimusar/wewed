import {
  FLAGSHIP_ACCESS_TOKEN,
  safeEqualString,
  verifyFlagshipAccessToken,
} from '@/lib/privacy'
import { NextRequest, NextResponse } from 'next/server'

/* ============================================================
   POST /api/privacy/verify-token
   ------------------------------------------------------------
   Body: { "token": string }
   → { "valid": boolean }

   Verifies a supplied access token against the flagship
   wedding's expected token ("charity-kudzie-2026"). Uses a
   constant-time comparison to avoid leaking prefix information
   via response timing.

   The endpoint is intentionally public — it does not return the
   token itself, only a yes/no. Rate-limiting and per-wedding
   tokens will arrive in Phase 5 (NextAuth + DB-stored tokens).
   ============================================================ */

interface VerifyTokenPayload {
  token?: unknown
}

// Tiny in-memory attempt limiter — soft protection only.
// (Phase 5 will swap this for an IP-based Redis limiter.)
const MAX_ATTEMPTS = 12
const WINDOW_MS = 60 * 1000
const attempts = new Map<string, { count: number; firstAt: number }>()

function pruneAttempts(now: number): void {
  for (const [key, entry] of attempts.entries()) {
    if (now - entry.firstAt > WINDOW_MS) {
      attempts.delete(key)
    }
  }
}

function rateLimit(clientKey: string): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now()
  pruneAttempts(now)
  const entry = attempts.get(clientKey)
  if (!entry) {
    attempts.set(clientKey, { count: 1, firstAt: now })
    return { ok: true }
  }
  if (now - entry.firstAt > WINDOW_MS) {
    attempts.set(clientKey, { count: 1, firstAt: now })
    return { ok: true }
  }
  entry.count += 1
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (now - entry.firstAt)
    return { ok: false, retryAfterMs }
  }
  return { ok: true }
}

function getClientKey(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) {
    return fwd.split(',')[0]!.trim()
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  // 1) Soft rate-limit
  const clientKey = getClientKey(request)
  const rl = rateLimit(clientKey)
  if (!rl.ok) {
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: 'Too many attempts. Please slow down.',
        retryAfterMs: rl.retryAfterMs,
      },
      {
        status: 429,
        headers: rl.retryAfterMs
          ? { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) }
          : undefined,
      },
    )
  }

  // 2) Parse + validate body
  let body: VerifyTokenPayload
  try {
    body = (await request.json()) as VerifyTokenPayload
  } catch {
    return NextResponse.json(
      { success: false, valid: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const token = body?.token
  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json(
      { success: false, valid: false, error: 'Token is required' },
      { status: 400 },
    )
  }

  // 3) Constant-time compare against the flagship token
  const valid = safeEqualString(token.trim(), FLAGSHIP_ACCESS_TOKEN)

  // 4) Defensive double-check via the helper (also constant-time)
  const verified = valid && verifyFlagshipAccessToken(token.trim())

  // Small artificial delay to flatten timing differences between the
  // success and failure paths (mitigates remote timing attacks).
  await new Promise((resolve) => setTimeout(resolve, 120))

  return NextResponse.json({
    success: true,
    valid: verified,
  })
}
