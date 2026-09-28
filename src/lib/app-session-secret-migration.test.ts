import { afterEach, describe, expect, mock, test } from 'bun:test'

mock.module('server-only', () => ({}))

const saved = { dedicated: process.env.WEWED_SESSION_SECRET, legacy: process.env.SUPABASE_SERVICE_ROLE_KEY }
afterEach(() => {
  process.env.WEWED_SESSION_SECRET = saved.dedicated
  process.env.SUPABASE_SERVICE_ROLE_KEY = saved.legacy
})

const input = { userId: 'u1', authUserId: 'a1', email: 'u1@example.test', role: 'planner', coupleId: null, activeWeddingId: 'w1' } as const

describe('app session secret migration', () => {
  test('a session issued under the service-role fallback survives adding WEWED_SESSION_SECRET', async () => {
    const { createAppSessionToken, verifyAppSessionToken } = await import('@/lib/app-session')
    delete process.env.WEWED_SESSION_SECRET
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role-test-key'
    const legacyToken = createAppSessionToken(input as never)
    process.env.WEWED_SESSION_SECRET = 'dedicated-test-secret'
    expect(verifyAppSessionToken(legacyToken)?.userId).toBe('u1')
    // New sessions are signed with the dedicated secret only.
    const fresh = createAppSessionToken(input as never)
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(verifyAppSessionToken(fresh)?.userId).toBe('u1')
    expect(verifyAppSessionToken(legacyToken)).toBeNull()
  })

  test('a token signed with an unknown key never verifies', async () => {
    const { createAppSessionToken, verifyAppSessionToken } = await import('@/lib/app-session')
    process.env.WEWED_SESSION_SECRET = 'attacker-key'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const forged = createAppSessionToken(input as never)
    process.env.WEWED_SESSION_SECRET = 'dedicated-test-secret'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role-test-key'
    expect(verifyAppSessionToken(forged)).toBeNull()
  })
})
