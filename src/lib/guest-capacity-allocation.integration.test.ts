import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
}
mock.module('server-only', () => ({}))

type Db = typeof import('@/lib/db')['db']
let db: Db
let createPlannerGuest: typeof import('@/lib/planner-guest-operations')['createPlannerGuest']
let updatePlannerGuest: typeof import('@/lib/planner-guest-operations')['updatePlannerGuest']

const suffix = randomUUID().slice(0, 8)
let weddingId = ''
let coupleId = ''
let actorId = ''

describe.skipIf(!isLocal)('Guest capacity allocation against disposable PostgreSQL', () => {
  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ createPlannerGuest, updatePlannerGuest } = await import('@/lib/planner-guest-operations'))

    const couple = await db.couple.create({
      data: { slug: `capacity-${suffix}`, partner1: 'Capacity', partner2: 'Test' },
    })
    coupleId = couple.id

    const wedding = await db.wedding.create({
      data: {
        slug: `capacity-wedding-${suffix}`,
        title: 'Capacity UAT',
        date: new Date('2031-06-14T12:00:00.000Z'),
        venue: 'Disposable Venue',
        venueCity: 'Harare',
        venueCountry: 'Zimbabwe',
        coupleId,
      },
    })
    weddingId = wedding.id

    const actor = await db.user.create({
      data: { email: `capacity-${suffix}@example.com`, name: 'Capacity UAT Actor', role: 'planner' },
    })
    actorId = actor.id

    await db.weddingAttendanceAllocationLimit.create({
      data: {
        weddingId,
        allocation: 'groom',
        hardLimit: 1,
        warningAt: 1,
      },
    })
  })

  afterAll(async () => {
    if (!db || !weddingId) return
    await db.auditEvent.deleteMany({ where: { weddingId } })
    await db.rSVP.deleteMany({ where: { guest: { weddingId } } })
    await db.guest.deleteMany({ where: { weddingId } })
    await db.weddingAttendanceAllocationLimit.deleteMany({ where: { weddingId } })
    await db.wedding.delete({ where: { id: weddingId } })
    await db.user.delete({ where: { id: actorId } })
    await db.couple.delete({ where: { id: coupleId } })
  })

  test('hard limit blocks create and reallocation while warning metadata remains non-blocking at threshold', async () => {
    const actor = { weddingId, actorId }

    const first = await createPlannerGuest(actor, {
      name: 'Groom Allocation One',
      attendanceAllocation: 'groom',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.capacity).toMatchObject({
      allocation: 'groom',
      registered: 1,
      hardLimit: 1,
      warning: true,
      remaining: 0,
    })

    const blockedCreate = await createPlannerGuest(actor, {
      name: 'Groom Allocation Two',
      attendanceAllocation: 'groom',
    })
    expect(blockedCreate.ok).toBe(false)
    if (blockedCreate.ok) return
    expect(blockedCreate.status).toBe(409)
    expect(blockedCreate.field).toBe('attendanceAllocation')
    expect(blockedCreate.error).toContain('Groom allocation is full')

    const shared = await createPlannerGuest(actor, {
      name: 'Shared Allocation',
      attendanceAllocation: 'shared',
    })
    expect(shared.ok).toBe(true)
    if (!shared.ok) return

    const blockedMove = await updatePlannerGuest(actor, shared.data.id, {
      attendanceAllocation: 'groom',
    })
    expect(blockedMove.ok).toBe(false)
    if (blockedMove.ok) return
    expect(blockedMove.status).toBe(409)
    expect(blockedMove.field).toBe('attendanceAllocation')

    const groomCount = await db.guest.count({ where: { weddingId, attendanceAllocation: 'groom' } })
    expect(groomCount).toBe(1)
  })
})
