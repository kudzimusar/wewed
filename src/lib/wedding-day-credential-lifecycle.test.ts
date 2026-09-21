/**
 * The WW2 credential lifecycle, against a real PostgreSQL database.
 *
 * These run only when WEDDING_DAY_TEST_DATABASE_URL points at a disposable database that already
 * has the hardened Wedding Day review migration applied (see
 * docs/native-mobile/WEDDING_DAY_ISOLATED_DB_QUALIFICATION.md). They are skipped otherwise, so an
 * ordinary `bun test` run stays offline.
 *
 * They are deliberately not mocked. The behaviour under test *is* the database's: a partial unique
 * index, a row lock, and a transaction. A mock that returned whatever the test wanted would prove
 * nothing about the thing that actually keeps two devices from minting two live passes.
 */
import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
mock.module('server-only', () => ({}))

const DATABASE_URL = process.env.WEDDING_DAY_TEST_DATABASE_URL
const describeDb = DATABASE_URL ? describe : describe.skip

if (DATABASE_URL) {
  process.env.DATABASE_URL = DATABASE_URL
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString()
  process.env.WEDDING_DAY_WW2_KEY_ID = 'ww2-isolated-test'
}

const WEDDING_ID = 'lifecycle-wedding'
const GUEST_ID = 'lifecycle-guest'

