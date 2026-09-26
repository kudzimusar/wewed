import { describe, expect, test } from 'bun:test'
import {
  checkWewedParityRun,
  emptyParityRecord,
  parityTextDigest,
  passTokenDigest,
  WEWED_PARITY_CONTRACT,
  type ParityClient,
  type WewedParityRecordV1,
  type WewedParityRunV1,
} from '@/lib/parity/wewed-parity-v1'

// Synthetic identifiers only; no real wedding, Guest or account data appears in this contract test.
const SHA = '0123456789abcdef0123456789abcdef01234567'
const ORIGIN = 'https://wewed-git-integration-phase13-live-11-11.vercel.app'
const CLIENTS: ParityClient[] = ['backend', 'desktop', 'ios', 'android']

function guest(client: ParityClient, overrides: Partial<WewedParityRecordV1> = {}): WewedParityRecordV1 {
  return {
    ...emptyParityRecord({ label: 'G', role: 'guest', client, baseUrl: ORIGIN, commitSha: SHA }),
    weddingId: 'wedding-uat-1',
    weddingDate: '2026-12-12',
    weddingTitleDigest: parityTextDigest('Synthetic & Wedding'),
    coupleNamesDigest: parityTextDigest('Partner One & Partner Two'),
    venueDigest: parityTextDigest('Synthetic Venue'),
    guestId: 'guest-g-1',
    guestNameDigest: parityTextDigest('Synthetic Guest'),
    rsvpStatus: 'attending',
    partySize: 2,
    tableId: 'table-7',
    mealChoice: 'beef',
    invitationStyle: 'ivory-floral-gold',
    invitationMessageDigest: parityTextDigest('We would love you to join us.'),
    passAvailability: 'not_yet_issuable',
    ...overrides,
  }
}

function planner(client: ParityClient, overrides: Partial<WewedParityRecordV1> = {}): WewedParityRecordV1 {
  return {
    ...emptyParityRecord({ label: 'P', role: 'planner', client, baseUrl: ORIGIN, commitSha: SHA }),
    accessUserId: 'user-p-1',
    grantId: 'planner:wedding:wedding-uat-1',
    membershipRole: 'planner',
    permissions: ['guests.view', 'planner.view', 'guests.edit'],
    weddingId: 'wedding-uat-1',
    coupleId: 'couple-uat-1',
    weddingDate: '2026-12-12',
    ...overrides,
  }
}

function run(records: WewedParityRecordV1[], extra: Partial<WewedParityRunV1> = {}): WewedParityRunV1 {
  return { contract: WEWED_PARITY_CONTRACT, runId: 'synthetic', requiredClients: CLIENTS, records, ...extra }
}

const codes = (input: unknown) => checkWewedParityRun(input).failures.map((f) => `${f.code}:${f.field ?? ''}`)

