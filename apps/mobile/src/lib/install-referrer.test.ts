import { describe, expect, test } from 'bun:test'
import {
  buildInvitationResumeUrl,
  hasExplicitWewedLaunchIntent,
  MAX_INSTALL_REFERRER_ATTEMPTS,
  parseInstallReferrerState,
  parseInvitationHandoffReferrer,
  serializeInstallReferrerState,
} from './install-referrer'

const HANDOFF = 'A'.repeat(43)

describe('native deferred invitation install referrer', () => {
  test('accepts one strict opaque handoff from a Play referrer query', () => {
    expect(parseInvitationHandoffReferrer(`utm_source=whatsapp&handoff=${HANDOFF}`)).toBe(HANDOFF)
    expect(parseInvitationHandoffReferrer(`https://play.example.test/?handoff=${HANDOFF}`)).toBe(HANDOFF)
  })

  test('defensively decodes the Play referrer once', () => {
    const encoded = encodeURIComponent(`source=facebook&handoff=${HANDOFF}`)
    expect(parseInvitationHandoffReferrer(encoded)).toBe(HANDOFF)
    expect(parseInvitationHandoffReferrer(encodeURIComponent(encoded))).toBeNull()
  })

  test('rejects malformed, duplicated and non-opaque invitation data', () => {
    expect(parseInvitationHandoffReferrer(`handoff=${'A'.repeat(42)}`)).toBeNull()
    expect(parseInvitationHandoffReferrer(`handoff=${HANDOFF}&handoff=${HANDOFF}`)).toBeNull()
    expect(parseInvitationHandoffReferrer('rsvp=private-token')).toBeNull()
    expect(parseInvitationHandoffReferrer(`handoff=${'A'.repeat(2049)}`)).toBeNull()
  })

  test('builds only the canonical secure resume URL', () => {
    expect(buildInvitationResumeUrl(HANDOFF)).toBe(`https://wewed.pro/invite/resume?h=${HANDOFF}`)
    expect(() => buildInvitationResumeUrl('private-rsvp-token')).toThrow('Invalid Wewed invitation handoff')
  })

  test('gives explicit Wewed launch intent precedence over historical referrer state', () => {
    expect(hasExplicitWewedLaunchIntent('https://wewed.pro/invite/couple')).toBe(true)
    expect(hasExplicitWewedLaunchIntent('https://www.wewed.pro/messages/abc')).toBe(true)
    expect(hasExplicitWewedLaunchIntent('wewed://messages/abc')).toBe(true)
    expect(hasExplicitWewedLaunchIntent('https://wewed.pro.evil.example/invite/couple')).toBe(false)
    expect(hasExplicitWewedLaunchIntent('exp://127.0.0.1:8081')).toBe(false)
    expect(hasExplicitWewedLaunchIntent(null)).toBe(false)
  })

  test('persists only bounded process state, never referrer credentials', () => {
    expect(parseInstallReferrerState(null)).toEqual({ processed: false, attempts: 0 })
    expect(parseInstallReferrerState('{"processed":true,"attempts":99}')).toEqual({
      processed: true,
      attempts: MAX_INSTALL_REFERRER_ATTEMPTS,
    })
    expect(parseInstallReferrerState('not-json')).toEqual({ processed: false, attempts: 0 })
    expect(serializeInstallReferrerState({ processed: false, attempts: 99 })).toBe(
      JSON.stringify({ processed: false, attempts: MAX_INSTALL_REFERRER_ATTEMPTS }),
    )
  })
})
