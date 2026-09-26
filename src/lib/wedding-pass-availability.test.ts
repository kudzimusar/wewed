/// <reference types="bun-types" />

import { describe, expect, mock, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import {
  ATTENDANCE_WITHDRAWN_REASON,
  GUEST_PASS_AVAILABILITY_COPY,
  WEDDING_PASS_ADMIN_STATE_LABEL,
  WEDDING_PASS_AVAILABILITY_STATES,
  resolveWeddingPassAdminState,
  weddingHouseholdAttendeeKeys,
} from '@/lib/wedding-pass-availability'

mock.module('server-only', () => ({}))
const wd = await import('@/lib/wedding-day')

const source = (path: string) => readFile(path, 'utf8')
const withoutComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const DAY = 24 * 60 * 60 * 1000
const wedding = new Date('2031-06-14T12:00:00.000Z')
const at = (offsetMs: number) => new Date(wedding.getTime() + offsetMs)
const lifecycle = (overrides: Partial<{ revokedAt: Date | null; revocationReason: string | null; supersededAt: Date | null; expiresAt: Date | null }> = {}) => ({
  revokedAt: null,
  revocationReason: null,
  supersededAt: null,
  expiresAt: at(1.5 * DAY),
  ...overrides,
})

describe('Wedding Pass issuance-window policy (unchanged)', () => {
  test('opens 14 days before, closes 24h after, expires 36h after', () => {
    expect(wd.WEDDING_PASS_OPENS_BEFORE_MS).toBe(14 * DAY)
    expect(wd.WEDDING_PASS_ISSUANCE_CUTOFF_AFTER_MS).toBe(DAY)
    expect(wd.WEDDING_PASS_EXPIRES_AFTER_MS).toBe(1.5 * DAY)
  })

  test('the client-safe admin resolver uses the same window as the server authority', () => {
    const state = (now: Date) => resolveWeddingPassAdminState({ attending: true, weddingDate: wedding, latest: null, householdSize: 1, admittedCount: 0, now })
    expect(state(at(-14 * DAY - 1))).toBe('not_yet_issuable')
    expect(state(at(-14 * DAY))).toBe('not_yet_issued')
    expect(state(at(DAY))).toBe('not_yet_issued')
    expect(state(at(DAY + 1))).toBe('issuance_closed')
    expect(wd.weddingPassIssuanceAllowedAt(wedding, at(-14 * DAY))).toBe(true)
    expect(wd.weddingPassIssuanceAllowedAt(wedding, at(-14 * DAY - 1))).toBe(false)
    expect(wd.weddingPassIssuanceAllowedAt(wedding, at(DAY + 1))).toBe(false)
  })
})

describe('Guest availability state', () => {
  const resolve = (input: Partial<Parameters<typeof wd.resolveUnissuedPassAvailabilityState>[0]>) =>
    wd.resolveUnissuedPassAvailabilityState({ attending: true, weddingDate: wedding, latest: null, now: at(0), ...input })

  test('covers RSVP required, declined, not yet issuable, closed and revoked', () => {
    expect(resolve({ attending: null })).toBe('rsvp_required')
    expect(resolve({ attending: false })).toBe('declined')
    expect(resolve({ now: at(-120 * DAY) })).toBe('not_yet_issuable')
    expect(resolve({ now: at(2 * DAY) })).toBe('issuance_closed')
    expect(resolve({ now: at(2 * DAY), latest: { revokedAt: at(0), revocationReason: 'Lost phone' } })).toBe('revoked')
    // Attendance withdrawal is not an operator revocation.
    expect(resolve({ now: at(2 * DAY), latest: { revokedAt: at(0), revocationReason: ATTENDANCE_WITHDRAWN_REASON } })).toBe('issuance_closed')
  })

  test('availability payload carries a stable code and the window for every client', () => {
    const availability = wd.weddingPassAvailability('not_yet_issuable', wedding)
    expect(availability).toEqual({
      state: 'not_yet_issuable',
      code: 'PASS_NOT_YET_ISSUABLE',
      opensAt: at(-14 * DAY).toISOString(),
      cutoffAt: at(DAY).toISOString(),
      expiresAt: at(1.5 * DAY).toISOString(),
    })
    for (const state of WEDDING_PASS_AVAILABILITY_STATES) {
      expect(wd.weddingPassAvailability(state, wedding).state).toBe(state)
      if (state !== 'active') expect(GUEST_PASS_AVAILABILITY_COPY[state].length).toBeGreaterThan(10)
    }
  })

  test('an unavailable Pass error is not a generic failure', () => {
    const error = new wd.WeddingPassUnavailableError(wd.weddingPassAvailability('not_yet_issuable', wedding))
    expect(error.message).toBe('PASS_NOT_YET_ISSUABLE')
    expect(error.availability.state).toBe('not_yet_issuable')
  })
})

describe('Couple/Planner administrative state', () => {
  const resolve = (input: Partial<Parameters<typeof resolveWeddingPassAdminState>[0]>) =>
    resolveWeddingPassAdminState({ attending: true, weddingDate: wedding, latest: null, householdSize: 2, admittedCount: 0, now: at(0), ...input })

  test('covers every required administrative state', () => {
    expect(resolve({ attending: null })).toBe('pending_rsvp')
    expect(resolve({ attending: false, latest: lifecycle({ revokedAt: at(0), revocationReason: ATTENDANCE_WITHDRAWN_REASON }) })).toBe('declined')
    expect(resolve({ now: at(-30 * DAY) })).toBe('not_yet_issuable')
    expect(resolve({})).toBe('not_yet_issued')
    expect(resolve({ latest: lifecycle() })).toBe('active')
    expect(resolve({ latest: lifecycle({ revokedAt: at(0), revocationReason: 'Lost phone' }) })).toBe('revoked')
    expect(resolve({ latest: lifecycle({ revokedAt: at(0), revocationReason: ATTENDANCE_WITHDRAWN_REASON, supersededAt: at(0) }) })).toBe('superseded')
    expect(resolve({ latest: lifecycle({ supersededAt: at(0) }) })).toBe('superseded')
    expect(resolve({ latest: lifecycle({ expiresAt: at(-1) }) })).toBe('issuance_closed')
    expect(resolve({ latest: lifecycle(), admittedCount: 1 })).toBe('partially_checked_in')
    expect(resolve({ latest: lifecycle(), admittedCount: 2 })).toBe('checked_in')
    for (const label of Object.values(WEDDING_PASS_ADMIN_STATE_LABEL)) expect(label).not.toMatch(/invitation/i)
  })

  test('household expansion matches the Gate attendee keys', () => {
    expect(weddingHouseholdAttendeeKeys({ plusOne: false, kidsAttending: false, kidsCount: 3 })).toEqual(['primary'])
    expect(weddingHouseholdAttendeeKeys({ plusOne: true, kidsAttending: true, kidsCount: 2 })).toEqual(['primary', 'plus-one', 'child-1', 'child-2'])
  })
})

describe('Wedding Pass token containment (source contracts)', () => {
  test('the metadata list never selects bearer material and never issues', async () => {
    const list = withoutComments(await source('src/app/api/planner/wedding-passes/route.ts'))
    // tokenVersion (e.g. "WW2") is metadata; the token itself, nonce and signature are not.
    expect(list).not.toMatch(/\btoken\b(?!Version)|\bnonce\b|signatureHex|SELECT \*/)
    expect(list).not.toContain('ensureWeddingPassCredential')
    expect(list).toContain("requireWeddingPermission(request, 'guests.view')")
  })

  test('the administrative view returns the stored token verbatim and never mints', async () => {
    const view = await source('src/app/api/planner/wedding-passes/view/route.ts')
    expect(view).toContain("requireWeddingPermission(request, 'guests.edit')")
    expect(view).toContain('token: verified.token')
    expect(view).not.toContain('ensureWeddingPassCredential')
    expect(view).toContain("'wedding_pass.viewed'")
    expect(view).not.toMatch(/JSON\.stringify\(\{[^}]*token/)
  })

  test('every Wedding Pass QR encodes the exact credential locally, never through a URL', async () => {
    const guest = await source('src/components/wedding/invitation-experience/wedding-guest-pass-dialog.tsx')
    const admin = await source('src/components/wedding/wedding-pass-administration.tsx')
    expect(guest).toContain('.toDataURL(pass.token,')
    expect(admin).toContain('.toDataURL(viewed.token,')
    for (const surface of [guest, admin]) {
      expect(surface).not.toContain('/api/qrcode')
      expect(surface).not.toMatch(/console\.(log|info|debug)/)
    }
  })

  test('Invitation QR surfaces stay Invitation and never claim to be the Wedding Pass', async () => {
    const manager = await source('src/components/wedding/invitation-manager.tsx')
    const physical = await source('src/components/wedding/physical-invitation-qr.tsx')
    const website = await source('src/components/wedding/qr-gateway.tsx')
    expect(manager).toContain('Open Invitation')
    expect(manager).not.toContain('/api/planner/wedding-passes')
    expect(physical).toContain('Printed Invitation Access')
    expect(website).toContain('Wedding Website QR and sharing')
    for (const surface of [manager, physical, website]) expect(surface).not.toContain('wedding-day/pass')
  })

  test('no export or analytics path reads Wedding Pass credential tokens', async () => {
    const { execSync } = await import('node:child_process')
    const hits = execSync(`grep -rlE 'WeddingPassCredential|weddingPassCredential' src/app src/lib || true`, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .filter((path) => /export|csv|analytics|report/i.test(path))
    expect(hits).toEqual([])
  })
})