describe('wewed.parity.v1 checker', () => {
  test('identical Guest and Planner authority across backend, desktop, iOS and Android passes', () => {
    const result = checkWewedParityRun(
      run([...CLIENTS.map((c) => guest(c)), ...CLIENTS.map((c) => planner(c))], { sameWeddingLabels: ['G', 'P'] }),
    )
    expect(result.failures).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.compared).toEqual({ G: [...CLIENTS].sort(), P: [...CLIENTS].sort() })
  })

  test('permission order is presentation, not authority', () => {
    const records = CLIENTS.map((c, i) => planner(c, { permissions: i % 2 ? ['guests.edit', 'guests.view', 'planner.view'] : undefined }))
    expect(checkWewedParityRun(run(records.map((r) => ({ ...r, permissions: r.permissions ?? ['planner.view', 'guests.view', 'guests.edit'] })))).ok).toBe(true)
  })

  test('different wedding IDs between desktop and native fail', () => {
    expect(codes(run(CLIENTS.map((c) => guest(c, c === 'ios' ? { weddingId: 'wedding-other' } : {})))))
      .toContain('LABEL_MATCH_ID_MISMATCH:weddingId')
  })

  test('the same Guest label resolving different Guest IDs fails', () => {
    expect(codes(run(CLIENTS.map((c) => guest(c, c === 'android' ? { guestId: 'guest-other' } : {})))))
      .toContain('LABEL_MATCH_ID_MISMATCH:guestId')
  })

  test('display names that match while the IDs differ are named explicitly', () => {
    const failures = checkWewedParityRun(run(CLIENTS.map((c) => guest(c, c === 'desktop' ? { guestId: 'guest-twin' } : {})))).failures
    const twin = failures.find((f) => f.field === 'guestId')!
    expect(twin.code).toBe('LABEL_MATCH_ID_MISMATCH')
    expect(twin.message).toContain('same-looking Guest, different authority')
  })

  test('an ID mismatch whose display also differs is still a failure', () => {
    const records = CLIENTS.map((c) =>
      guest(c, c === 'ios' ? { guestId: 'guest-x', guestNameDigest: parityTextDigest('Someone Else') } : {}),
    )
    expect(codes(run(records))).toEqual(expect.arrayContaining(['FIELD_MISMATCH:guestId', 'FIELD_MISMATCH:guestNameDigest']))
  })

  test('RSVP state, party size and table must agree', () => {
    expect(codes(run(CLIENTS.map((c) => guest(c, c === 'ios' ? { rsvpStatus: 'pending' } : {}))))).toContain('FIELD_MISMATCH:rsvpStatus')
    expect(codes(run(CLIENTS.map((c) => guest(c, c === 'android' ? { partySize: 1 } : {}))))).toContain('FIELD_MISMATCH:partySize')
    expect(codes(run(CLIENTS.map((c) => guest(c, c === 'desktop' ? { tableId: 'table-8' } : {}))))).toContain('FIELD_MISMATCH:tableId')
  })

  test('invitation authority (style and authored message) must agree', () => {
    expect(codes(run(CLIENTS.map((c) => guest(c, c === 'ios' ? { invitationStyle: 'midnight' } : {})))))
      .toContain('FIELD_MISMATCH:invitationStyle')
    expect(codes(run(CLIENTS.map((c) => guest(c, c === 'android' ? { invitationMessageDigest: parityTextDigest('fixture text') } : {})))))
      .toContain('FIELD_MISMATCH:invitationMessageDigest')
  })

  test('Pass availability must agree; not_yet_issuable on one client and active on another fails', () => {
    const digest = passTokenDigest('synthetic-credential-bytes')
    const records = CLIENTS.map((c) =>
      guest(c, c === 'android' ? { passAvailability: 'active', passSerial: 'WWSYN-001', passDigest: digest } : {}),
    )
    expect(codes(run(records))).toEqual(expect.arrayContaining(['FIELD_MISMATCH:passAvailability', 'FIELD_MISMATCH:passDigest']))
  })

  test('an active Pass converges only on the identical credential digest', () => {
    const x = passTokenDigest('synthetic-credential-X')
    const y = passTokenDigest('synthetic-credential-Y')
    const active = (c: ParityClient, digest: string) => guest(c, { passAvailability: 'active', passSerial: 'WWSYN-001', passDigest: digest })
    expect(checkWewedParityRun(run(CLIENTS.map((c) => active(c, x)))).ok).toBe(true)
    expect(codes(run(CLIENTS.map((c) => active(c, c === 'ios' ? y : x))))).toContain('FIELD_MISMATCH:passDigest')
    expect(codes(run(CLIENTS.map((c) => guest(c, { passAvailability: 'active', passSerial: 'WWSYN-001' })))))
      .toContain('PASS_DIGEST_REQUIRED:passDigest')
    expect(codes(run(CLIENTS.map((c) => guest(c, { passDigest: x }))))).toContain('PASS_DIGEST_FORBIDDEN:passDigest')
  })

  test('a missing client or an unexpectedly missing grant fails', () => {
    expect(codes(run(CLIENTS.filter((c) => c !== 'android').map((c) => guest(c))))).toContain('CLIENT_MISSING:')
    expect(codes(run(CLIENTS.map((c) => planner(c, c === 'ios' ? { grantId: null } : {})))))
      .toEqual(expect.arrayContaining(['REQUIRED_FIELD_MISSING:grantId', 'FIELD_MISMATCH:grantId']))
  })

  test('materially different permissions fail', () => {
    expect(codes(run(CLIENTS.map((c) => planner(c, c === 'desktop' ? { permissions: ['*'] } : {})))))
      .toContain('FIELD_MISMATCH:permissions')
  })

  test('vendor engagement must agree', () => {
    const vendor = (c: ParityClient, engagement: string) => ({
      ...emptyParityRecord({ label: 'V', role: 'vendor' as const, client: c, baseUrl: ORIGIN, commitSha: SHA }),
      accessUserId: 'user-v', grantId: 'vendor:engagement:e1', businessAccountId: 'ba-1', vendorId: 'vendor-1',
      serviceEngagementId: engagement, weddingId: 'wedding-uat-1',
    })
    expect(checkWewedParityRun(run(CLIENTS.map((c) => vendor(c, 'eng-1')))).ok).toBe(true)
    expect(codes(run(CLIENTS.map((c) => vendor(c, c === 'android' ? 'eng-2' : 'eng-1'))))).toContain('FIELD_MISMATCH:serviceEngagementId')
  })

  test('labels declared to share one wedding must resolve the same weddingId', () => {
    const records = [...CLIENTS.map((c) => guest(c)), ...CLIENTS.map((c) => planner(c, { weddingId: 'wedding-b' }))]
    expect(codes(run(records, { sameWeddingLabels: ['G', 'P'] }))).toContain('CROSS_LABEL_WEDDING_MISMATCH:')
  })

  test('a Guest never carries account identity', () => {
    expect(codes(run(CLIENTS.map((c) => guest(c, { accessUserId: 'user-x' }))))).toContain('RECORD_INVALID:grantId')
  })

  test('records carrying secrets are refused outright', () => {
    const leaks: Array<Record<string, unknown>> = [
      { ...guest('ios'), passSerial: 'WW2.abc.def' },
      { ...guest('ios'), token: 'anything' },
      { ...guest('ios'), sessionToken: 'x' },
      { ...guest('ios'), mealChoice: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig' },
      { ...guest('ios'), baseUrl: 'https://wewed.pro/invite/s?rsvp=PRIVATE' },
      { ...guest('ios'), mealChoice: 'wewed_wedding_guest=abc' },
    ]
    for (const leak of leaks) {
      const result = checkWewedParityRun(run([leak as unknown as WewedParityRecordV1]))
      expect(result.ok).toBe(false)
      expect(result.failures.some((f) => f.code === 'SECRET_MATERIAL')).toBe(true)
    }
  })

  test('shape is strict: unknown fields, omitted fields and non-digest text are refused', () => {
    expect(codes(run([{ ...guest('ios'), guestName: 'Plain Name' } as unknown as WewedParityRecordV1]))).toContain('RECORD_INVALID:guestName')
    const { tableId: _omitted, ...withoutTable } = guest('ios')
    expect(codes(run([withoutTable as unknown as WewedParityRecordV1]))).toContain('RECORD_INVALID:tableId')
    expect(codes(run([guest('ios', { guestNameDigest: 'Synthetic Guest' })]))).toContain('RECORD_INVALID:guestNameDigest')
    expect(checkWewedParityRun({ contract: 'other' }).failures[0].code).toBe('CONTRACT_INVALID')
  })

  test('digests are stable under presentation-only differences and never reversible text', () => {
    expect(parityTextDigest('  Charity   &  Kudzie ')).toBe(parityTextDigest('charity & kudzie'))
    expect(parityTextDigest('A')).not.toBe(parityTextDigest('B'))
    expect(parityTextDigest('')).toBeNull()
    expect(passTokenDigest('x')).toMatch(/^[0-9a-f]{64}$/)
  })
})

