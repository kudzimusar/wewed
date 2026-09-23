/**
 * Phase 11A: Wedding Day Route Endpoints Integration Tests
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

mock.module('server-only', () => ({}))

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'phase11a-routes-test-secret'
}

const describeDb = isLocal ? describe : describe.skip

describeDb('Phase 11A Wedding Day HTTP route handlers', () => {
  let db: typeof import('@/lib/db')['db']
  let getPassRoute: typeof import('@/app/api/wedding-day/pass/route')['GET']
  let getManifestRoute: typeof import('@/app/api/native/gate/wedding-day/manifest/route')['GET']
  let postCheckInRoute: typeof import('@/app/api/native/gate/wedding-day/check-in/route')['POST']
  let createNativeAccountSessionToken: typeof import('@/lib/native-account-session')['createNativeAccountSessionToken']
  let ensureWeddingPassCredential: typeof import('@/lib/wedding-day')['ensureWeddingPassCredential']

  const run = randomUUID().slice(0, 8)
  const id = (name: string) => `p11a-rt-${run}-${name}`

  const WEDDING_ID = id('wedding')
  const GUEST_ID = id('guest')
  const GATE_ID = id('gate')
  const OPERATOR_USER_ID = id('operator')
  const GRANT_ID = `gate_operator:${WEDDING_ID}:${GATE_ID}`
  let bearerToken: string

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ GET: getPassRoute } = await import('@/app/api/wedding-day/pass/route'))
    ;({ GET: getManifestRoute } = await import('@/app/api/native/gate/wedding-day/manifest/route'))
    ;({ POST: postCheckInRoute } = await import('@/app/api/native/gate/wedding-day/check-in/route'))
    ;({ createNativeAccountSessionToken } = await import('@/lib/native-account-session'))
    ;({ ensureWeddingPassCredential } = await import('@/lib/wedding-day'))

    const ww2KeyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const rootKeyPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })

    process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = ww2KeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_WW2_KEY_ID = 'ww2-routes-key'
    process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM = rootKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_ROOT_KEY_ID = 'root-routes-key'

    // Clean up
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingCheckIn" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingPassCredential" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingPassKey" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingGateAssignment" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingGate" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."RSVP" WHERE "guestId" = $1`, GUEST_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."Guest" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."Wedding" WHERE id = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."Couple" WHERE id = $1`, id('couple'))
    await db.$executeRawUnsafe(`DELETE FROM public."User" WHERE id = $1`, OPERATOR_USER_ID)

    // Fixtures
    await db.$executeRawUnsafe(
      `INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'A', 'B', now())`,
      id('couple'),
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "updatedAt")
       VALUES ($1, $1, 'Routes Test Wedding', now() + interval '5 days', 'Venue', 'City', 'Country', $2, now())`,
      WEDDING_ID, id('couple'),
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."User" (id, email, name, role, "updatedAt")
       VALUES ($1, $2, 'Operator', 'usher', now())`,
      OPERATOR_USER_ID, `${OPERATOR_USER_ID}@example.test`,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingGate" (id, "weddingId", name, status, "updatedAt")
       VALUES ($1, $2, 'Main Gate', 'active', now())`,
      GATE_ID, WEDDING_ID,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingGateAssignment"
        (id, "weddingId", "gateId", "userId", "operatorRole", capabilities, "activeFrom", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'usher', $5, now() - interval '1 hour', now(), now())`,
      id('assign'), WEDDING_ID, GATE_ID, OPERATOR_USER_ID,
      JSON.stringify(['gate.manifest.read', 'gate.checkin.write', 'gate.guest_search.read', 'gate.audit.read']),
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt")
       VALUES ($1, $2, 'Guest Routes', now())`,
      GUEST_ID, WEDDING_ID,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."RSVP" (id, "guestId", token, attending, "updatedAt")
       VALUES ($1, $2, $3, TRUE, now())`,
      id('rsvp'), GUEST_ID, id('rsvp-token'),
    )

    bearerToken = createNativeAccountSessionToken({
      accessUserId: OPERATOR_USER_ID,
      authUserId: `auth-${OPERATOR_USER_ID}`,
      email: `${OPERATOR_USER_ID}@example.test`,
    })
  })

  afterAll(async () => {
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    if (db) await db.$disconnect()
  })

  test('disabled feature gate returns 503 across all three routes', async () => {
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED

    const passReq = new NextRequest('http://localhost/api/wedding-day/pass')
    const passRes = await getPassRoute(passReq)
    expect(passRes.status).toBe(503)
    const passJson = await passRes.json()
    expect(passJson.code).toBe('WEDDING_DAY_DISABLED')

    const manifestReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/manifest?grantId=${GRANT_ID}`)
    manifestReq.headers.set('Authorization', `Bearer ${bearerToken}`)
    const manifestRes = await getManifestRoute(manifestReq)
    expect(manifestRes.status).toBe(503)

    const checkInReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT_ID}`, {
      method: 'POST',
      body: JSON.stringify({ token: 'test', attendeeKeys: ['primary'] }),
    })
    checkInReq.headers.set('Authorization', `Bearer ${bearerToken}`)
    const checkInRes = await postCheckInRoute(checkInReq)
    expect(checkInRes.status).toBe(503)
  })

  test('enabled feature remains unavailable until both signing roles pass preflight', async () => {
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'
    const rootPrivateKey = process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM
    const rootKeyId = process.env.WEDDING_DAY_ROOT_KEY_ID
    delete process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM
    delete process.env.WEDDING_DAY_ROOT_KEY_ID

    const passRes = await getPassRoute(new NextRequest('http://localhost/api/wedding-day/pass'))
    expect(passRes.status).toBe(503)
    expect((await passRes.json()).code).toBe('WEDDING_DAY_KEY_CONFIGURATION_INVALID')

    const manifestReq = new NextRequest(
      `http://localhost/api/native/gate/wedding-day/manifest?grantId=${GRANT_ID}`,
    )
    manifestReq.headers.set('Authorization', `Bearer ${bearerToken}`)
    const manifestRes = await getManifestRoute(manifestReq)
    expect(manifestRes.status).toBe(503)
    expect((await manifestRes.json()).code).toBe('WEDDING_DAY_KEY_CONFIGURATION_INVALID')

    const checkInReq = new NextRequest(
      `http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT_ID}`,
      { method: 'POST', body: JSON.stringify({ passSerial: 'irrelevant', attendeeKeys: ['primary'] }) },
    )
    checkInReq.headers.set('Authorization', `Bearer ${bearerToken}`)
    const checkInRes = await postCheckInRoute(checkInReq)
    expect(checkInRes.status).toBe(503)
    expect((await checkInRes.json()).code).toBe('WEDDING_DAY_KEY_CONFIGURATION_INVALID')

    process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM = rootPrivateKey
    process.env.WEDDING_DAY_ROOT_KEY_ID = rootKeyId
  })

  test('enabled feature gate enforces authentication and grant authorization', async () => {
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'

    // Missing bearer token
    const unauthReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/manifest?grantId=${GRANT_ID}`)
    const unauthRes = await getManifestRoute(unauthReq)
    expect(unauthRes.status).toBe(401)

    // Missing grantId
    const noGrantReq = new NextRequest('http://localhost/api/native/gate/wedding-day/manifest')
    noGrantReq.headers.set('Authorization', `Bearer ${bearerToken}`)
    const noGrantRes = await getManifestRoute(noGrantReq)
    expect(noGrantRes.status).toBe(400)

    // Non-existent / unauthorized grantId
    const wrongGrantReq = new NextRequest('http://localhost/api/native/gate/wedding-day/manifest?grantId=gate_operator:fake:fake')
    wrongGrantReq.headers.set('Authorization', `Bearer ${bearerToken}`)
    const wrongGrantRes = await getManifestRoute(wrongGrantReq)
    expect(wrongGrantRes.status).toBe(403)
  })

  test('valid gate operator can fetch manifest and post check-in', async () => {
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'

    const credential = await ensureWeddingPassCredential({
      weddingId: WEDDING_ID,
      guestId: GUEST_ID,
    })

    // Fetch manifest
    const manifestReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/manifest?grantId=${GRANT_ID}`)
    manifestReq.headers.set('Authorization', `Bearer ${bearerToken}`)
    const manifestRes = await getManifestRoute(manifestReq)
    expect(manifestRes.status).toBe(200)
    const manifestJson = await manifestRes.json()
    expect(manifestJson.success).toBe(true)
    expect(manifestJson.data.payload.weddingId).toBe(WEDDING_ID)

    // Check in via QR token
    const checkInReq = new NextRequest(`http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT_ID}`, {
      method: 'POST',
      body: JSON.stringify({
        token: credential.token,
        attendeeKeys: ['primary'],
        // These are deliberate authority-poison fields. The server request contract ignores them
        // and derives wedding/gate/operator/source/event from the live grant and operation shape.
        weddingId: 'forged-wedding',
        gateId: 'forged-gate',
        operatorUserId: 'forged-operator',
        source: 'forged-source',
        eventKey: 'forged-event',
      }),
    })
    checkInReq.headers.set('Authorization', `Bearer ${bearerToken}`)
    checkInReq.headers.set('Content-Type', 'application/json')
    const checkInRes = await postCheckInRoute(checkInReq)
    const checkInJson = await checkInRes.json()
    expect(checkInRes.status).toBe(200)
    expect(checkInJson.success).toBe(true)
    expect(checkInJson.admittedCount).toBe(1)

    const auditRows = await db.$queryRawUnsafe<Array<{
      weddingId: string
      gateId: string
      admittedByUserId: string
      eventKey: string
      source: string
    }>>(
      `SELECT "weddingId", "gateId", "admittedByUserId", "eventKey", source
         FROM public."WeddingCheckIn"
        WHERE "weddingId" = $1 AND "guestId" = $2 AND "attendeeKey" = 'primary'
        ORDER BY "admittedAt" DESC
        LIMIT 1`,
      WEDDING_ID, GUEST_ID,
    )
    expect(auditRows[0]).toEqual({
      weddingId: WEDDING_ID,
      gateId: GATE_ID,
      admittedByUserId: OPERATOR_USER_ID,
      eventKey: 'wedding-day',
      source: 'qr',
    })
  })
})
