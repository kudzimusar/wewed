import { describe, expect, mock, test } from 'bun:test'
mock.module('server-only', () => ({}))
process.env.WEWED_SESSION_SECRET = 'synthetic-window-test-secret'

const {
  weddingPassIssuanceWindow,
  weddingPassIssuanceAllowedAt,
  WEDDING_PASS_OPENS_BEFORE_MS,
  WEDDING_PASS_ISSUANCE_CUTOFF_AFTER_MS,
  WEDDING_PASS_EXPIRES_AFTER_MS,
} = await import('./wedding-day')

const WEDDING = new Date('2027-06-12T14:00:00.000Z')
const at = (ms: number) => new Date(WEDDING.getTime() + ms)
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

describe('wedding pass issuance window', () => {
  test('the window is anchored to the wedding date alone', () => {
    const window = weddingPassIssuanceWindow(WEDDING)
    expect(window.opensAt.getTime()).toBe(WEDDING.getTime() - WEDDING_PASS_OPENS_BEFORE_MS)
    expect(window.cutoffAt.getTime()).toBe(WEDDING.getTime() + WEDDING_PASS_ISSUANCE_CUTOFF_AFTER_MS)
    expect(window.expiresAt.getTime()).toBe(WEDDING.getTime() + WEDDING_PASS_EXPIRES_AFTER_MS)
  })

  test('the documented policy is 14 days / +24h / +36h', () => {
    expect(WEDDING_PASS_OPENS_BEFORE_MS).toBe(14 * DAY)
    expect(WEDDING_PASS_ISSUANCE_CUTOFF_AFTER_MS).toBe(24 * HOUR)
    expect(WEDDING_PASS_EXPIRES_AFTER_MS).toBe(36 * HOUR)
  })

  test.each([
    ['long before the window opens', -365 * DAY, false],
    ['one millisecond before it opens', -14 * DAY - 1, false],
    ['exactly when it opens', -14 * DAY, true],
    ['one millisecond after it opens', -14 * DAY + 1, true],
    ['well before the wedding', -3 * DAY, true],
    ['at the wedding itself', 0, true],
    ['one millisecond before the cutoff', 24 * HOUR - 1, true],
    ['exactly at the cutoff', 24 * HOUR, true],
    ['one millisecond after the cutoff', 24 * HOUR + 1, false],
    ['long after the wedding', 365 * DAY, false],
  ])('issuance %s', (_label, offset, allowed) => {
    expect(weddingPassIssuanceAllowedAt(WEDDING, at(offset as number))).toBe(allowed)
  })

  test('the expiry ceiling never depends on when the pass was requested', () => {
    const ceiling = weddingPassIssuanceWindow(WEDDING).expiresAt.getTime()
    for (const offset of [-14 * DAY, -DAY, 0, 12 * HOUR, 24 * HOUR]) {
      expect(weddingPassIssuanceAllowedAt(WEDDING, at(offset))).toBe(true)
      expect(weddingPassIssuanceWindow(WEDDING).expiresAt.getTime()).toBe(ceiling)
    }
  })

  test('the cutoff sits twelve hours before expiry, so no issued pass starts already dead', () => {
    const window = weddingPassIssuanceWindow(WEDDING)
    expect(window.expiresAt.getTime() - window.cutoffAt.getTime()).toBe(12 * HOUR)
  })
})