import { readFileSync } from 'node:fs'
import { WEWED_PARITY_FIELDS } from '@/lib/parity/wewed-parity-v1'

test('the shared cross-language contract file mirrors the checker exactly', () => {
  const shared = JSON.parse(readFileSync('mobile/contracts/wewed-parity-v1.json', 'utf8'))
  expect(shared.fields).toEqual([...WEWED_PARITY_FIELDS])
  for (const vector of shared.textDigestVectors) expect(parityTextDigest(vector.input)).toBe(vector.digest)
  expect(passTokenDigest(shared.passDigestVector.input)).toBe(shared.passDigestVector.digest)
  expect(Object.keys(emptyParityRecord({ label: 'G', role: 'guest', client: 'ios', baseUrl: 'http://127.0.0.1:1', commitSha: 'abcdef1' })))
    .toEqual([...WEWED_PARITY_FIELDS])
})

describe('QRO02B1 — actor-specific required clients', () => {
  const guestRun = (clients: ParityClient[], extra: Partial<WewedParityRunV1> = {}) =>
    run(clients.map((c) => guest(c, { passAvailability: 'not_yet_issuable' })), {
      requiredClients: ['desktop', 'native-api'],
      requiredClientsByLabel: { G: ['desktop', 'ios', 'android'] },
      ...extra,
    })

  test('a Guest requires desktop + iOS + Android and never a native-account identity', () => {
    expect(checkWewedParityRun(guestRun(['desktop', 'ios', 'android'])).ok).toBe(true)
  })

  test('a genuinely required client that is missing still fails', () => {
    expect(codes(guestRun(['desktop', 'ios']))).toContain('CLIENT_MISSING:')
  })

  test('a required actor with no records at all fails', () => {
    const result = checkWewedParityRun(guestRun(['desktop', 'ios', 'android'], {
      requiredClientsByLabel: { G: ['desktop', 'ios', 'android'], P: ['desktop', 'native-api', 'ios', 'android'] },
    }))
    expect(result.failures.some((f) => f.code === 'CLIENT_MISSING' && f.label === 'P')).toBe(true)
  })

  test('the Planner can still require all four clients while the Guest requires three', () => {
    const records = [
      ...(['desktop', 'ios', 'android'] as ParityClient[]).map((c) => guest(c, { passAvailability: 'not_yet_issuable' })),
      ...(['desktop', 'native-api', 'ios', 'android'] as ParityClient[]).map((c) => planner(c)),
    ]
    const r = run(records, {
      requiredClients: ['desktop', 'native-api'],
      requiredClientsByLabel: { G: ['desktop', 'ios', 'android'], P: ['desktop', 'native-api', 'ios', 'android'] },
      sameWeddingLabels: ['G', 'P'],
    })
    expect(checkWewedParityRun(r).failures).toEqual([])
    const missingIos = { ...r, records: records.filter((x) => !(x.label === 'P' && x.client === 'ios')) }
    expect(checkWewedParityRun(missingIos).failures.map((f) => `${f.code}:${f.label}`)).toContain('CLIENT_MISSING:P')
  })

  test('different IDs still fail under actor-specific requirements', () => {
    const records = (['desktop', 'ios', 'android'] as ParityClient[]).map((c) =>
      guest(c, { passAvailability: 'not_yet_issuable', ...(c === 'android' ? { guestId: 'guest-other' } : {}) }))
    expect(codes(run(records, { requiredClientsByLabel: { G: ['desktop', 'ios', 'android'] } }))).toContain('LABEL_MATCH_ID_MISMATCH:guestId')
  })

  test('malformed requirement maps are refused', () => {
    expect(codes(run([], { requiredClientsByLabel: { G: [] } }))).toEqual(['CONTRACT_INVALID:'])
    expect(codes(run([], { requiredClientsByLabel: { G: ['fax' as ParityClient] } }))).toEqual(['CONTRACT_INVALID:'])
  })
})

