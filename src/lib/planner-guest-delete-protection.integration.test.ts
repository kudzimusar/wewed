/**
 * QRO08 P1 — protected Guest deletion (shared by the desktop and native Planner routes).
 *
 * A Guest who is part of the wedding's history (Wedding Pass credential, check-in, contribution)
 * must never be deleted and must never surface a database foreign-key error as a 500. The shared
 * `deletePlannerGuest` returns 409 GUEST_DELETE_CONFLICT and changes nothing; a Guest with no such
 * history (optionally with an RSVP / personal link) deletes normally with an audit event.
 *
 * Runs only against a local disposable database (AUTHORITY_TEST_DATABASE_URL on localhost).
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { generateKeyPairSync, randomUUID } from 'node:crypto'

mock.module('server-only', () => ({}))

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'qro08-guest-delete-secret'
}

const describeDb = isLocal ? describe : describe.skip

describeDb('QRO08 protected Guest deletion', () => {
  let db: typeof import('@/lib/db')['db']
  let wd: typeof import('@/lib/wedding-day')
  let ops: typeof import('@/lib/planner-guest-operations')

  const run = randomUUID().slice(0, 8)
  const WEDDING = `qro08-del-${run}`
  const ACTOR = `${WEDDING}-planner`
  const GATE = `${WEDDING}-gate`
  const g = {
    plain: `${WEDDING}-plain`,
    rsvpOnly: `${WEDDING}-rsvp`,
    pass: `${WEDDING}-pass`,
    revokedPass: `${WEDDING}-revoked`,
    checkedIn: `${WEDDING}-checkin`,
    contribution: `${WEDDING}-gift`,
    contributor: `${WEDDING}-contributor`,
    raced: `${WEDDING}-raced`,
  }
  const actor = () => ({ weddingId: WEDDING, actorId: ACTOR })
  const count = async (sql: string, ...params: unknown[]) =>
    Number((await db.$queryRawUnsafe<Array<{ n: bigint }>>(sql, ...params))[0]?.n ?? 0)
  const guestExists = (id: string) => count(`SELECT count(*)::bigint AS n FROM public."Guest" WHERE id = $1`, id)

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    wd = await import('@/lib/wedding-day')
    ops = await import('@/lib/planner-guest-operations')
    const ww2 = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = ww2.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_WW2_KEY_ID = `ww2-qro08-del-${run}`
    const root = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM = root.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_ROOT_KEY_ID = `root-qro08-del-${run}`
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'
    delete process.env.VERCEL_ENV

    await db.$executeRawUnsafe(
      `INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'A', 'B', now())`,
      `${WEDDING}-couple`,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "updatedAt")
       VALUES ($1, $1, 'Delete Wedding', now() + interval '3 days', 'Venue', 'City', 'Country', $2, now())`,
      WEDDING, `${WEDDING}-couple`,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."User" (id, email, name, role, "isActive", "updatedAt") VALUES ($1, $2, 'Planner', 'planner', true, now())`,
      ACTOR, `${ACTOR}@example.test`,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingGate" (id, "weddingId", name, status, "updatedAt") VALUES ($1, $2, 'Main Gate', 'active', now())`,
      GATE, WEDDING,
    )
    for (const [key, id] of Object.entries(g)) {
      await db.$executeRawUnsafe(
        `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
        id, WEDDING, `Guest ${key}`,
      )
      if (key !== 'plain') {
        await db.$executeRawUnsafe(
          `INSERT INTO public."RSVP" (id, "guestId", token, attending, "updatedAt") VALUES ($1, $2, $3, TRUE, now())`,
          `${id}-rsvp`, id, `${id}-token`,
        )
      }
    }
    for (const id of [g.pass, g.revokedPass, g.checkedIn]) {
      await wd.ensureWeddingPassCredential({ weddingId: WEDDING, guestId: id })
    }
    await db.$executeRawUnsafe(
      `UPDATE public."WeddingPassCredential" SET "revokedAt" = now(), "revocationReason" = 'test' WHERE "guestId" = $1`,
      g.revokedPass,
    )
    const [credential] = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM public."WeddingPassCredential" WHERE "guestId" = $1 LIMIT 1`, g.checkedIn,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingCheckIn"
        (id, "weddingId", "guestId", "credentialId", "gateId", "admittedByUserId",
         "eventKey", "attendeeKey", "attendeeKind", "attendeeName", source, "admittedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'wedding-day', 'primary', 'primary', 'Guest', 'qr', now(), now(), now())`,
      `${WEDDING}-ci`, WEDDING, g.checkedIn, credential.id, GATE, ACTOR,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."GuestContribution" (id, "guestId", "weddingId", "displayName", message, "updatedAt")
       VALUES ($1, $2, $3, 'Gift', 'With love', now())`,
      `${WEDDING}-gc`, g.contribution, WEDDING,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO wewed_contributions.contributors (id, wedding_id, display_name, guest_id) VALUES ($1, $2, 'Contributor', $3)`,
      `${WEDDING}-ctr`, WEDDING, g.contributor,
    )
  })

  afterAll(async () => {
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    if (!db) return
    await db.$executeRawUnsafe(`DELETE FROM wewed_contributions.contributors WHERE wedding_id = $1`, WEDDING)
    await db.$executeRawUnsafe(`DELETE FROM public."WeddingCheckIn" WHERE "weddingId" = $1`, WEDDING)
    for (const t of ['AuditEvent', 'WeddingPassCredential', 'WeddingPassKey', 'GuestContribution', 'WeddingGate']) {
      await db.$executeRawUnsafe(`DELETE FROM public."${t}" WHERE "weddingId" = $1`, WEDDING)
    }
    await db.$executeRawUnsafe(`DELETE FROM public."RSVP" WHERE "guestId" = ANY($1::text[])`, Object.values(g))
    await db.$executeRawUnsafe(`DELETE FROM public."Guest" WHERE "weddingId" = $1`, WEDDING)
    await db.$executeRawUnsafe(`DELETE FROM public."Wedding" WHERE id = $1`, WEDDING)
    await db.$executeRawUnsafe(`DELETE FROM public."Couple" WHERE id = $1`, `${WEDDING}-couple`)
    await db.$executeRawUnsafe(`DELETE FROM public."User" WHERE id = $1`, ACTOR)
    await db.$disconnect()
  })

  test('1. a Guest with no history and no RSVP deletes, with an audit event', async () => {
    const result = await ops.deletePlannerGuest(actor(), g.plain)
    expect(result).toMatchObject({ ok: true, status: 200, data: { id: g.plain, deleted: true, kind: 'guest' } })
    expect(await guestExists(g.plain)).toBe(0)
    expect(await count(`SELECT count(*)::bigint AS n FROM public."AuditEvent" WHERE "resourceId" = $1 AND action = 'guest.delete'`, g.plain)).toBe(1)
  })

  test('2. an RSVP-only Guest deletes with their RSVP (personal link)', async () => {
    const result = await ops.deletePlannerGuest(actor(), g.rsvpOnly)
    expect(result.ok).toBe(true)
    expect(await guestExists(g.rsvpOnly)).toBe(0)
    expect(await count(`SELECT count(*)::bigint AS n FROM public."RSVP" WHERE "guestId" = $1`, g.rsvpOnly)).toBe(0)
  })

  test('3. a Guest with a Wedding Pass (live or revoked) is a deliberate 409, not a 500', async () => {
    for (const id of [g.pass, g.revokedPass]) {
      const result = await ops.deletePlannerGuest(actor(), id)
      expect(result).toMatchObject({ ok: false, status: 409, code: 'GUEST_DELETE_CONFLICT', protectedRecords: ['wedding_pass'] })
      if (!result.ok) {
        expect(result.error).toContain("can't be deleted")
        expect(result.error).toContain('Not attending')
        expect(result.error).not.toMatch(/foreign key|constraint|P2003|violat/i)
      }
      expect(await guestExists(id)).toBe(1)
      expect(await count(`SELECT count(*)::bigint AS n FROM public."RSVP" WHERE "guestId" = $1`, id)).toBe(1)
      expect(await count(`SELECT count(*)::bigint AS n FROM public."WeddingPassCredential" WHERE "guestId" = $1`, id)).toBe(1)
    }
  })

  test('4. a checked-in Guest is a deliberate 409 naming pass and check-in history', async () => {
    const result = await ops.deletePlannerGuest(actor(), g.checkedIn)
    expect(result).toMatchObject({ ok: false, status: 409, code: 'GUEST_DELETE_CONFLICT', protectedRecords: ['wedding_pass', 'check_in'] })
    expect(await guestExists(g.checkedIn)).toBe(1)
    expect(await count(`SELECT count(*)::bigint AS n FROM public."WeddingCheckIn" WHERE "guestId" = $1`, g.checkedIn)).toBe(1)
  })

  test('5. a Guest with a gift / contribution record (either store) is a deliberate 409', async () => {
    for (const id of [g.contribution, g.contributor]) {
      const result = await ops.deletePlannerGuest(actor(), id)
      expect(result).toMatchObject({ ok: false, status: 409, code: 'GUEST_DELETE_CONFLICT', protectedRecords: ['contribution'] })
      expect(await guestExists(id)).toBe(1)
    }
    expect(await count(`SELECT count(*)::bigint AS n FROM public."GuestContribution" WHERE "guestId" = $1`, g.contribution)).toBe(1)
    // The contributor keeps its Guest attribution (the SET NULL would otherwise silently detach it).
    expect(await count(`SELECT count(*)::bigint AS n FROM wewed_contributions.contributors WHERE guest_id = $1`, g.contributor)).toBe(1)
  })

  test('6. a protected record appearing mid-delete still resolves to the same 409 (FK race)', async () => {
    // Simulate the race: the pre-check sees no history, then the database refuses the delete.
    await wd.ensureWeddingPassCredential({ weddingId: WEDDING, guestId: g.raced })
    const realTransaction = db.$transaction.bind(db)
    const patched = db as unknown as { $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> }
    const original = patched.$transaction
    patched.$transaction = (fn) =>
      realTransaction(async (tx) => {
        const proxied = new Proxy(tx as object, {
          get(target, prop) {
            if (prop === 'weddingPassCredential') return { count: async () => 0 }
            return Reflect.get(target, prop)
          },
        })
        return fn(proxied)
      })
    try {
      const result = await ops.deletePlannerGuest(actor(), g.raced)
      expect(result).toMatchObject({ ok: false, status: 409, code: 'GUEST_DELETE_CONFLICT' })
      if (!result.ok && 'protectedRecords' in result) expect(result.protectedRecords).toContain('wedding_pass')
    } finally {
      patched.$transaction = original
    }
    expect(await guestExists(g.raced)).toBe(1)
    expect(await count(`SELECT count(*)::bigint AS n FROM public."RSVP" WHERE "guestId" = $1`, g.raced)).toBe(1)
  })

  test('7. no protected history was deleted by any attempt', async () => {
    expect(await count(`SELECT count(*)::bigint AS n FROM public."WeddingPassCredential" WHERE "weddingId" = $1`, WEDDING)).toBe(4)
    expect(await count(`SELECT count(*)::bigint AS n FROM public."WeddingCheckIn" WHERE "weddingId" = $1`, WEDDING)).toBe(1)
    expect(await count(`SELECT count(*)::bigint AS n FROM public."GuestContribution" WHERE "weddingId" = $1`, WEDDING)).toBe(1)
    expect(await count(`SELECT count(*)::bigint AS n FROM public."AuditEvent" WHERE "weddingId" = $1 AND action = 'guest.delete'`, WEDDING)).toBe(2)
  })
})