describeDb('WW2 credential lifecycle', () => {
  // Imported dynamically below so the module graph is not pulled in when these tests are skipped.
  let db: any
  let wd: any
  let weddingDate: Date

  async function reset(daysUntilWedding: number) {
    weddingDate = new Date(Date.now() + daysUntilWedding * 24 * 60 * 60 * 1000)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingCheckIn" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingPassCredential" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingPassKey" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."RSVP" WHERE "guestId" = $1`, GUEST_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."Guest" WHERE "weddingId" = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."Wedding" WHERE id = $1`, WEDDING_ID)
    await db.$executeRawUnsafe(`DELETE FROM public."Couple" WHERE id = $1`, 'lifecycle-couple')
    await db.$executeRawUnsafe(
      `INSERT INTO public."Couple" VALUES ($1,'P1','P2')`, 'lifecycle-couple')
    await db.$executeRawUnsafe(
      `INSERT INTO public."Wedding" (id,"coupleId",slug,title,date) VALUES ($1,$2,$3,'Lifecycle',$4)`,
      WEDDING_ID, 'lifecycle-couple', `lifecycle-${randomUUID().slice(0, 8)}`, weddingDate)
    await db.$executeRawUnsafe(
      `INSERT INTO public."Guest" (id,"weddingId",name) VALUES ($1,$2,'Lifecycle Guest')`,
      GUEST_ID, WEDDING_ID)
    await db.$executeRawUnsafe(
      `INSERT INTO public."RSVP" (id,"guestId",token,attending) VALUES ($1,$2,$3,TRUE)`,
      randomUUID(), GUEST_ID, `tok-${randomUUID()}`)
  }

  const allCredentials = () => db.$queryRawUnsafe(
    `SELECT * FROM public."WeddingPassCredential" WHERE "weddingId" = $1 ORDER BY "issueSeq"`,
    WEDDING_ID)

  beforeEach(async () => {
    if (!db) {
      db = (await import('./db')).db
      wd = await import('./wedding-day')
    }
    await reset(2)
  })

  afterAll(async () => { if (db) await db.$disconnect() })

  test('a live, unexpired credential is reused rather than reissued', async () => {
    const first = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })
    const second = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })
    expect(second.id).toBe(first.id)
    expect(second.token).toBe(first.token)
    expect((await allCredentials()).length).toBe(1)
  })

  test('a revoked credential is preserved, never reused, and replaced by a distinct one', async () => {
    const first = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })
    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassCredential" SET "revokedAt" = now(), "revocationReason" = 'test'
        WHERE id = $1`, first.id)

    const second = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })

    expect(second.id).not.toBe(first.id)
    expect(second.nonce).not.toBe(first.nonce)
    expect(second.token).not.toBe(first.token)
    expect(second.passSerial).not.toBe(first.passSerial)
    expect(second.issueSeq).toBe(first.issueSeq + 1)

    const rows = await allCredentials()
    expect(rows.length).toBe(2)
    // The revoked row survives for audit and is never un-revoked.
    expect(rows[0].id).toBe(first.id)
    expect(rows[0].revokedAt).not.toBeNull()
  })

  test('an expired credential is superseded, not edited, and replaced by a distinct one', async () => {
    const first = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })
    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassCredential" SET "expiresAt" = now() - interval '1 hour' WHERE id = $1`,
      first.id)

    const second = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })

    expect(second.id).not.toBe(first.id)
    expect(second.token).not.toBe(first.token)
    expect(second.issueSeq).toBe(first.issueSeq + 1)

    const rows = await allCredentials()
    expect(rows.length).toBe(2)
    expect(rows[0].supersededAt).not.toBeNull()
    expect(rows[0].revokedAt).toBeNull()   // superseded is not revoked
  })

  test('old revoked, old expired and superseded tokens all fail verification; the new one passes', async () => {
    const first = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })
    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassCredential" SET "revokedAt" = now() WHERE id = $1`, first.id)
    const second = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })

    await expect(
      wd.verifyWeddingPassToken({ weddingId: WEDDING_ID, token: first.token }),
    ).rejects.toThrow('PASS_REVOKED_OR_EXPIRED')

    const verified = await wd.verifyWeddingPassToken({ weddingId: WEDDING_ID, token: second.token })
    expect(verified.id).toBe(second.id)

    // Now expire the new one and confirm its token stops verifying too.
    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassCredential" SET "expiresAt" = now() - interval '1 second' WHERE id = $1`,
      second.id)
    await expect(
      wd.verifyWeddingPassToken({ weddingId: WEDDING_ID, token: second.token }),
    ).rejects.toThrow('PASS_REVOKED_OR_EXPIRED')

    // And that a superseded credential's token is refused even while unexpired and unrevoked.
    const third = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })
    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassCredential" SET "supersededAt" = now() WHERE id = $1`, third.id)
    await expect(
      wd.verifyWeddingPassToken({ weddingId: WEDDING_ID, token: third.token }),
    ).rejects.toThrow('PASS_REVOKED_OR_EXPIRED')
  })

  test('concurrent issuance yields one credential, not two', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })),
    )
    const ids = new Set(results.map((row: { id: string }) => row.id))
    expect(ids.size).toBe(1)

    const rows = await allCredentials()
    const live = rows.filter((r: { revokedAt: Date | null; supersededAt: Date | null }) =>
      !r.revokedAt && !r.supersededAt)
    expect(live.length).toBe(1)
  })

  test('issuance is refused after the wedding cutoff, and a live pass is still honoured', async () => {
    await reset(2)
    const issued = await wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID })

    const pastCutoff = new Date(weddingDate.getTime() + 25 * 60 * 60 * 1000)
    // Reuse of the live credential is not gated by the window.
    const reused = await wd.ensureWeddingPassCredential({
      weddingId: WEDDING_ID, guestId: GUEST_ID, now: pastCutoff })
    expect(reused.id).toBe(issued.id)

    // But minting a new one after the cutoff is refused.
    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassCredential" SET "revokedAt" = now() WHERE id = $1`, issued.id)
    await expect(
      wd.ensureWeddingPassCredential({ weddingId: WEDDING_ID, guestId: GUEST_ID, now: pastCutoff }),
    ).rejects.toThrow('PASS_ISSUANCE_CLOSED')
  })

  test('expiry is anchored to the wedding and does not move with the request time', async () => {
    // The defect this replaces was `max(weddingDate + 36h, now + 12h)`. Worth being precise about
    // where it bit: inside the issuance window the two agree, because at the latest permitted
    // request (wedding + 24h) the `now + 12h` term reaches exactly wedding + 36h and no further.
    // The extension was only ever reachable *past* the cutoff — and that is precisely the request
    // the policy now refuses outright, rather than serving it a pass that outlived the wedding.
    // So this test pins the anchor, and `issuance is refused after the wedding cutoff` pins the
    // case that actually produced the over-long pass.
    await reset(0)
    const early = new Date(weddingDate.getTime() - 3 * 24 * 60 * 60 * 1000)
    const late = new Date(weddingDate.getTime() + 23 * 60 * 60 * 1000)
    const ceiling = wd.weddingPassIssuanceWindow(weddingDate).expiresAt.getTime()

    const first = await wd.ensureWeddingPassCredential({
      weddingId: WEDDING_ID, guestId: GUEST_ID, now: early })
    expect(first.expiresAt.getTime()).toBe(ceiling)

    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassCredential" SET "revokedAt" = now() WHERE id = $1`, first.id)
    const second = await wd.ensureWeddingPassCredential({
      weddingId: WEDDING_ID, guestId: GUEST_ID, now: late })

    // Twenty-three hours later, and not one millisecond of extra life.
    expect(second.expiresAt.getTime()).toBe(ceiling)
    expect(second.expiresAt.getTime()).toBe(first.expiresAt.getTime())
    // The ceiling is never exceeded for any request the window permits.
    expect(second.expiresAt.getTime()).toBeLessThanOrEqual(ceiling)
  })
})
