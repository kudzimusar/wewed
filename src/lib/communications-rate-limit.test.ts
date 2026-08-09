import { afterEach, describe, expect, test } from 'bun:test'
import {
  CommunicationRateLimitError,
  communicationRateLimitPolicy,
  hashCommunicationRateLimitKey,
} from '@/lib/communications-rate-limit'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
})

describe('communications rate limit policy', () => {
  test('hashes actor/scope state without retaining the raw actor id', () => {
    const actor = 'user-sensitive-identifier'
    const first = hashCommunicationRateLimitKey(actor, 'message_send')
    const second = hashCommunicationRateLimitKey(actor, 'message_send')
    const otherScope = hashCommunicationRateLimitKey(actor, 'recipient_fanout')

    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(first).toBe(second)
    expect(first).not.toContain(actor)
    expect(otherScope).not.toBe(first)
  })

  test('uses conservative defaults and clamps environment overrides', () => {
    expect(communicationRateLimitPolicy('conversation_create')).toEqual({ limit: 12, windowSeconds: 60 })
    expect(communicationRateLimitPolicy('message_send')).toEqual({ limit: 40, windowSeconds: 60 })
    expect(communicationRateLimitPolicy('recipient_fanout')).toEqual({ limit: 120, windowSeconds: 60 })

    process.env.WEWED_COMMUNICATIONS_MESSAGE_LIMIT_PER_MINUTE = '999999'
    expect(communicationRateLimitPolicy('message_send').limit).toBe(300)
  })

  test('rate-limit errors carry an explicit retry interval', () => {
    const error = new CommunicationRateLimitError('limited', 17)
    expect(error.status).toBe(429)
    expect(error.retryAfterSeconds).toBe(17)
  })
})
