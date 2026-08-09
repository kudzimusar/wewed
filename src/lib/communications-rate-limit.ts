import 'server-only'

import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export type CommunicationRateLimitScope =
  | 'conversation_create'
  | 'message_send'
  | 'recipient_fanout'
  | 'channel_mutation'

interface RateLimitDecisionRow {
  allowed: boolean
  retryAfter: number
  remaining: number
}

export class CommunicationRateLimitError extends Error {
  readonly status = 429

  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message)
  }
}

export class CommunicationRateLimitBackendError extends Error {
  readonly status = 503

  constructor() {
    super('Communication safety controls are temporarily unavailable. Please try again shortly.')
  }
}

function positiveIntEnv(name: string, fallback: number, max: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

export function communicationRateLimitPolicy(scope: CommunicationRateLimitScope): {
  limit: number
  windowSeconds: number
} {
  switch (scope) {
    case 'conversation_create':
      return {
        limit: positiveIntEnv('WEWED_COMMUNICATIONS_CONVERSATION_LIMIT_PER_MINUTE', 12, 120),
        windowSeconds: 60,
      }
    case 'message_send':
      return {
        limit: positiveIntEnv('WEWED_COMMUNICATIONS_MESSAGE_LIMIT_PER_MINUTE', 40, 300),
        windowSeconds: 60,
      }
    case 'recipient_fanout':
      return {
        limit: positiveIntEnv('WEWED_COMMUNICATIONS_FANOUT_LIMIT_PER_MINUTE', 120, 1000),
        windowSeconds: 60,
      }
    case 'channel_mutation':
      return {
        limit: positiveIntEnv('WEWED_COMMUNICATIONS_CHANNEL_MUTATION_LIMIT_PER_MINUTE', 20, 120),
        windowSeconds: 60,
      }
  }
}

export function hashCommunicationRateLimitKey(
  userId: string,
  scope: CommunicationRateLimitScope,
): string {
  return createHash('sha256')
    .update(`wewed-communications:${scope}:${userId}`)
    .digest('hex')
}

export async function enforceCommunicationRateLimit(input: {
  userId: string
  scope: CommunicationRateLimitScope
  cost?: number
}): Promise<{ remaining: number; retryAfterSeconds: number }> {
  const cost = Math.max(1, Math.trunc(input.cost ?? 1))
  const policy = communicationRateLimitPolicy(input.scope)
  const keyHash = hashCommunicationRateLimitKey(input.userId, input.scope)

  try {
    const rows = await db.$queryRaw<RateLimitDecisionRow[]>(Prisma.sql`
      SELECT
        allowed,
        retry_after AS "retryAfter",
        remaining
      FROM wewed_communications."consume_rate_limit"(
        ${keyHash},
        ${input.scope},
        ${cost},
        ${policy.limit},
        ${policy.windowSeconds}
      )
    `)
    const decision = rows[0]
    if (!decision || typeof decision.allowed !== 'boolean') {
      throw new CommunicationRateLimitBackendError()
    }
    if (!decision.allowed) {
      throw new CommunicationRateLimitError(
        'Too many communication requests. Please try again shortly.',
        Math.max(1, Number(decision.retryAfter) || 1),
      )
    }
    return {
      remaining: Math.max(0, Number(decision.remaining) || 0),
      retryAfterSeconds: Math.max(1, Number(decision.retryAfter) || 1),
    }
  } catch (error) {
    if (
      error instanceof CommunicationRateLimitError ||
      error instanceof CommunicationRateLimitBackendError
    ) {
      throw error
    }
    throw new CommunicationRateLimitBackendError()
  }
}
