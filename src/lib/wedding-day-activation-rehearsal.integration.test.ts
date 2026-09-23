/**
 * Phase 11B: Wedding Day / WW2 Non-Production Activation & Readiness Rehearsal
 *
 * Full synthetic end-to-end rehearsal against local disposable PostgreSQL 16:
 *   1. Key Environment Preflight (safe inspection, P-256 verification, fingerprinting, 0 secret leak)
 *   2. Database Schema Preflight (clean schema check, 0 orphaned rows)
 *   3. Feature Flag OFF Default (503 across all routes & operations, 0 rows created)
 *   4. Safe Controlled Activation (ordered sequence with synthetic keys)
 *   5. Guest RSVP & Pass Issuance (canonical dot wire format: WW2.<shortId>.<serial>.<maskHex>.<nonce>.<sigHex>)
 *   6. Gate Manifest Generation & Root Cryptographic Verification (IEEE P1363 P-256 signature verification)
 *   7. Offline Gate Admission Simulation (manifest-backed cryptographic token verification)
 *   8. Reconnect Check-in Sync & Idempotency (operator derived from gate grant, duplicate event deduplication)
 *   9. Complete Household RSVP Check-in (multi-member check-in, RSVP status convergence)
 *  10. Credential Revocation & Reissue Isolation (gate operator revocation, rejection of revoked token, clean reissue)
 *  11. Rollback & Containment Rehearsal (feature flag OFF fail-closed, DB data preservation)
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  verify as cryptoVerify,
} from 'node:crypto'
import { NextRequest } from 'next/server'

mock.module('server-only', () => ({}))

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'phase11b-rehearsal-test-secret'
}

const describeDb = isLocal ? describe : describe.skip

describeDb('Phase 11B Wedding Day / WW2 activation & readiness rehearsal', () => {
  let db: typeof import('@/lib/db')['db']
  let wd: typeof import('@/lib/wedding-day')
  let wdm: typeof import('@/lib/wedding-day-manifest')
  let wdf: typeof import('@/lib/wedding-day-feature')
  let keyPreflight: typeof import('@/lib/wedding-day-key-preflight')
  let createNativeAccountSessionToken: typeof import('@/lib/native-account-session')['createNativeAccountSessionToken']

  let getPassRoute: typeof import('@/app/api/wedding-day/pass/route')['GET']
  let getManifestRoute: typeof import('@/app/api/native/gate/wedding-day/manifest/route')['GET']
  let postCheckInRoute: typeof import('@/app/api/native/gate/wedding-day/check-in/route')['POST']
  let postRevokeRoute: typeof import('@/app/api/native/gate/wedding-day/pass/revoke/route')['POST']

  let ww2PrivateKeyPem: string
  let ww2PublicKeyDerBase64: string
  let ww2Fingerprint: string
  let rootPrivateKeyPem: string
  let rootPublicKeyDerBase64: string
  let rootPublicKeyPem: string
  let rootFingerprint: string

  const run = randomUUID().slice(0, 8)
  const id = (name: string) => `p11b-reh-${run}-${name}`

  const WEDDING_ID = id('wedding')
  const COUPLE_ID = id('couple')
  const GATE_ID = id('gate')
  const OPERATOR_USER_ID = id('operator')
  const GUEST_ID = id('guest')
  const RSVP_ID = id('rsvp')
  const GRANT_ID = `gate_operator:${WEDDING_ID}:${GATE_ID}`
  let operatorBearerToken: string

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    wd = await import('@/lib/wedding-day')
    wdm = await import('@/lib/wedding-day-manifest')
    wdf = await import('@/lib/wedding-day-feature')
    keyPreflight = await import('@/lib/wedding-day-key-preflight')
    ;({ createNativeAccountSessionToken } = await import('@/lib/native-account-session'))

    ;({ GET: getPassRoute } = await import('@/app/api/wedding-day/pass/route'))
    ;({ GET: getManifestRoute } = await import('@/app/api/native/gate/wedding-day/manifest/route'))
    ;({ POST: postCheckInRoute } = await import('@/app/api/native/gate/wedding-day/check-in/route'))
    ;({ POST: postRevokeRoute } = await import('@/app/api/native/gate/wedding-day/pass/revoke/route'))

    // Generate synthetic ECDSA P-256 keypairs purely in memory
    const ww2KeyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    ww2PrivateKeyPem = ww2KeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    ww2PublicKeyDerBase64 = ww2KeyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
    ww2Fingerprint = keyPreflight.publicKeyFingerprint(ww2KeyPair.publicKey)

    const rootKeyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    rootPrivateKeyPem = rootKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    rootPublicKeyDerBase64 = rootKeyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
    rootPublicKeyPem = rootKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    rootFingerprint = keyPreflight.publicKeyFingerprint(rootKeyPair.publicKey)

    // Ensure clean DB state for test IDs
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingCheckIn" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingPassCredential" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingPassKey" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingGateAssignment" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingGate" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."RSVP" WHERE "guestId" = $1`, GUEST_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."Guest" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."Wedding" WHERE id = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."Couple" WHERE id = $1`, COUPLE_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."User" WHERE id = $1`, OPERATOR_USER_ID)

    // Seed test couple, wedding, gate, operator user, gate assignment
    await db.$executeRawUnsafe(
      `INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'Partner A', 'Partner B', now())`,
      COUPLE_ID,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "updatedAt")
       VALUES ($1, $1, 'Rehearsal Wedding', now() + interval '7 days', 'Grand Plaza', 'Harare', 'Zimbabwe', $2, now())`,
      WEDDING_ID, COUPLE_ID,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."User" (id, email, name, role, "updatedAt")
       VALUES ($1, $2, 'Lead Usher', 'usher', now())`,
      OPERATOR_USER_ID, `${OPERATOR_USER_ID}@rehearsal.test`,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingGate" (id, "weddingId", name, status, "updatedAt")
       VALUES ($1, $2, 'East Portal Gate', 'active', now())`,
      GATE_ID, WEDDING_ID,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingGateAssignment"
        (id, "weddingId", "gateId", "userId", "operatorRole", capabilities, "activeFrom", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'usher', $5, now() - interval '1 hour', now(), now())`,
      id('assign'), WEDDING_ID, GATE_ID, OPERATOR_USER_ID,
      JSON.stringify(['gate.manifest.read', 'gate.checkin.write', 'gate.pass.revoke', 'gate.guest_search.read', 'gate.audit.read']),
    )

    // Seed guest with accepted RSVP: primary + 1 plus-one = party size 2
    await db.$executeRawUnsafe(
      `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt")
       VALUES ($1, $2, 'Honored Guest', now())`,
      GUEST_ID, WEDDING_ID,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."RSVP" (id, "guestId", token, attending, "plusOne", "plusOneName", "updatedAt")
       VALUES ($1, $2, $3, TRUE, TRUE, 'Plus-One Partner', now())`,
      RSVP_ID, GUEST_ID, id('rsvp-token'),
    )

    operatorBearerToken = createNativeAccountSessionToken({
      accessUserId: OPERATOR_USER_ID,
      authUserId: `auth-${OPERATOR_USER_ID}`,
      email: `${OPERATOR_USER_ID}@rehearsal.test`,
    })
  })

  afterAll(async () => {
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    delete process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM
    delete process.env.WEDDING_DAY_WW2_KEY_ID
    delete process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM
    delete process.env.WEDDING_DAY_ROOT_KEY_ID
    if (db) await db.$disconnect()
  })

  // ---------------------------------------------------------------------------
  // 1. Key Environment Preflight Rehearsal
  // ---------------------------------------------------------------------------
  test('stage 1: key environment preflight detects missing keys and validates synthetic keys safely', () => {
    // A. Verify report when keys are absent
    delete process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM
    delete process.env.WEDDING_DAY_WW2_KEY_ID
    delete process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM
    delete process.env.WEDDING_DAY_ROOT_KEY_ID

    const absentReport = keyPreflight.weddingDayKeyPreflight()
    expect(absentReport.ok).toBe(false)
    const absentChecks = absentReport.checks.filter((c) => c.status === 'absent')
    expect(absentChecks.length).toBeGreaterThanOrEqual(4)

    // B. Provide valid synthetic keys in env
    process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = ww2PrivateKeyPem
    process.env.WEDDING_DAY_WW2_KEY_ID = 'ww2-rehearsal-key-v1'
    process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM = rootPrivateKeyPem
    process.env.WEDDING_DAY_ROOT_KEY_ID = 'root-rehearsal-key-v1'

    const readyReport = keyPreflight.weddingDayKeyPreflight()
    expect(readyReport.ok).toBe(true)

    // Confirm fingerprints are present and match computed public fingerprints
    const ww2FpCheck = readyReport.checks.find((c) => c.name === 'WW2 pass key: public key derives')
    expect(ww2FpCheck).toBeDefined()
    expect(ww2FpCheck?.status).toBe('pass')
    expect(ww2FpCheck?.detail).toBe(ww2Fingerprint)

    const rootFpCheck = readyReport.checks.find((c) => c.name === 'Root manifest key: public key derives')
    expect(rootFpCheck).toBeDefined()
    expect(rootFpCheck?.status).toBe('pass')
    expect(rootFpCheck?.detail).toBe(rootFingerprint)

    // Confirm no private keys or secrets exist in the report output
    const reportString = JSON.stringify(readyReport)
    expect(reportString).not.toContain('PRIVATE KEY')
    expect(reportString).not.toContain(ww2PrivateKeyPem.slice(30, 60))
    expect(reportString).not.toContain(rootPrivateKeyPem.slice(30, 60))
  })

  // ---------------------------------------------------------------------------
  // 2. Database Schema & Preflight Rehearsal
  // ---------------------------------------------------------------------------
  test('stage 2: database preflight queries verify schema integrity and zero baseline pass data', async () => {
    // Verify required tables exist
    const tables = await db.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'WeddingPassKey', 'WeddingPassCredential', 'WeddingCheckIn', 'WeddingGate', 'WeddingGateAssignment'
      )`,
    )
    expect(tables).toHaveLength(5)

    // Verify 0 credentials and check-ins exist for our test wedding prior to activation
    const initialCredentials = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM public."WeddingPassCredential" WHERE "weddingId" = $1`,
      WEDDING_ID,
    )
    expect(initialCredentials).toHaveLength(0)

    const initialCheckIns = await db.$queryRawUnsafe<any[]>(
      `SELECT * FROM public."WeddingCheckIn" WHERE "weddingId" = $1`,
      WEDDING_ID,
    )
    expect(initialCheckIns).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // 3. Feature Flag OFF Rehearsal
  // ---------------------------------------------------------------------------
  test('stage 3: feature flag OFF strictly fails closed across all four gate endpoints and core library', async () => {
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    expect(wdf.isWeddingDayWW2Enabled()).toBe(false)

    // Core library functions must throw WEDDING_DAY_DISABLED
    await expect(
      wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID }),
    ).rejects.toThrow('WEDDING_DAY_DISABLED')

    await expect(
      wdm.signedNativeWeddingDayManifest(WEDDING_ID),
    ).rejects.toThrow('WEDDING_DAY_DISABLED')

    // Route endpoints must return HTTP 503 WEDDING_DAY_DISABLED
    const passRes = await getPassRoute(new NextRequest('http://localhost/api/wedding-day/pass'))
    expect(passRes.status).toBe(503)
    expect((await passRes.json()).code).toBe('WEDDING_DAY_DISABLED')

    const manifestReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/manifest?grantId=${GRANT_ID}`)
    manifestReq.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const manifestRes = await getManifestRoute(manifestReq)
    expect(manifestRes.status).toBe(503)
    expect((await manifestRes.json()).code).toBe('WEDDING_DAY_DISABLED')

    const checkInReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT_ID}`, {
      method: 'POST',
      body: JSON.stringify({ passSerial: 'WW12345678-001', attendeeKeys: ['primary'] }),
    })
    checkInReq.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const checkInRes = await postCheckInRoute(checkInReq)
    expect(checkInRes.status).toBe(503)
    expect((await checkInRes.json()).code).toBe('WEDDING_DAY_DISABLED')

    const revokeReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/pass/revoke?grantId=${GRANT_ID}`, {
      method: 'POST',
      body: JSON.stringify({ passSerial: 'WW12345678-001', reason: 'Rehearsal test' }),
    })
    revokeReq.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const revokeRes = await postRevokeRoute(revokeReq)
    expect(revokeRes.status).toBe(503)
    expect((await revokeRes.json()).code).toBe('WEDDING_DAY_DISABLED')
  })

  // ---------------------------------------------------------------------------
  // 4. Controlled Activation & 5. Guest Pass Issuance
  // ---------------------------------------------------------------------------
  let issuedPass: Awaited<ReturnType<typeof wd.ensureWeddingPassCredential>>
  test('stage 4 & 5: controlled enable and pass issuance produces valid canonical dot-wire token', async () => {
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'
    expect(wdf.isWeddingDayWW2Enabled()).toBe(true)

    issuedPass = await wd.ensureWeddingPassCredential({
      weddingId: WEDDING_ID,
      guestId: GUEST_ID,
    })

    expect(issuedPass).toBeDefined()
    expect(issuedPass.guestId).toBe(GUEST_ID)
    expect(issuedPass.weddingId).toBe(WEDDING_ID)
    expect(issuedPass.issueSeq).toBe(1)
    expect(issuedPass.token).toBeDefined()

    // Canonical wire format: exactly 6 dot-delimited parts
    // WW2.<weddingShortId>.<passSerial>.<maskHex>.<nonce>.<signatureHex>
    const dotParts = issuedPass.token.split('.')
    expect(dotParts).toHaveLength(6)
    expect(dotParts[0]).toBe('WW2')
    expect(dotParts[1]).toMatch(/^[0-9a-f]{8}$/) // weddingShortId
    expect(dotParts[2]).toMatch(/^WW[0-9A-F]{8}-001$/) // passSerial
    expect(dotParts[3]).toMatch(/^[0-9a-f]{2}$/) // eventMask
    expect(dotParts[4]).toMatch(/^[0-9a-f]{16}$/) // nonce
    expect(dotParts[5]).toMatch(/^[0-9a-f]{128}$/) // IEEE P1363 64-byte signature in hex (128 hex chars)

    // Parse and verify using token verification logic
    const parsed = wd.parseWw2Token(issuedPass.token)
    expect(parsed).not.toBeNull()
    expect(parsed?.passSerial).toBe(issuedPass.passSerial)
    expect(parsed?.weddingShortId).toBe(issuedPass.weddingShortId)
  })

  // ---------------------------------------------------------------------------
  // 6. Gate Manifest Generation & Cryptographic Verification
  // ---------------------------------------------------------------------------
  let manifestData: Awaited<ReturnType<typeof wdm.signedNativeWeddingDayManifest>>
  test('stage 6: gate manifest produces authentic envelope signed with root key and verified with root public key', async () => {
    const manifestReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/manifest?grantId=${GRANT_ID}`)
    manifestReq.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const manifestRes = await getManifestRoute(manifestReq)
    expect(manifestRes.status).toBe(200)

    const body = await manifestRes.json()
    expect(body.success).toBe(true)
    manifestData = body.data

    expect(manifestData.rootKeyId).toBe('root-rehearsal-key-v1')
    expect(manifestData.algorithm).toBe('ECDSA_P256_SHA256')
    expect(manifestData.canonicalPayload).toBeDefined()
    expect(manifestData.signatureHex).toMatch(/^[0-9a-f]{128}$/)

    // Cryptographic proof: verify signature over canonicalPayload using root public key
    const rootPublicKey = createPublicKey({
      key: Buffer.from(rootPublicKeyDerBase64, 'base64'),
      format: 'der',
      type: 'spki',
    })
    const isVerified = cryptoVerify(
      'sha256',
      Buffer.from(manifestData.canonicalPayload, 'utf8'),
      { key: rootPublicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(manifestData.signatureHex, 'hex'),
    )
    expect(isVerified).toBe(true)

    // Inspect manifest inner payload
    const inner = JSON.parse(manifestData.canonicalPayload)
    expect(inner.weddingId).toBe(WEDDING_ID)
    expect(inner.keys).toHaveLength(1)
    expect(inner.keys[0].keyId).toBe('ww2-rehearsal-key-v1')
    expect(inner.keys[0].publicKeyDerBase64).toBe(ww2PublicKeyDerBase64)

    const credentialInManifest = inner.credentials.find((c: any) => c.guestId === GUEST_ID)
    expect(credentialInManifest).toBeDefined()
    expect(credentialInManifest.passSerial).toBe(issuedPass.passSerial)
    expect(credentialInManifest.partySize).toBe(2)
    expect(credentialInManifest.household).toHaveLength(2)
    expect(credentialInManifest.household.map((h: any) => h.attendeeKey)).toEqual(['primary', 'plus-one'])
  })

  // ---------------------------------------------------------------------------
  // 7. Offline Gate Admission Simulation
  // ---------------------------------------------------------------------------
  test('stage 7: offline gate client verifies token signature against manifest key without internet', () => {
    const inner = JSON.parse(manifestData.canonicalPayload)
    const activeKey = inner.keys.find((k: any) => k.keyId === 'ww2-rehearsal-key-v1')
    expect(activeKey).toBeDefined()

    // Offline client parses token
    const parts = issuedPass.token.split('.')
    const payloadPart = parts.slice(0, 5).join('.')
    const sigHex = parts[5]

    // Verify token offline using public key from manifest
    const ww2Pub = createPublicKey({
      key: Buffer.from(activeKey.publicKeyDerBase64, 'base64'),
      format: 'der',
      type: 'spki',
    })
    const passOfflineValid = cryptoVerify(
      'sha256',
      Buffer.from(payloadPart, 'utf8'),
      { key: ww2Pub, dsaEncoding: 'ieee-p1363' },
      Buffer.from(sigHex, 'hex'),
    )
    expect(passOfflineValid).toBe(true)

    // Tampered payload must fail
    const tamperedPayload = payloadPart + 'tampered'
    const tamperedValid = cryptoVerify(
      'sha256',
      Buffer.from(tamperedPayload, 'utf8'),
      { key: ww2Pub, dsaEncoding: 'ieee-p1363' },
      Buffer.from(sigHex, 'hex'),
    )
    expect(tamperedValid).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // 8. Reconnect Check-in Sync & Idempotency
  // ---------------------------------------------------------------------------
  test('stage 8: check-in records operator identity and deduplicates retransmitted offline events', async () => {
    const clientEventId = `rehearsal-evt-${randomUUID().slice(0, 8)}`

    // A. Admitting primary guest attendee
    const checkInReq1 = new NextRequest(`http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        passSerial: issuedPass.passSerial,
        attendeeKeys: ['primary'],
        clientEventId,
        deviceId: 'gate-terminal-01',
      }),
    })
    checkInReq1.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const res1 = await postCheckInRoute(checkInReq1)
    expect(res1.status).toBe(200)
    const json1 = await res1.json()
    expect(json1.success).toBe(true)
    expect(json1.admittedCount).toBe(1)

    // Verify DB row
    const checkIns = await db.$queryRawUnsafe<Array<{
      id: string
      attendeeKey: string
      admittedByUserId: string
      clientEventId: string
    }>>(
      `SELECT id, "attendeeKey", "admittedByUserId", "clientEventId"
         FROM public."WeddingCheckIn"
        WHERE "weddingId" = $1 AND "guestId" = $2`,
      WEDDING_ID, GUEST_ID,
    )
    expect(checkIns).toHaveLength(1)
    expect(checkIns[0].attendeeKey).toBe('primary')
    expect(checkIns[0].admittedByUserId).toBe(OPERATOR_USER_ID) // Server-derived authority
    expect(checkIns[0].clientEventId).toBe(clientEventId)

    // RSVP should NOT yet be fully checkedIn because household has 2 members
    const rsvpAfterPrimary = await db.$queryRawUnsafe<Array<{ checkedIn: boolean }>>(
      `SELECT "checkedIn" FROM public."RSVP" WHERE "guestId" = $1`,
      GUEST_ID,
    )
    expect(rsvpAfterPrimary[0].checkedIn).toBe(false)

    // B. Reconnect idempotency: resend exact same event
    const checkInReqDuplicate = new NextRequest(`http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        passSerial: issuedPass.passSerial,
        attendeeKeys: ['primary'],
        clientEventId,
        deviceId: 'gate-terminal-01',
      }),
    })
    checkInReqDuplicate.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const resDup = await postCheckInRoute(checkInReqDuplicate)
    expect(resDup.status).toBe(200)

    // Confirm no duplicate row created
    const checkInsAfterDup = await db.$queryRawUnsafe<any[]>(
      `SELECT id FROM public."WeddingCheckIn" WHERE "weddingId" = $1 AND "guestId" = $2`,
      WEDDING_ID, GUEST_ID,
    )
    expect(checkInsAfterDup).toHaveLength(1)
  })

  // ---------------------------------------------------------------------------
  // 9. Complete Household RSVP Check-in
  // ---------------------------------------------------------------------------
  test('stage 9: check-in for remaining household member completes household admission in RSVP', async () => {
    const clientEventId2 = `rehearsal-evt-${randomUUID().slice(0, 8)}`

    const checkInReq2 = new NextRequest(`http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        passSerial: issuedPass.passSerial,
        attendeeKeys: ['plus-one'],
        clientEventId: clientEventId2,
        deviceId: 'gate-terminal-01',
      }),
    })
    checkInReq2.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const res2 = await postCheckInRoute(checkInReq2)
    expect(res2.status).toBe(200)

    // Household is now complete: primary + plus-one
    const rsvpAfterBoth = await db.$queryRawUnsafe<Array<{ checkedIn: boolean; checkedInAt: Date | null }>>(
      `SELECT "checkedIn", "checkedInAt" FROM public."RSVP" WHERE "guestId" = $1`,
      GUEST_ID,
    )
    expect(rsvpAfterBoth[0].checkedIn).toBe(true)
    expect(rsvpAfterBoth[0].checkedInAt).not.toBeNull()
  })

  // ---------------------------------------------------------------------------
  // 10. Credential Revocation & Reissue Isolation
  // ---------------------------------------------------------------------------
  test('stage 10: credential revocation rejects old pass at gate and reissue produces isolated new serial', async () => {
    // A. Operator revokes the pass
    const revokeReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/pass/revoke?grantId=${GRANT_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        passSerial: issuedPass.passSerial,
        reason: 'Guest reported phone misplaced at gate',
      }),
    })
    revokeReq.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const revokeRes = await postRevokeRoute(revokeReq)
    expect(revokeRes.status).toBe(200)
    const revokeJson = await revokeRes.json()
    expect(revokeJson.success).toBe(true)
    expect(revokeJson.data.revokedAt).not.toBeNull()

    const revocationAudit = await db.$queryRawUnsafe<Array<{ actorId: string; afterValue: unknown }>>(
      `SELECT "actorId", "afterValue"
         FROM public."AuditEvent"
        WHERE action = 'wedding_pass.revoked' AND "resourceId" = $1`,
      issuedPass.id,
    )
    expect(revocationAudit).toHaveLength(1)
    expect(revocationAudit[0].actorId).toBe(OPERATOR_USER_ID)
    expect(JSON.stringify(revocationAudit[0].afterValue)).toContain(GATE_ID)

    // B. Check-in attempt with revoked pass must be rejected
    const checkInRevokedReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        passSerial: issuedPass.passSerial,
        attendeeKeys: ['primary'],
      }),
    })
    checkInRevokedReq.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const checkInRevokedRes = await postCheckInRoute(checkInRevokedReq)
    expect(checkInRevokedRes.status).toBe(400)
    const checkInRevokedJson = await checkInRevokedRes.json()
    expect(checkInRevokedJson.code).toBe('PASS_REVOKED_OR_EXPIRED')

    // C. Reissue new pass for guest
    const reissued = await wd.ensureWeddingPassCredential({
      weddingId: WEDDING_ID,
      guestId: GUEST_ID,
    })
    expect(reissued.passSerial).not.toBe(issuedPass.passSerial)
    expect(reissued.issueSeq).toBe(2)
    expect(reissued.revokedAt).toBeNull()

    // Old pass remains revoked in DB
    const oldPassRow = await db.$queryRawUnsafe<Array<{ revokedAt: Date | null }>>(
      `SELECT "revokedAt" FROM public."WeddingPassCredential" WHERE id = $1`,
      issuedPass.id,
    )
    expect(oldPassRow[0].revokedAt).not.toBeNull()
  })

  // ---------------------------------------------------------------------------
  // 11. Rollback & Containment Criteria
  // ---------------------------------------------------------------------------
  test('stage 11: feature flag OFF rollback immediately shuts down endpoints and leaves DB intact', async () => {
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    expect(wdf.isWeddingDayWW2Enabled()).toBe(false)

    // Immediate fail-closed across endpoints
    const manifestReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/manifest?grantId=${GRANT_ID}`)
    manifestReq.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const manifestRes = await getManifestRoute(manifestReq)
    expect(manifestRes.status).toBe(503)

    const checkInReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT_ID}`, {
      method: 'POST',
      body: JSON.stringify({ passSerial: issuedPass.passSerial, attendeeKeys: ['primary'] }),
    })
    checkInReq.headers.set('Authorization', `Bearer ${operatorBearerToken}`)
    const checkInRes = await postCheckInRoute(checkInReq)
    expect(checkInRes.status).toBe(503)

    // DB state is preserved (2 pass credentials: seq 1 revoked, seq 2 active; 2 check-in records)
    const preservedCredentials = await db.$queryRawUnsafe<Array<{ passSerial: string; issueSeq: number }>>(
      `SELECT "passSerial", "issueSeq" FROM public."WeddingPassCredential" WHERE "weddingId" = $1 ORDER BY "issueSeq"`,
      WEDDING_ID,
    )
    expect(preservedCredentials).toHaveLength(2)
    expect(preservedCredentials[0].issueSeq).toBe(1)
    expect(preservedCredentials[1].issueSeq).toBe(2)

    const preservedCheckIns = await db.$queryRawUnsafe<Array<{ attendeeKey: string }>>(
      `SELECT "attendeeKey" FROM public."WeddingCheckIn" WHERE "weddingId" = $1 ORDER BY "admittedAt"`,
      WEDDING_ID,
    )
    expect(preservedCheckIns).toHaveLength(2)
  })
})
