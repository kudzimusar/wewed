import { afterEach, beforeEach, describe, expect, test, mock } from 'bun:test'
import { createHmac } from 'node:crypto'
mock.module('server-only', () => ({}))
const originalSessionSecret = process.env.WEWED_SESSION_SECRET
const {
  createNativeAccountSessionToken,
  verifyNativeAccountSessionToken,
  readBearerNativeAccountSession,
} = await import('./native-account-session')

const identity = { accessUserId: 'user-1', authUserId: 'auth-1', email: 'planner@example.com' }
beforeEach(() => {
  process.env.WEWED_SESSION_SECRET = 'synthetic-native-account-session-unit-test-only'
})
afterEach(() => {
  if (originalSessionSecret === undefined) delete process.env.WEWED_SESSION_SECRET
  else process.env.WEWED_SESSION_SECRET = originalSessionSecret
})

function signed(payload: object) {
  return signedWith(process.env.WEWED_SESSION_SECRET!, payload)
}
function signedWith(secret: string, payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${createHmac('sha256', secret).update(encoded).digest('base64url')}`
}

describe('native account session (identity only, master plan Phase 5)', () => {
  test('issues a token that proves identity only, with no workspace authority field', () => {
    const token = createNativeAccountSessionToken(identity)
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString())
    expect(Object.keys(payload).sort()).toEqual(['accessUserId', 'authUserId', 'email', 'expiresAt', 'version'])
    expect(payload.version).toBe(1)
    const session = verifyNativeAccountSessionToken(token)
    expect(session).toEqual({ ...identity, version: 1, expiresAt: payload.expiresAt })
  })

  test('rejects a payload that also carries any workspace-authority-shaped field', () => {
    const futureExpiry = Date.now() + 60_000
    for (const poisoned of [
      { ...identity, version: 1, expiresAt: futureExpiry, role: 'admin' },
      { ...identity, version: 1, expiresAt: futureExpiry, weddingId: 'wed-1' },
      { ...identity, version: 1, expiresAt: futureExpiry, grantId: 'couple:wedding:wed-1' },
      { ...identity, version: 1, expiresAt: futureExpiry, workspaceKind: 'couple' },
      { ...identity, version: 1, expiresAt: futureExpiry, workspaceGrants: [] },
    ]) {
      expect(verifyNativeAccountSessionToken(signed(poisoned))).toBeNull()
    }
  })

  test('unknown/future version numbers fail closed even with a validly signed payload', () => {
    const futureExpiry = Date.now() + 60_000
    for (const badVersion of [0, 2, 99, '1', undefined, null]) {
      expect(
        verifyNativeAccountSessionToken(signed({ ...identity, version: badVersion, expiresAt: futureExpiry })),
      ).toBeNull()
    }
  })

  test('expired, tampered and malformed tokens are rejected', () => {
    const valid = createNativeAccountSessionToken(identity)
    expect(verifyNativeAccountSessionToken(`${valid}x`)).toBeNull()
    expect(verifyNativeAccountSessionToken('not-a-token')).toBeNull()
    expect(verifyNativeAccountSessionToken(signed({ ...identity, version: 1, expiresAt: Date.now() - 1 }))).toBeNull()
  })

  test('production strictly requires the dedicated WEWED_SESSION_SECRET and rejects the SUPABASE fallback', () => {
    const origEnv = process.env.NODE_ENV
    const origSecret = process.env.WEWED_SESSION_SECRET
    const origSupa = process.env.SUPABASE_SERVICE_ROLE_KEY
    try {
      process.env.NODE_ENV = 'production'
      delete process.env.WEWED_SESSION_SECRET
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase-fallback-secret'
      expect(() => createNativeAccountSessionToken(identity)).toThrow(
        'Missing dedicated WEWED_SESSION_SECRET in production.',
      )
    } finally {
      process.env.NODE_ENV = origEnv
      process.env.WEWED_SESSION_SECRET = origSecret
      if (origSupa) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupa
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  })

  test('a native account credential signed only by the legacy service-role secret is rejected once a dedicated secret is configured', () => {
    const origSecret = process.env.WEWED_SESSION_SECRET
    try {
      process.env.WEWED_SESSION_SECRET = 'dedicated-native-account-signer'
      const legacySigned = signedWith('historical-service-role-signer', {
        ...identity,
        version: 1,
        expiresAt: Date.now() + 60_000,
      })
      expect(verifyNativeAccountSessionToken(legacySigned)).toBeNull()
    } finally {
      process.env.WEWED_SESSION_SECRET = origSecret
    }
  })

  test('readBearerNativeAccountSession requires an exact "Bearer <token>" header', () => {
    const token = createNativeAccountSessionToken(identity)
    const requestWith = (headerValue: string | null) =>
      ({ headers: { get: (name: string) => (name.toLowerCase() === 'authorization' ? headerValue : null) } }) as any

    expect(readBearerNativeAccountSession(requestWith(null))).toBeNull()
    expect(readBearerNativeAccountSession(requestWith(token))).toBeNull()
    expect(readBearerNativeAccountSession(requestWith(`Basic ${token}`))).toBeNull()
    expect(readBearerNativeAccountSession(requestWith(`Bearer ${token}`))?.accessUserId).toBe(identity.accessUserId)
  })
})
