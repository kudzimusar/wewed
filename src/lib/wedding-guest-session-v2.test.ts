import { describe, expect, test, mock } from 'bun:test'
import { createHmac } from 'node:crypto'
mock.module('server-only', () => ({}))
process.env.WEWED_SESSION_SECRET = 'synthetic-session-v2-unit-test-only'
const { createWeddingGuestSessionToken, verifyWeddingGuestSessionToken, guestSessionMatchesInvitation, weddingGuestSessionExpiry } = await import('./wedding-guest-session')
const identity = { weddingId: 'synthetic-wedding', guestId: 'synthetic-guest', rsvpToken: 'private-invitation-fixture' }
function signed(payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${createHmac('sha256', process.env.WEWED_SESSION_SECRET!).update(encoded).digest('base64url')}`
}
describe('guest session v2 security', () => {
  test('issues v2 without embedding the original invitation credential', () => {
    const token = createWeddingGuestSessionToken(identity)
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString())
    expect(Object.keys(payload).sort()).toEqual(['expiresAt', 'guestId', 'invitationVersionFingerprint', 'version', 'weddingId'])
    expect(payload.version).toBe(2)
    expect(JSON.stringify(payload)).not.toContain(identity.rsvpToken)
    expect(guestSessionMatchesInvitation(verifyWeddingGuestSessionToken(token)!, identity)).toBe(true)
  })
  test('rotation and changing either guest or wedding revoke remembered access', () => {
    const session = verifyWeddingGuestSessionToken(createWeddingGuestSessionToken(identity))!
    expect(guestSessionMatchesInvitation(session, { ...identity, rsvpToken: 'rotated' })).toBe(false)
    expect(guestSessionMatchesInvitation(session, { ...identity, guestId: 'second-guest' })).toBe(false)
    expect(guestSessionMatchesInvitation(session, { ...identity, weddingId: 'other-wedding' })).toBe(false)
  })
  test('valid legacy v1 can be read and upgraded; rotated legacy cannot authenticate', () => {
    const legacy = verifyWeddingGuestSessionToken(signed({ version: 1, ...identity, expiresAt: Date.now() + 60_000 }))!
    expect(legacy.version).toBe(1)
    expect(guestSessionMatchesInvitation(legacy, identity)).toBe(true)
    expect(guestSessionMatchesInvitation(legacy, { ...identity, rsvpToken: 'rotated' })).toBe(false)
    expect(verifyWeddingGuestSessionToken(createWeddingGuestSessionToken(identity))!.version).toBe(2)
  })
  test('expired, tampered and token-bearing v2 credentials are rejected', () => {
    const valid = createWeddingGuestSessionToken(identity)
    expect(verifyWeddingGuestSessionToken(`${valid}x`)).toBeNull()
    expect(verifyWeddingGuestSessionToken(signed({ version: 1, ...identity, expiresAt: Date.now() - 1 }))).toBeNull()
    expect(verifyWeddingGuestSessionToken(signed({ ...verifyWeddingGuestSessionToken(valid), rsvpToken: 'forbidden' }))).toBeNull()
  })
  test('wedding-aware expiry has a 30-day floor and 400-day ceiling', () => {
    const now = Date.UTC(2026, 8, 21), day = 86_400_000
    expect(weddingGuestSessionExpiry(null, now)).toBe(now + 30 * day)
    expect(weddingGuestSessionExpiry('2026-12-23', now)).toBe(Date.UTC(2026, 11, 23) + 90 * day)
    expect(weddingGuestSessionExpiry('2030-01-01', now)).toBe(now + 400 * day)
    expect(weddingGuestSessionExpiry('2020-01-01', now)).toBe(now + 30 * day)
  })
  test('production strictly requires dedicated WEWED_SESSION_SECRET and rejects SUPABASE fallback', () => {
    const origEnv = process.env.NODE_ENV
    const origSecret = process.env.WEWED_SESSION_SECRET
    const origSupa = process.env.SUPABASE_SERVICE_ROLE_KEY
    try {
      process.env.NODE_ENV = 'production'
      delete process.env.WEWED_SESSION_SECRET
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase-fallback-secret'
      expect(() => createWeddingGuestSessionToken(identity)).toThrow('Missing dedicated WEWED_SESSION_SECRET in production.')
    } finally {
      process.env.NODE_ENV = origEnv
      process.env.WEWED_SESSION_SECRET = origSecret
      if (origSupa) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupa
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  })
})

