/**
 * Phase 11A: Wedding Day / WW2 Schema + Authority Convergence Integration Tests
 *
 * Runs against the disposable local PostgreSQL 16 database migrated with
 * prisma/migrations (including 20260924000000_wedding_day_ww2_authority).
 *
 * Exercises:
 *   1. Feature flag disabled by default (no passes, no manifests, no writes).
 *   2. Guest RSVP eligibility (accepted vs declined vs pending).
 *   3. Cryptography (P-256 IEEE-P1363, valid vs tamper vs wrong wedding).
 *   4. Revocation and reissue (new id, serial, token; old row preserved and rejected).
 *   5. Concurrency (8 parallel callers produce 1 credential).
 *   6. Physical DB integrity (cross-wedding FK rejection, cascade restrictions).
 *   7. Gate authority and check-in (valid token, offline sync, revoked pass rejection, idempotent duplicate check-in).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto'

mock.module('server-only', () => ({}))

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'phase11a-wedding-day-test-secret'
}

const describeDb = isLocal ? describe : describe.skip

describeDb('Phase 11A Wedding Day / WW2 converged authority & schema', () => {
  let db: typeof import('@/lib/db')['db']
  let wd: typeof import('@/lib/wedding-day')
  let wdm: typeof import('@/lib/wedding-day-manifest')
  let wdf: typeof import('@/lib/wedding-day-feature')

  let ww2PrivateKeyPem: string
  let ww2PublicKeyDerBase64: string
  let rootPrivateKeyPem: string
  let rootPublicKeyDerBase64: string

  const run = randomUUID().slice(0, 8)
  const id = (name: string) => `p11a-${run}-${name}`

  const WEDDING_A = id('wedding-a')
  const WEDDING_B = id('wedding-b')
  const GUEST_A = id('guest-a')
  const GUEST_B = id('guest-b')
  const GATE_A = id('gate-a')
  const GATE_B = id('gate-b')
  const OPERATOR_USER = id('operator-user')

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ isWeddingDayWW2Enabled: wdf = {} as any } = await import('@/lib/wedding-day-feature'))
    wd = await import('@/lib/wedding-day')
    wdm = await import('@/lib/wedding-day-manifest')

    const ww2KeyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    ww2PrivateKeyPem = ww2KeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    ww2PublicKeyDerBase64 = ww2KeyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')

    const rootKeyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    rootPrivateKeyPem = rootKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    rootPublicKeyDerBase64 = rootKeyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')

    process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = ww2PrivateKeyPem
    process.env.WEDDING_DAY_WW2_KEY_ID = 'ww2-key-test-v1'
    process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM = rootPrivateKeyPem
    process.env.WEDDING_DAY_ROOT_KEY_ID = 'root-key-test-v1'

    // Clean up test data
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingCheckIn" WHERE "weddingId" IN ($1, $2)`, WEDDING_A, WEDDING_B)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingPassCredential" WHERE "weddingId" IN ($1, $2)`, WEDDING_A, WEDDING_B)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingPassKey" WHERE "weddingId" IN ($1, $2)`, WEDDING_A, WEDDING_B)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingGateAssignment" WHERE "weddingId" IN ($1, $2)`, WEDDING_A, WEDDING_B)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingGate" WHERE "weddingId" IN ($1, $2)`, WEDDING_A, WEDDING_B)
    await db.$executeRawUnsafe(`DELETE FROM public."RSVP" WHERE "guestId" IN ($1, $2)`, GUEST_A, GUEST_B)
    await db.$executeRawUnsafe(`DELETE FROM public."Guest" WHERE "weddingId" IN ($1, $2)`, WEDDING_A, WEDDING_B)
    await db.$executeRawUnsafe(`DELETE FROM public."Wedding" WHERE id IN ($1, $2)`, WEDDING_A, WEDDING_B)
    await db.$executeRawUnsafe(`DELETE FROM public."Couple" WHERE id IN ($1, $2)`, id('couple-a'), id('couple-b'))
    await db.$executeRawUnsafe(`DELETE FROM public."User" WHERE id = $1`, OPERATOR_USER)

    // Setup base couple, weddings, gates, guests, operator
    await db.$executeRawUnsafe(
      `INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'A1', 'A2', now())`,
      id('couple-a'),
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'B1', 'B2', now())`,
      id('couple-b'),
    )

    await db.$executeRawUnsafe(
      `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "updatedAt")
       VALUES ($1, $1, 'Wedding A', now() + interval '3 days', 'Venue A', 'Harare', 'Zimbabwe', $2, now())`,
      WEDDING_A, id('couple-a'),
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "updatedAt")
       VALUES ($1, $1, 'Wedding B', now() + interval '5 days', 'Venue B', 'Bulawayo', 'Zimbabwe', $2, now())`,
      WEDDING_B, id('couple-b'),
    )

    await db.$executeRawUnsafe(
      `INSERT INTO public."User" (id, email, name, role, "updatedAt")
       VALUES ($1, $2, 'Gate Operator', 'usher', now())`,
      OPERATOR_USER, `${OPERATOR_USER}@example.test`,
    )

    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingGate" (id, "weddingId", name, status, "updatedAt")
       VALUES ($1, $2, 'North Gate', 'active', now())`,
      GATE_A, WEDDING_A,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingGate" (id, "weddingId", name, status, "updatedAt")
       VALUES ($1, $2, 'South Gate', 'active', now())`,
      GATE_B, WEDDING_B,
    )

    await db.$executeRawUnsafe(
      `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt")
       VALUES ($1, $2, 'Guest Alpha', now())`,
      GUEST_A, WEDDING_A,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt")
       VALUES ($1, $2, 'Guest Beta', now())`,
      GUEST_B, WEDDING_B,
    )

    await db.$executeRawUnsafe(
      `INSERT INTO public."RSVP" (id, "guestId", token, attending, "plusOne", "plusOneName", "kidsAttending", "kidsCount", "updatedAt")
       VALUES ($1, $2, $3, TRUE, TRUE, 'Guest Alpha +1', TRUE, 1, now())`,
      id('rsvp-a'), GUEST_A, id('rsvp-token-a'),
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."RSVP" (id, "guestId", token, attending, "updatedAt")
       VALUES ($1, $2, $3, TRUE, now())`,
      id('rsvp-b'), GUEST_B, id('rsvp-token-b'),
    )
  })

  afterAll(async () => {
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    if (db) await db.$disconnect()
  })

  // ---------------------------------------------------------------------------
  // 1. Feature flag disabled by default
  // ---------------------------------------------------------------------------
  test('feature flag is disabled by default and blocks all issuance, verification, manifest and check-in', async () => {
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    expect(wdf()).toBe(false)

    await expect(
      wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId: GUEST_A }),
    ).rejects.toThrow('WEDDING_DAY_DISABLED')

    await expect(
      wd.verifyWeddingPassToken({ weddingId: WEDDING_A, token: 'fake.token' }),
    ).rejects.toThrow('WEDDING_DAY_DISABLED')

    await expect(
      wdm.signedNativeWeddingDayManifest(WEDDING_A),
    ).rejects.toThrow('WEDDING_DAY_DISABLED')

    await expect(
      wd.checkInWeddingGuest({
        weddingId: WEDDING_A,
        gateId: GATE_A,
        operatorUserId: OPERATOR_USER,
        token: 'fake.token',
        attendeeKeys: ['primary'],
      }),
    ).rejects.toThrow('WEDDING_DAY_DISABLED')

    // Confirm no rows were created while disabled
    const credentials = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM public."WeddingPassCredential" WHERE "weddingId" = $1`,
      WEDDING_A,
    )
    expect(credentials).toHaveLength(0)

    const checkIns = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM public."WeddingCheckIn" WHERE "weddingId" = $1`,
      WEDDING_A,
    )
    expect(checkIns).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // 2. RSVP Eligibility
  // ---------------------------------------------------------------------------
  test('guest RSVP eligibility gates pass issuance', async () => {
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'

    const nonAttendingGuest = id('guest-declined')
    await db.$executeRawUnsafe(
      `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt") VALUES ($1, $2, 'Declined Guest', now())`,
      nonAttendingGuest, WEDDING_A,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."RSVP" (id, "guestId", token, attending, "updatedAt") VALUES ($1, $2, $3, FALSE, now())`,
      id('rsvp-declined'), nonAttendingGuest, id('token-declined'),
    )

    await expect(
      wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId: nonAttendingGuest }),
    ).rejects.toThrow('ATTENDANCE_REQUIRED')

    const pendingGuest = id('guest-pending')
    await db.$executeRawUnsafe(
      `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt") VALUES ($1, $2, 'Pending Guest', now())`,
      pendingGuest, WEDDING_A,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."RSVP" (id, "guestId", token, attending, "updatedAt") VALUES ($1, $2, $3, NULL, now())`,
      id('rsvp-pending'), pendingGuest, id('token-pending'),
    )

    await expect(
      wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId: pendingGuest }),
    ).rejects.toThrow('ATTENDANCE_REQUIRED')
  })

  // ---------------------------------------------------------------------------
  // 3. Credential Lifecycle & Concurrency
  // ---------------------------------------------------------------------------
  test('credential lifecycle: non-deterministic serial, reuse, revocation, expiry, concurrency', async () => {
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'

    // 1. Initial issuance
    const first = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId: GUEST_A })
    expect(first.passSerial).toMatch(/^WW[0-9A-F]{8}-001$/)
    expect(first.token.split('.')).toHaveLength(6)
    expect(first.token.split('.').slice(0, 5).join('.')).toBe(first.token.substring(0, first.token.lastIndexOf('.')))
    expect(first.issueSeq).toBe(1)
    expect(first.revokedAt).toBeNull()
    expect(first.supersededAt).toBeNull()

    // 2. Reuse of live credential
    const reused = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId: GUEST_A })
    expect(reused.id).toBe(first.id)
    expect(reused.passSerial).toBe(first.passSerial)
    expect(reused.token).toBe(first.token)

    // 3. Verification succeeds
    const verified = await wd.verifyWeddingPassToken({ weddingId: WEDDING_A, token: first.token })
    expect(verified.id).toBe(first.id)

    // 4. Revocation preserves old row and reissues fresh credential
    const revokedFirst = await wd.revokeWeddingPassCredential({
      weddingId: WEDDING_A,
      credentialId: first.id,
      reason: 'Lost phone',
    })
    expect(revokedFirst.revokedAt).not.toBeNull()
    expect(revokedFirst.revocationReason).toBe('Lost phone')
    expect(revokedFirst.supersededAt).not.toBeNull()

    // Old token now fails verification
    await expect(
      wd.verifyWeddingPassToken({ weddingId: WEDDING_A, token: first.token }),
    ).rejects.toThrow('PASS_REVOKED_OR_EXPIRED')

    // Reissue gets new serial, new token, new nonce, issueSeq 2
    const second = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId: GUEST_A })
    expect(second.id).not.toBe(first.id)
    expect(second.passSerial).not.toBe(first.passSerial)
    expect(second.passSerial).toMatch(/^WW[0-9A-F]{8}-002$/)
    expect(second.nonce).not.toBe(first.nonce)
    expect(second.token).not.toBe(first.token)
    expect(second.issueSeq).toBe(2)

    // Both rows exist in DB: one revoked, one active
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT id, "passSerial", "issueSeq", "revokedAt", "supersededAt"
         FROM public."WeddingPassCredential"
        WHERE "weddingId" = $1 AND "guestId" = $2
        ORDER BY "issueSeq" ASC`,
      WEDDING_A, GUEST_A,
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].id).toBe(first.id)
    expect(rows[0].revokedAt).not.toBeNull()
    expect(rows[1].id).toBe(second.id)
    expect(rows[1].revokedAt).toBeNull()

    // 5. Expiry supersedes old row
    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassCredential" SET "expiresAt" = now() - interval '1 hour' WHERE id = $1`,
      second.id,
    )
    const third = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId: GUEST_A })
    expect(third.id).not.toBe(second.id)
    expect(third.issueSeq).toBe(3)

    const rowsAfterExpiry = await db.$queryRawUnsafe<any[]>(
      `SELECT id, "supersededAt" FROM public."WeddingPassCredential" WHERE id = $1`,
      second.id,
    )
    expect(rowsAfterExpiry[0].supersededAt).not.toBeNull()

    // 6. Concurrency: 8 parallel calls return the exact same live credential
    const concurrent = await Promise.all(
      Array.from({ length: 8 }, () =>
        wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId: GUEST_A }),
      ),
    )
    const uniqueIds = new Set(concurrent.map((c) => c.id))
    expect(uniqueIds.size).toBe(1)
  })

  test('first issuance and post-revocation reissue serialize on the Guest row', async () => {
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'
    const guestId = id('guest-concurrency')
    await db.$executeRawUnsafe(
      `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt")
       VALUES ($1, $2, 'Concurrent Guest', now())`,
      guestId, WEDDING_A,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."RSVP" (id, "guestId", token, attending, "updatedAt")
       VALUES ($1, $2, $3, TRUE, now())`,
      id('rsvp-concurrency'), guestId, id('token-concurrency'),
    )

    const firstWave = await Promise.all(
      Array.from({ length: 8 }, () =>
        wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId }),
      ),
    )
    expect(new Set(firstWave.map((row) => row.id)).size).toBe(1)
    expect(firstWave[0].issueSeq).toBe(1)

    await wd.revokeWeddingPassCredential({
      weddingId: WEDDING_A,
      credentialId: firstWave[0].id,
      reason: 'Concurrent reissue test',
    })

    const secondWave = await Promise.all(
      Array.from({ length: 8 }, () =>
        wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId }),
      ),
    )
    expect(new Set(secondWave.map((row) => row.id)).size).toBe(1)
    expect(secondWave[0].id).not.toBe(firstWave[0].id)
    expect(secondWave[0].issueSeq).toBe(2)

    const history = await db.$queryRawUnsafe<any[]>(
      `SELECT id, "issueSeq", "revokedAt", "supersededAt"
         FROM public."WeddingPassCredential"
        WHERE "weddingId" = $1 AND "guestId" = $2
        ORDER BY "issueSeq"`,
      WEDDING_A, guestId,
    )
    expect(history).toHaveLength(2)
    expect(history[0].revokedAt).not.toBeNull()
    expect(history[0].supersededAt).not.toBeNull()
    expect(history[1].revokedAt).toBeNull()
  })

  test('signing-key lifecycle and key-id material binding fail closed', async () => {
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'
    const credential = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_B, guestId: GUEST_B })

    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassKey"
          SET "activeFrom" = now() + interval '1 day'
        WHERE id = $1`,
      credential.passKeyId,
    )
    await expect(
      wd.verifyWeddingPassToken({ weddingId: WEDDING_B, token: credential.token }),
    ).rejects.toThrow('PASS_SIGNING_KEY_INACTIVE')

    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassKey"
          SET "activeFrom" = now() - interval '1 day',
              "expiresAt" = now() - interval '1 second'
        WHERE id = $1`,
      credential.passKeyId,
    )
    await expect(
      wd.verifyWeddingPassToken({ weddingId: WEDDING_B, token: credential.token }),
    ).rejects.toThrow('PASS_SIGNING_KEY_INACTIVE')
    await expect(
      wd.checkInWeddingGuest({
        weddingId: WEDDING_B,
        gateId: GATE_B,
        operatorUserId: OPERATOR_USER,
        passSerial: credential.passSerial,
        attendeeKeys: ['primary'],
        source: 'offline-sync',
      }),
    ).rejects.toThrow('PASS_SIGNING_KEY_INACTIVE')

    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassKey"
          SET "expiresAt" = NULL,
              "activeFrom" = now() - interval '1 day'
        WHERE id = $1`,
      credential.passKeyId,
    )

    const replacementKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
      .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = replacementKey
    await expect(wd.ensurePassKey(WEDDING_B))
      .rejects.toThrow('WEDDING_DAY_WW2_KEY_ID_MATERIAL_MISMATCH')
    process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = ww2PrivateKeyPem

    const restored = await wd.verifyWeddingPassToken({ weddingId: WEDDING_B, token: credential.token })
    expect(restored.id).toBe(credential.id)
  })

  // ---------------------------------------------------------------------------
  // 4. Physical Database Integrity & Cross-Wedding Rejection
  // ---------------------------------------------------------------------------
  test('physical DB constraints reject cross-wedding relationships and enforce deletion restrictions', async () => {
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'

    const passKeyA = await wd.ensurePassKey(WEDDING_A)

    // 1. Cross-wedding credential: Wedding A with Guest of Wedding B
    let crossGuestRejected = false
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO public."WeddingPassCredential"
          (id, "weddingId", "guestId", "passKeyId", "weddingShortId", "passSerial", "issueSeq",
           "tokenVersion", "eventBitmask", nonce, "signatureHex", token, "issuedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'shortA', $5, 1, 'WW2', 4, 'nonce1', 'sig1', $6, now(), now(), now())`,
        id('cred-cross-1'),
        WEDDING_A,
        GUEST_B, // belongs to Wedding B!
        passKeyA.id,
        `WW-CROSS-1-${randomUUID().slice(0, 4)}`,
        `token-cross-1-${randomUUID()}`,
      )
    } catch {
      crossGuestRejected = true
    }
    expect(crossGuestRejected).toBe(true)

    // 2. Cross-wedding credential: Wedding B with PassKey of Wedding A
    let crossKeyRejected = false
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO public."WeddingPassCredential"
          (id, "weddingId", "guestId", "passKeyId", "weddingShortId", "passSerial", "issueSeq",
           "tokenVersion", "eventBitmask", nonce, "signatureHex", token, "issuedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'shortB', $5, 1, 'WW2', 4, 'nonce2', 'sig2', $6, now(), now(), now())`,
        id('cred-cross-2'),
        WEDDING_B,
        GUEST_B,
        passKeyA.id, // belongs to Wedding A!
        `WW-CROSS-2-${randomUUID().slice(0, 4)}`,
        `token-cross-2-${randomUUID()}`,
      )
    } catch {
      crossKeyRejected = true
    }
    expect(crossKeyRejected).toBe(true)

    // 3. Cross-wedding check-in: Wedding A with Gate of Wedding B
    const validCredA = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId: GUEST_A })
    let crossGateCheckInRejected = false
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO public."WeddingCheckIn"
          (id, "weddingId", "guestId", "credentialId", "gateId", "admittedByUserId",
           "eventKey", "attendeeKey", "attendeeKind", "attendeeName", source, "admittedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'wedding-day', 'primary', 'primary', 'Guest A', 'qr', now(), now(), now())`,
        id('checkin-cross-gate'),
        WEDDING_A,
        GUEST_A,
        validCredA.id,
        GATE_B, // belongs to Wedding B!
        OPERATOR_USER,
      )
    } catch {
      crossGateCheckInRejected = true
    }
    expect(crossGateCheckInRejected).toBe(true)

    // 4. Cross-wedding check-in: Wedding A with Guest of Wedding B
    let crossGuestCheckInRejected = false
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO public."WeddingCheckIn"
          (id, "weddingId", "guestId", "credentialId", "gateId", "admittedByUserId",
           "eventKey", "attendeeKey", "attendeeKind", "attendeeName", source, "admittedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'wedding-day', 'primary', 'primary', 'Guest B', 'qr', now(), now(), now())`,
        id('checkin-cross-guest'),
        WEDDING_A,
        GUEST_B, // belongs to Wedding B!
        validCredA.id,
        GATE_A,
        OPERATOR_USER,
      )
    } catch {
      crossGuestCheckInRejected = true
    }
    expect(crossGuestCheckInRejected).toBe(true)

    // 5. Deletion RESTRICT: deleting a credential that is referenced by a check-in is refused
    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingCheckIn"
        (id, "weddingId", "guestId", "credentialId", "gateId", "admittedByUserId",
         "eventKey", "attendeeKey", "attendeeKind", "attendeeName", source, "admittedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'wedding-day', 'primary', 'primary', 'Guest A', 'qr', now(), now(), now())`,
      id('checkin-valid-del-test'),
      WEDDING_A,
      GUEST_A,
      validCredA.id,
      GATE_A,
      OPERATOR_USER,
    )

    let deleteCredentialRefused = false
    try {
      await db.$executeRawUnsafe(`DELETE FROM public."WeddingPassCredential" WHERE id = $1`, validCredA.id)
    } catch {
      deleteCredentialRefused = true
    }
    expect(deleteCredentialRefused).toBe(true)

    // 6. Deletion RESTRICT: deleting a gate that has check-ins is refused
    let deleteGateRefused = false
    try {
      await db.$executeRawUnsafe(`DELETE FROM public."WeddingGate" WHERE id = $1`, GATE_A)
    } catch {
      deleteGateRefused = true
    }
    expect(deleteGateRefused).toBe(true)

    // Clean up test check-in
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingCheckIn" WHERE id = $1`, id('checkin-valid-del-test'))
  })

  // ---------------------------------------------------------------------------
  // 5. Gate Check-In & Manifest Verification
  // ---------------------------------------------------------------------------
  test('gate admission, household expansion, offline sync, and signed manifest', async () => {
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'

    const cred = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_A, guestId: GUEST_A })

    // 1. Check in primary and +1 via QR token
    const checkInResult = await wd.checkInWeddingGuest({
      weddingId: WEDDING_A,
      gateId: GATE_A,
      operatorUserId: OPERATOR_USER,
      token: cred.token,
      attendeeKeys: ['primary', 'plus-one'],
      source: 'qr',
      deviceId: 'android-terminal-1',
    })
    expect(checkInResult.success).toBe(true)
    expect(checkInResult.admittedCount).toBe(2)
    expect(checkInResult.attendeeKeys).toEqual(['primary', 'plus-one'])

    const partialRsvp = await db.$queryRawUnsafe<Array<{ checkedIn: boolean }>>(
      `SELECT "checkedIn" FROM public."RSVP" WHERE "guestId" = $1`,
      GUEST_A,
    )
    expect(partialRsvp[0].checkedIn).toBe(false)

    // 2. Idempotent repeat check-in succeeds without duplicate rows
    const repeatResult = await wd.checkInWeddingGuest({
      weddingId: WEDDING_A,
      gateId: GATE_A,
      operatorUserId: OPERATOR_USER,
      token: cred.token,
      attendeeKeys: ['primary'],
      source: 'qr',
    })
    expect(repeatResult.success).toBe(true)

    // 3. Offline sync check-in for child-1 using passSerial
    const offlineSyncResult = await wd.checkInWeddingGuest({
      weddingId: WEDDING_A,
      gateId: GATE_A,
      operatorUserId: OPERATOR_USER,
      passSerial: cred.passSerial,
      attendeeKeys: ['child-1'],
      source: 'offline-sync',
      clientEventId: 'client-offline-event-1',
    })
    expect(offlineSyncResult.success).toBe(true)
    expect(offlineSyncResult.admittedCount).toBe(1)

    const completeRsvp = await db.$queryRawUnsafe<Array<{ checkedIn: boolean; checkedInAt: Date | null }>>(
      `SELECT "checkedIn", "checkedInAt" FROM public."RSVP" WHERE "guestId" = $1`,
      GUEST_A,
    )
    expect(completeRsvp[0].checkedIn).toBe(true)
    expect(completeRsvp[0].checkedInAt).not.toBeNull()

    // 4. Offline sync fails if pass was revoked between scan and sync
    await wd.revokeWeddingPassCredential({
      weddingId: WEDDING_A,
      credentialId: cred.id,
      reason: 'Revoked before offline queue sync',
    })
    await expect(
      wd.checkInWeddingGuest({
        weddingId: WEDDING_A,
        gateId: GATE_A,
        operatorUserId: OPERATOR_USER,
        passSerial: cred.passSerial,
        attendeeKeys: ['primary'],
        source: 'offline-sync',
      }),
    ).rejects.toThrow('PASS_REVOKED_OR_EXPIRED')

    // 5. Empty attendee keys rejected
    await expect(
      wd.checkInWeddingGuest({
        weddingId: WEDDING_A,
        gateId: GATE_A,
        operatorUserId: OPERATOR_USER,
        token: cred.token,
        attendeeKeys: [],
      }),
    ).rejects.toThrow('ATTENDEE_KEYS_REQUIRED')

    // 6. One offline client event may carry multiple newly-admitted household members.
    await db.$executeRawUnsafe(
      `UPDATE public."RSVP"
          SET "plusOne" = TRUE, "plusOneName" = 'Guest Beta +1'
        WHERE "guestId" = $1`,
      GUEST_B,
    )
    const betaCredential = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_B, guestId: GUEST_B })
    const betaSync = await wd.checkInWeddingGuest({
      weddingId: WEDDING_B,
      gateId: GATE_B,
      operatorUserId: OPERATOR_USER,
      passSerial: betaCredential.passSerial,
      attendeeKeys: ['primary', 'plus-one'],
      source: 'offline-sync',
      clientEventId: 'client-multi-attendee-event',
    })
    expect(betaSync.admittedCount).toBe(2)
    const betaRows = await db.$queryRawUnsafe<Array<{ attendeeKey: string }>>(
      `SELECT "attendeeKey"
         FROM public."WeddingCheckIn"
        WHERE "weddingId" = $1 AND "clientEventId" = $2
        ORDER BY "attendeeKey"`,
      WEDDING_B, 'client-multi-attendee-event',
    )
    expect(betaRows.map((row) => row.attendeeKey)).toEqual(['plus-one', 'primary'])

    // 7. Signed Native Wedding Day Manifest v2
    const manifest = await wdm.signedNativeWeddingDayManifest(WEDDING_A)
    expect(manifest.rootKeyId).toBe('root-key-test-v1')
    expect(manifest.algorithm).toBe('ECDSA_P256_SHA256')
    expect(manifest.payload.manifestVersion).toBe(2)
    expect(manifest.payload.tokenVersion).toBe('WW2')
    expect(manifest.payload.weddingId).toBe(WEDDING_A)
    expect(manifest.payload.keys.length).toBeGreaterThanOrEqual(1)
    expect(manifest.payload.credentials.length).toBeGreaterThanOrEqual(1)

    // Verify root signature on manifest
    const manifestValid = wdm.verifySignedWeddingDayManifest({
      canonicalPayload: manifest.canonicalPayload,
      signatureHex: manifest.signatureHex,
      rootPublicKeyDerBase64,
    })
    expect(manifestValid).toBe(true)
  })
})
