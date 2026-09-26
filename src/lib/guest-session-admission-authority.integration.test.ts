/// <reference types="bun-types" />

/**
 * QR-P0-01 — a Guest Session is never venue-admission authority.
 *
 * `PATCH /api/weddings/[slug]/guest-session` previously set `RSVP.checkedIn = true` for whoever
 * held the Guest Session cookie, so a guest (or anyone holding their invitation link) could
 * self-admit from anywhere. These tests run the real route handlers against a disposable
 * PostgreSQL database and prove:
 *  - the Guest Session PATCH refuses without touching the RSVP;
 *  - the Guest Session PUT (RSVP self-service) cannot smuggle `checkedIn`/`checkedInAt`;
 *  - a Guest Session alone cannot reach the operator check-in route;
 *  - the authorized operator check-in path (`POST /api/planner/event-day`, `guests.edit`) still
 *    records arrival with an audit event.
 *
 * `WeddingCheckIn` (the Phase-11 Gate ledger) does not exist on this production line; the
 * authoritative operator record here is the permission-gated planner event-day write and its
 * `event_day.guest_check_in` audit event. The WeddingCheckIn equivalent of these assertions lives
 * on the Phase-13 convergence line.
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

mock.module('server-only', () => ({}))
process.env.WEWED_SESSION_SECRET ||= `lqr01-test-${randomUUID()}`

const realWeddingAccess = { ...(await import('@/lib/wedding-access')) }
// Capture the real function before mock.module live-patches the module namespace.
const realRequireWeddingPermission = realWeddingAccess.requireWeddingPermission
let operatorContext: null | { weddingId: string; userId: string } = null

// Only the operator's membership lookup is substituted, and only for the explicitly authorized
// operator case. Every Guest Session request below goes through the real permission check.
mock.module('@/lib/wedding-access', () => ({
  ...realWeddingAccess,
  requireWeddingPermission: async (request: NextRequest, permission: string) => {
    if (!operatorContext) return realRequireWeddingPermission(request, permission)
    if (permission !== 'guests.edit') throw new Error(`unexpected permission ${permission}`)
    return {
      error: null,
      context: {
        weddingId: operatorContext.weddingId,
        role: 'planner',
        permissions: ['guests.edit'],
        session: { userId: operatorContext.userId },
      },
    }
  },
}))

const { db } = await import('@/lib/db')
const { WEDDING_GUEST_SESSION_COOKIE, createWeddingGuestSessionToken } = await import(
  '@/lib/wedding-guest-session'
)
const guestSessionRoute = await import('@/app/api/weddings/[slug]/guest-session/route')
const eventDayRoute = await import('@/app/api/planner/event-day/route')

const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
const ids = {
  couple: '',
  wedding: '',
  weddingSlug: `lqr01-checkin-${suffix}`,
  guest: '',
  rsvpToken: `lqr01-rsvp-${suffix}`,
  operator: '',
}

function guestCookie(): string {
  return `${WEDDING_GUEST_SESSION_COOKIE}=${createWeddingGuestSessionToken({
    weddingId: ids.wedding,
    guestId: ids.guest,
    rsvpToken: ids.rsvpToken,
  })}`
}

function guestRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/weddings/${ids.weddingSlug}/guest-session`, {
    method,
    headers: { cookie: guestCookie(), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const routeParams = () => ({ params: Promise.resolve({ slug: ids.weddingSlug }) })

async function rsvpState() {
  return db.rSVP.findUniqueOrThrow({
    where: { token: ids.rsvpToken },
    select: { checkedIn: true, checkedInAt: true, attending: true },
  })
}

async function checkInAuditCount() {
  return db.auditEvent.count({
    where: { weddingId: ids.wedding, action: 'event_day.guest_check_in' },
  })
}

beforeAll(async () => {
  const couple = await db.couple.create({
    data: { slug: `lqr01-couple-${suffix}`, partner1: 'Gate', partner2: 'Authority' },
  })
  const wedding = await db.wedding.create({
    data: {
      slug: ids.weddingSlug,
      title: 'Guest Check-in Authority Wedding',
      date: new Date('2031-06-14T12:00:00.000Z'),
      venue: 'Test Venue',
      venueCity: 'Test City',
      venueCountry: 'Test Country',
      privacy: 'link_only',
      coupleId: couple.id,
    },
  })
  const guest = await db.guest.create({ data: { name: 'Tendai Guest', weddingId: wedding.id } })
  await db.rSVP.create({ data: { guestId: guest.id, token: ids.rsvpToken, attending: true } })
  const operator = await db.user.create({
    data: { email: `lqr01-operator-${suffix}@example.invalid`, name: 'Gate Operator', role: 'planner' },
  })
  Object.assign(ids, { couple: couple.id, wedding: wedding.id, guest: guest.id, operator: operator.id })
})

afterAll(async () => {
  if (!ids.wedding) return
  await db.auditEvent.deleteMany({ where: { weddingId: ids.wedding } })
  await db.rSVP.deleteMany({ where: { guestId: ids.guest } })
  await db.guest.deleteMany({ where: { weddingId: ids.wedding } })
  await db.wedding.deleteMany({ where: { id: ids.wedding } })
  await db.couple.deleteMany({ where: { id: ids.couple } })
  await db.user.deleteMany({ where: { id: ids.operator } })
})

describe('QR-P0-01 Guest Session is not admission authority', () => {
  test('the Guest Session is genuinely valid (GET authorizes this guest)', async () => {
    const response = await guestSessionRoute.GET(guestRequest('GET'), routeParams())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.authorized).toBe(true)
    expect(body.guest.id).toBe(ids.guest)
  })

  test('valid Guest Session PATCH is refused and does not mutate checkedIn', async () => {
    const before = await rsvpState()
    expect(before.checkedIn).toBe(false)
    const auditBefore = await checkInAuditCount()

    const response = await guestSessionRoute.PATCH()
    const body = await response.json()

    expect(response.status).toBe(405)
    expect(body.success).toBe(false)
    expect(body.code).toBe('GUEST_SESSION_NOT_ADMISSION_AUTHORITY')
    expect(body.rsvp).toBeUndefined()
    expect(response.headers.get('Allow')).not.toContain('PATCH')
    expect(response.headers.get('Cache-Control')).toContain('no-store')

    const after = await rsvpState()
    expect(after.checkedIn).toBe(false)
    expect(after.checkedInAt).toBeNull()
    expect(await checkInAuditCount()).toBe(auditBefore)
  })

  test('Guest Session RSVP PUT cannot smuggle checkedIn / checkedInAt', async () => {
    const response = await guestSessionRoute.PUT(
      guestRequest('PUT', {
        originGuestId: ids.guest,
        attending: true,
        message: 'See you there',
        checkedIn: true,
        checkedInAt: new Date('2031-06-14T12:00:00.000Z').toISOString(),
      }),
      routeParams(),
    )
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.rsvp.message).toBe('See you there')
    expect(body.rsvp.checkedIn).toBe(false)

    const after = await rsvpState()
    expect(after.checkedIn).toBe(false)
    expect(after.checkedInAt).toBeNull()
  })

  test('a Guest Session alone cannot reach the operator check-in route', async () => {
    operatorContext = null
    const response = await eventDayRoute.POST(
      new NextRequest('http://localhost/api/planner/event-day', {
        method: 'POST',
        headers: { cookie: guestCookie(), 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'set_check_in', guestId: ids.guest, checkedIn: true }),
      }),
    )
    expect([401, 403]).toContain(response.status)
    const after = await rsvpState()
    expect(after.checkedIn).toBe(false)
    expect(await checkInAuditCount()).toBe(0)
  })

  test('the authorized operator check-in path remains authoritative and audited', async () => {
    operatorContext = { weddingId: ids.wedding, userId: ids.operator }
    try {
      const response = await eventDayRoute.POST(
        new NextRequest('http://localhost/api/planner/event-day', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'set_check_in', guestId: ids.guest, checkedIn: true }),
        }),
      )
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.checkedIn).toBe(true)
    } finally {
      operatorContext = null
    }

    const after = await rsvpState()
    expect(after.checkedIn).toBe(true)
    expect(after.checkedInAt).toBeInstanceOf(Date)
    const audit = await db.auditEvent.findFirstOrThrow({
      where: { weddingId: ids.wedding, action: 'event_day.guest_check_in' },
    })
    expect(audit.actorId).toBe(ids.operator)
    expect(audit.resourceId).toBe(ids.guest)
  })

  test('a later Guest Session PATCH cannot reverse or re-stamp the operator check-in', async () => {
    const before = await rsvpState()
    const response = await guestSessionRoute.PATCH()
    expect(response.status).toBe(405)
    const after = await rsvpState()
    expect(after.checkedIn).toBe(true)
    expect(after.checkedInAt?.toISOString()).toBe(before.checkedInAt?.toISOString())
  })
})
