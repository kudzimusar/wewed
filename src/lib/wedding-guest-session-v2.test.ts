import { afterEach, beforeEach, describe, expect, test, mock } from 'bun:test'
import { createHmac } from 'node:crypto'
mock.module('server-only', () => ({}))
const originalSessionSecret = process.env.WEWED_SESSION_SECRET
const { createWeddingGuestSessionToken, verifyWeddingGuestSessionToken, guestSessionMatchesInvitation, weddingGuestSessionExpiry } = await import('./wedding-guest-session')
const identity = { weddingId: 'synthetic-wedding', guestId: 'synthetic-guest', rsvpToken: 'private-invitation-fixture' }
beforeEach(() => {
  process.env.WEWED_SESSION_SECRET = 'synthetic-session-v2-unit-test-only'
})
afterEach(() => {
  if (originalSessionSecret === undefined) delete process.env.WEWED_SESSION_SECRET
  else process.env.WEWED_SESSION_SECRET = originalSessionSecret
})
function signed(payload: object) {
  return signedWith(process.env.WEWED_SESSION_SECRET!, payload)
}
function signedWith(secret: string, payload: object, domainPrefix = '') {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signer = createHmac('sha256', secret)
  if (domainPrefix) signer.update(`${domainPrefix}\0${encoded}`, 'utf8')
  else signer.update(encoded)
  return `${encoded}.${signer.digest('base64url')}`
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
  test('unknown/future version numbers fail closed even with a validly signed payload', () => {
    const futureExpiry = Date.now() + 60_000
    for (const badVersion of [0, 3, 99, '2', undefined, null]) {
      expect(
        verifyWeddingGuestSessionToken(
          signed({ version: badVersion, ...identity, invitationVersionFingerprint: 'x', expiresAt: futureExpiry }),
        ),
      ).toBeNull()
    }
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
  test('secret rotation preserves only legacy v1 cookie formats while v2 requires the dedicated signer', async () => {
    const { verifyWeddingGuestPortfolioToken } = await import('./wedding-guest-portfolio')
    const { verifyWeddingSharedInvitationSessionToken } = await import('./wedding-shared-invitation-session')
    const origEnv = process.env.NODE_ENV
    const origSecret = process.env.WEWED_SESSION_SECRET
    const origSupa = process.env.SUPABASE_SERVICE_ROLE_KEY
    const legacySecret = 'historical-service-role-signer'
    const dedicatedSecret = 'dedicated-session-v2-signer'
    try {
      process.env.NODE_ENV = 'production'
      process.env.WEWED_SESSION_SECRET = dedicatedSecret
      process.env.SUPABASE_SERVICE_ROLE_KEY = legacySecret
      const expiresAt = Date.now() + 60_000

      const legacyGuest = signedWith(legacySecret, { version: 1, ...identity, expiresAt })
      expect(verifyWeddingGuestSessionToken(legacyGuest)?.version).toBe(1)

      const legacyPortfolio = signedWith(
        legacySecret,
        {
          version: 1,
          activeWeddingId: identity.weddingId,
          entries: [{
            weddingId: identity.weddingId,
            weddingSlug: 'synthetic',
            guestId: identity.guestId,
            invitationCardStyle: 'ivory-floral-gold',
            lastUsedAt: Date.now(),
          }],
          expiresAt,
        },
        'wedding-guest-portfolio:v1',
      )
      expect(verifyWeddingGuestPortfolioToken(legacyPortfolio)?.activeWeddingId).toBe(identity.weddingId)

      const legacyShared = signedWith(legacySecret, {
        version: 1,
        weddingId: identity.weddingId,
        destinationId: 'physical-card',
        expiresAt,
      })
      expect(verifyWeddingSharedInvitationSessionToken(legacyShared)?.weddingId).toBe(identity.weddingId)

      const v2Payload = JSON.parse(
        Buffer.from(createWeddingGuestSessionToken(identity).split('.')[0], 'base64url').toString(),
      )
      const legacySignedV2 = signedWith(legacySecret, v2Payload)
      expect(verifyWeddingGuestSessionToken(legacySignedV2)).toBeNull()
    } finally {
      process.env.NODE_ENV = origEnv
      process.env.WEWED_SESSION_SECRET = origSecret
      if (origSupa) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupa
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  })

  test('shared invitation session strictly requires dedicated WEWED_SESSION_SECRET in production', async () => {
    const { createWeddingSharedInvitationSessionToken } = await import('./wedding-shared-invitation-session')
    const origEnv = process.env.NODE_ENV
    const origSecret = process.env.WEWED_SESSION_SECRET
    const origSupa = process.env.SUPABASE_SERVICE_ROLE_KEY
    try {
      process.env.NODE_ENV = 'production'
      delete process.env.WEWED_SESSION_SECRET
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase-fallback-secret'
      expect(() =>
        createWeddingSharedInvitationSessionToken({
          weddingId: 'synthetic-wedding',
          destinationId: 'home',
        })
      ).toThrow('Missing dedicated WEWED_SESSION_SECRET in production.')
    } finally {
      process.env.NODE_ENV = origEnv
      process.env.WEWED_SESSION_SECRET = origSecret
      if (origSupa) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupa
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  })
  test('cookie and token share identical computed effectiveExpiresAt and cookie never outlives token', async () => {
    const { setWeddingGuestSessionCookie, computeWeddingGuestSessionExpiresAt } = await import('./wedding-guest-session')
    const { NextResponse } = await import('next/server')
    const response = new NextResponse()
    const now = Date.now()
    const result = setWeddingGuestSessionCookie(response, {
      ...identity,
      weddingDate: '2026-12-23',
      now,
    })
    const payload = verifyWeddingGuestSessionToken(result.token)!
    expect(payload.expiresAt).toBe(result.effectiveExpiresAt)
    expect(result.effectiveExpiresAt).toBe(
      computeWeddingGuestSessionExpiresAt({ weddingDate: '2026-12-23', now })
    )
    expect(now + result.maxAge * 1000).toBeLessThanOrEqual(result.effectiveExpiresAt)
    const cookie = response.cookies.get('wewed_wedding_guest')
    expect(cookie?.value).toBe(result.token)
    expect(cookie?.maxAge).toBe(result.maxAge)
  })
})

