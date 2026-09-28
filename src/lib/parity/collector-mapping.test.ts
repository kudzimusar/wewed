import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { defaultRequiredClientsByLabel, nativeAccessUserId, weddingDayBlockerFromPassProbe } from '@/lib/parity/collector-mapping'

test('native accessUserId is read from authority.identity (QRO02B regression)', () => {
  expect(nativeAccessUserId({ success: true, authority: { identity: { accessUserId: 'user-1' }, workspaceGrants: [] } })).toBe('user-1')
  expect(nativeAccessUserId({ success: true, authority: { accessUserId: 'user-1' } })).toBeNull()
  expect(nativeAccessUserId({})).toBeNull()
  expect(readFileSync('src/lib/production-authority/contract.ts', 'utf8')).toMatch(/identity: \{\s*accessUserId: string/)
  const collector = readFileSync('scripts/parity/wewed-parity.ts', 'utf8')
  expect(collector).toContain('nativeAccessUserId(authority.body)')
  expect(collector).not.toContain('authority.body.authority?.accessUserId')
})

test('Wedding Day activation is a blocker only when the application says so', () => {
  expect(weddingDayBlockerFromPassProbe(503, { code: 'WEDDING_DAY_DISABLED' })).toEqual({ kind: 'wedding-day-activation', state: 'BLOCKED-ACTIVATION', evidence: 'WEDDING_DAY_DISABLED' })
  expect(weddingDayBlockerFromPassProbe(503, { code: 'WEDDING_DAY_KEY_CONFIGURATION_INVALID' })?.evidence).toBe('WEDDING_DAY_KEY_CONFIGURATION_INVALID')
  expect(weddingDayBlockerFromPassProbe(401, { success: false })).toBeNull()               // enabled
  expect(weddingDayBlockerFromPassProbe(401, { protection: {} })).toBeNull()               // Vercel protection is not evidence
  expect(weddingDayBlockerFromPassProbe(409, { code: 'PASS_NOT_YET_ISSUABLE' })).toBeNull()
})

test('default requirements never demand a native-account identity for the Guest', () => {
  expect(defaultRequiredClientsByLabel('P', true)).toEqual({
    G: ['desktop', 'ios', 'android'], P: ['desktop', 'native-api'], 'G-VIA-P': ['desktop', 'native-api'],
  })
  expect(defaultRequiredClientsByLabel(null, true)).toEqual({ G: ['desktop', 'ios', 'android'] })
})