describe('QRO02B1 — Wedding Day BLOCKED-ACTIVATION is separate from Pass availability', () => {
  const blocked = { blockers: [{ kind: 'wedding-day-activation' as const, state: 'BLOCKED-ACTIVATION' as const, evidence: 'WEDDING_DAY_DISABLED' as const }] }
  const unobserved = (c: ParityClient, o: Partial<WewedParityRecordV1> = {}) => guest(c, { passAvailability: null, ...o })
  const trio: ParityClient[] = ['desktop', 'ios', 'android']
  const byLabel = { requiredClientsByLabel: { G: trio } }

  test('without the blocker an unobserved Pass is still REQUIRED_FIELD_MISSING', () => {
    expect(codes(run(trio.map((c) => unobserved(c)), byLabel))).toContain('REQUIRED_FIELD_MISSING:passAvailability')
  })

  test('with the blocker an unobserved Pass is not a failure and everything else still is', () => {
    expect(checkWewedParityRun(run(trio.map((c) => unobserved(c)), { ...byLabel, ...blocked })).ok).toBe(true)
    expect(codes(run(trio.map((c) => unobserved(c, c === 'ios' ? { tableId: null } : {})), { ...byLabel, ...blocked })))
      .toEqual(expect.arrayContaining(['FIELD_MISMATCH:tableId']))
    expect(codes(run(trio.map((c) => unobserved(c, c === 'ios' ? { guestId: null } : {})), { ...byLabel, ...blocked })))
      .toContain('REQUIRED_FIELD_MISSING:guestId')
    expect(codes(run(['desktop', 'ios'].map((c) => unobserved(c as ParityClient)), { ...byLabel, ...blocked }))).toContain('CLIENT_MISSING:')
  })

  test('a client that observed a business Pass state contradicts the blocker', () => {
    expect(codes(run(trio.map((c) => unobserved(c, c === 'android' ? { passAvailability: 'not_yet_issuable' } : {})), { ...byLabel, ...blocked })))
      .toContain('BLOCKER_CONTRADICTED:passAvailability')
  })

  test('passAvailability never accepts a blocker as a business value, and blockers are validated', () => {
    expect(codes(run([guest('ios', { passAvailability: 'blocked_activation' as never })], byLabel))).toContain('RECORD_INVALID:passAvailability')
    expect(codes(run([], { blockers: [{ kind: 'wedding-day-activation', state: 'BLOCKED-ACTIVATION', evidence: 'ANYTHING' as never }] })))
      .toEqual(['CONTRACT_INVALID:'])
  })

  test('when Wedding Day is active the ordinary Pass rules return', () => {
    const digest = passTokenDigest('synthetic-credential')
    const active = (c: ParityClient) => guest(c, { passAvailability: 'active', passSerial: 'WWSYN-001', passDigest: digest })
    expect(checkWewedParityRun(run(trio.map(active), byLabel)).ok).toBe(true)
    expect(codes(run(trio.map((c) => guest(c, { passAvailability: 'active', passSerial: 'WWSYN-001' })), byLabel))).toContain('PASS_DIGEST_REQUIRED:passDigest')
    expect(codes(run(trio.map((c) => guest(c, { passAvailability: 'not_yet_issuable', passDigest: digest })), byLabel))).toContain('PASS_DIGEST_FORBIDDEN:passDigest')
  })
})
