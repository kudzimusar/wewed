import { createHash } from 'node:crypto'
import { db } from '@/lib/db'

interface RateLimitRow {
  count: number
}

export interface AiRateLimitResult {
  ok: boolean
  count: number
  remaining: number
  retryAfterMs?: number
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`)
  }
  return Math.floor(value)
}

function hashKey(scope: string, identity: string): string {
  return createHash('sha256')
    .update(`${scope.trim().toLowerCase()}\u0000${identity.trim()}`)
    .digest('hex')
}

export async function consumeAiRateLimit(input: {
  scope: string
  identity: string
  maxRequests: number
  windowMs: number
  now?: Date
}): Promise<AiRateLimitResult> {
  const maxRequests = positiveInteger(input.maxRequests, 'maxRequests')
  const windowMs = positiveInteger(input.windowMs, 'windowMs')
  const now = input.now ?? new Date()
  const nowMs = now.getTime()
  if (!Number.isFinite(nowMs)) throw new Error('Rate-limit time is invalid.')

  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs
  const windowStart = new Date(windowStartMs)
  const expiresAt = new Date(windowStartMs + windowMs * 2)
  const keyHash = hashKey(input.scope, input.identity || 'unknown')

  const rows = await db.$queryRaw<RateLimitRow[]>`
    INSERT INTO public."AiRateLimitBucket" (
      "keyHash",
      "windowStart",
      "count",
      "expiresAt"
    )
    VALUES (${keyHash}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT ("keyHash", "windowStart")
    DO UPDATE SET
      "count" = public."AiRateLimitBucket"."count" + 1,
      "expiresAt" = EXCLUDED."expiresAt"
    RETURNING "count"
  `

  const count = Number(rows[0]?.count ?? 1)
  const remaining = Math.max(0, maxRequests - count)
  const ok = count <= maxRequests

  // Low-frequency cleanup keeps the additive bucket table bounded without
  // adding a second database query to every AI request.
  if (Math.random() < 0.02) {
    void db.$executeRaw`
      DELETE FROM public."AiRateLimitBucket"
      WHERE "expiresAt" < NOW()
    `.catch((error) => {
      console.warn('[AI RATE LIMIT] Expired bucket cleanup failed:', error)
    })
  }

  return {
    ok,
    count,
    remaining,
    retryAfterMs: ok ? undefined : Math.max(0, windowStartMs + windowMs - nowMs),
  }
}
