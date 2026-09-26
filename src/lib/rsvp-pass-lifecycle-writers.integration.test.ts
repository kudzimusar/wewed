/**
 * QRO 01 §25 — RSVP mutation authority and the RSVP ↔ Wedding Pass lifecycle.
 *
 * Every writer that can move a Guest's attendance away from `true` must withdraw the Guest's live
 * Wedding Pass in the same transaction. The Guest self-service writers share `applyGuestRsvpUpdate`
 * and the Planner worksheet import withdraws inline; this suite closes the remaining writer, the
 * Planner worksheet *rollback*, which restored pre-import RSVP state without withdrawing, and
 * classifies every RSVP writer in the codebase so a new one cannot appear unreviewed.
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

mock.module('server-only', () => ({}))

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'qro01-rsvp-lifecycle-secret'
}

const describeDb = isLocal ? describe : describe.skip

describeDb('Planner worksheet rollback preserves the RSVP ↔ Wedding Pass lifecycle', () => {
  let db: typeof import('@/lib/db')['db']
  let wd: typeof import('@/lib/wedding-day')
  let rollbackGuestWorksheetImport: typeof import('@/lib/import-engine/guest-worksheet-rollback')['rollbackGuestWorksheetImport']

  const run = randomUUID().slice(0, 8)
  const WEDDING = `qro01-rb-${run}`
  const guests = { declines: `${WEDDING}-g1`, removed: `${WEDDING}-g2`, stays: `${WEDDING}-g3` }

  const serializedRsvp = (guestId: string, attending: boolean | null) => ({
    id: `${guestId}-rsvp`,
    token: `${guestId}-token`,
    attending,
    mealChoice: null,
    plusOne: false,
    plusOneName: null,
    plusOneMeal: null,
    kidsAttending: false,
    kidsCount: 0,
    songRequests: null,
    dietaryNotes: null,
    message: null,
    checkedIn: false,
    checkedInAt: null,
    guestId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const liveCredentialCount = async (guestId: string) => {
    const rows = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM public."WeddingPassCredential"
        WHERE "guestId" = $1 AND "revokedAt" IS NULL AND "supersededAt" IS NULL`,
      guestId,
    )
    return Number(rows[0]?.n ?? 0)
  }

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    wd = await import('@/lib/wedding-day')
    ;({ rollbackGuestWorksheetImport } = await import('@/lib/import-engine/guest-worksheet-rollback'))
    const ww2 = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = ww2.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_WW2_KEY_ID = `ww2-qro01-rb-${run}`
    const root = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM = root.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_ROOT_KEY_ID = `root-qro01-rb-${run}`
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'
    delete process.env.VERCEL_ENV

    await db.$executeRawUnsafe(
      `INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'A', 'B', now())`,
      `${WEDDING}-couple`,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "updatedAt")
       VALUES ($1, $1, 'Rollback Wedding', now() + interval '3 days', 'Venue', 'City', 'Country', $2, now())`,
      WEDDING, `${WEDDING}-couple`,
    )
    for (const guestId of Object.values(guests)) {
      await db.$executeRawUnsafe(
        `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt") VALUES ($1, $2, 'Guest', now())`,
        guestId, WEDDING,
      )
      await db.$executeRawUnsafe(
        `INSERT INTO public."RSVP" (id, "guestId", token, attending, "updatedAt") VALUES ($1, $2, $3, TRUE, now())`,
        `${guestId}-rsvp`, guestId, `${guestId}-token`,
      )
      await wd.ensureWeddingPassCredential({ weddingId: WEDDING, guestId })
      expect(await liveCredentialCount(guestId)).toBe(1)
    }
  })

  afterAll(async () => {
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    if (!db) return
    for (const t of ['AuditEvent', 'WeddingPassCredential', 'WeddingPassKey']) {
      await db.$executeRawUnsafe(`DELETE FROM public."${t}" WHERE "weddingId" = $1`, WEDDING)
    }
    await db.$executeRawUnsafe(`DELETE FROM public."RSVP" WHERE "guestId" = ANY($1::text[])`, Object.values(guests))
    await db.$executeRawUnsafe(`DELETE FROM public."Guest" WHERE "weddingId" = $1`, WEDDING)
    await db.$executeRawUnsafe(`DELETE FROM public."Wedding" WHERE id = $1`, WEDDING)
    await db.$executeRawUnsafe(`DELETE FROM public."Couple" WHERE id = $1`, `${WEDDING}-couple`)
    await db.$disconnect()
  })

  test('restoring non-attendance or removing the RSVP withdraws the live Pass; attending stays untouched', async () => {
    const guestRow = { name: 'Guest', email: null, phone: null, seatingTableId: null, tableNumber: null }
    const result = await rollbackGuestWorksheetImport(
      {
        kind: 'guest-worksheet-v2',
        jobId: `${WEDDING}-job`,
        moduleKey: 'guests',
        weddingId: WEDDING,
        createdIds: [],
        executedAt: new Date().toISOString(),
        updatedSnapshots: [
          { guestId: guests.declines, guest: guestRow, rsvp: serializedRsvp(guests.declines, null), worksheet: null },
          { guestId: guests.removed, guest: guestRow, rsvp: null, worksheet: null },
          { guestId: guests.stays, guest: guestRow, rsvp: serializedRsvp(guests.stays, true), worksheet: null },
        ],
      },
      WEDDING,
    )
    expect(result).toMatchObject({ restored: 3, failed: 0 })

    expect(await liveCredentialCount(guests.declines)).toBe(0)
    expect(await liveCredentialCount(guests.removed)).toBe(0)
    expect(await liveCredentialCount(guests.stays)).toBe(1)

    const reasons = await db.$queryRawUnsafe<Array<{ guestId: string; revocationReason: string | null }>>(
      `SELECT "guestId", "revocationReason" FROM public."WeddingPassCredential"
        WHERE "weddingId" = $1 AND "revokedAt" IS NOT NULL ORDER BY "guestId"`,
      WEDDING,
    )
    expect(reasons).toEqual([
      { guestId: guests.declines, revocationReason: wd.ATTENDANCE_WITHDRAWN_REASON },
      { guestId: guests.removed, revocationReason: wd.ATTENDANCE_WITHDRAWN_REASON },
    ])
  })
})

describe('every RSVP writer is classified against the Wedding Pass lifecycle', () => {
  // Writers that can move attendance away from `true`: each must withdraw the live Pass.
  const LIFECYCLE_AWARE = new Set([
    'src/lib/guest-rsvp-mutation.ts',
    'src/lib/import-engine/guest-worksheet-apply.ts',
    'src/lib/import-engine/guest-worksheet-rollback.ts',
  ])
  // Writers that never change `attending`: arrival flags, invitation token rotation, creation of
  // an empty RSVP for a new Guest, and deletion of a Guest's rows (credentials FK-restrict it).
  const ATTENDANCE_NEUTRAL = new Set([
    'src/app/api/rsvp/[token]/route.ts',
    'src/app/api/planner/event-day/route.ts',
    'src/app/api/planner/guests/route.ts',
    'src/app/api/planner/guests/[id]/route.ts',
    'src/app/api/planner/guests/invitations/route.ts',
    'src/lib/wedding-day.ts',
  ])
  const RSVP_WRITE = /rSVP\.(update|updateMany|upsert|create|createMany|delete|deleteMany)\(|UPDATE public\."RSVP"|INSERT INTO public\."RSVP"|DELETE FROM public\."RSVP"/

  function sources(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) sources(path, out)
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path)
    }
    return out
  }

  test('no unclassified RSVP writer exists', () => {
    const writers = sources('src').filter((path) => RSVP_WRITE.test(readFileSync(path, 'utf8')))
    const unclassified = writers.filter((path) => !LIFECYCLE_AWARE.has(path) && !ATTENDANCE_NEUTRAL.has(path))
    expect(unclassified).toEqual([])
  })

  test('lifecycle-aware writers withdraw the Pass', () => {
    for (const path of LIFECYCLE_AWARE) {
      expect(readFileSync(path, 'utf8')).toContain('withdrawWeddingPassesForAttendance(tx')
    }
  })

  test('attendance-neutral writers never write attendance', () => {
    for (const path of ATTENDANCE_NEUTRAL) {
      const source = readFileSync(path, 'utf8')
      // No write payload may set `attending` (reads and selects are fine).
      expect(/(data|update|create)\s*:\s*\{[^}]*\battending\s*:/.test(source)).toBe(false)
      expect(/SET[^;`]*"?attending"?\s*=/.test(source)).toBe(false)
    }
  })
})
