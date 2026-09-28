import { describe, expect, it } from 'bun:test'
import { parsePassCredential } from './pass-crypto'
import type { PassQrPayload } from './pass-types'

function createTestQr(payload: PassQrPayload, fakeSignature = 'test_valid_sig_12345678'): string {
  const jsonStr = JSON.stringify(payload)
  const encodedPayload = Buffer.from(jsonStr, 'utf8').toString('base64url')
  return `wewed:pass:v1.${encodedPayload}.${fakeSignature}`
}

describe('Native Pass Credential Parsing', () => {
  const samplePayload: PassQrPayload = {
    v: 1,
    wId: 'wedding_native_001',
    pId: 'pass_native_001',
    gId: 'guest_001',
    pt: 'household',
    cnt: 3,
    ent: ['ceremony', 'reception'],
    iat: Math.floor(Date.now() / 1000),
    nonce: 'nonce_987654',
  }

  it('parses valid operational pass QR credential', () => {
    const rawQr = createTestQr(samplePayload)
    const result = parsePassCredential(rawQr)

    expect(result.valid).toBe(true)
    expect(result.payload?.wId).toBe('wedding_native_001')
    expect(result.payload?.pId).toBe('pass_native_001')
    expect(result.payload?.cnt).toBe(3)
    expect(result.payload?.pt).toBe('household')
  })

  it('rejects empty or non-wewed QR format', () => {
    expect(parsePassCredential('').valid).toBe(false)
    expect(parsePassCredential('https://randomwebsite.com').valid).toBe(false)
    expect(parsePassCredential('guestId=12345').valid).toBe(false)
  })

  it('rejects credential with missing or truncated signature', () => {
    const jsonStr = JSON.stringify(samplePayload)
    const encodedPayload = Buffer.from(jsonStr, 'utf8').toString('base64url')
    const badQr = `wewed:pass:v1.${encodedPayload}.short`
    const result = parsePassCredential(badQr)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('Digital signature missing or truncated')
  })

  it('detects and rejects expired credential', () => {
    const expiredPayload: PassQrPayload = {
      ...samplePayload,
      exp: Math.floor(Date.now() / 1000) - 300, // expired 5 minutes ago
    }
    const rawQr = createTestQr(expiredPayload)
    const result = parsePassCredential(rawQr)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('Pass credential has expired')
  })

  it('detects when issuance window is exceeded', () => {
    const oldPayload: PassQrPayload = {
      ...samplePayload,
      iat: Math.floor(Date.now() / 1000) - (40 * 86400), // 40 days ago
    }
    const rawQr = createTestQr(oldPayload)
    const result = parsePassCredential(rawQr, 30 * 86400) // max 30 days

    expect(result.valid).toBe(false)
    expect(result.error).toContain('Pass issuance window exceeded')
  })
})
