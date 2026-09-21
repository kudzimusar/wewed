import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'
mock.module('server-only', () => ({}))
process.env.WEWED_SESSION_SECRET = 'synthetic-projection-test-secret'
let record: any
let query: any
let rawQueries = 0
mock.module('@/lib/db', () => ({ db: {
  rSVP: { findUnique: async (input: any) => { query = input; return record } },
  guest: { findFirst: async (input: any) => { query = input; return record } },
  $queryRawUnsafe: async () => { rawQueries++; return [] },
} }))
const { createWeddingGuestSessionToken, verifyWeddingGuestSessionToken } = await import('./wedding-guest-session')
const { resolveGuestSessionForWedding } = await import('./wedding-public-access')
const { guestPassForRequest, readWeddingDayGuestContext } = await import('./wedding-day')
const identity = { weddingId: 'wedding', guestId: 'guest-a', rsvpToken: 'test-private-a' }
const session = () => verifyWeddingGuestSessionToken(createWeddingGuestSessionToken(identity))!
const request = () => new NextRequest('https://wewed.pro/api/wedding-day/pass', { headers: { cookie: `wewed_wedding_guest=${createWeddingGuestSessionToken(identity)}` } })
beforeEach(() => { rawQueries = 0 })
describe('guest-specific server projection and Wedding Day isolation', () => {
  test('only current guest seating relationship is selected', async () => {
    record = { token: identity.rsvpToken, guest: { id: 'guest-a', weddingId: 'wedding', name: 'Synthetic A', tableNumber: 1, seatingTable: { name: 'Acacia', weddingId: 'wedding' } } }
    const value = await resolveGuestSessionForWedding({ id: 'wedding' } as any, session())
    expect(value?.tableNumber).toBe(1)
    expect(value?.tableName).toBe('Acacia')
    expect(query.where).toEqual({ guestId: 'guest-a' })
    expect(query.include.guest.select.seatingTable).toEqual({ select: { name: true, weddingId: true } })
  })
  test('another guest and a cross-wedding table cannot leak', async () => {
    record = { token: identity.rsvpToken, guest: { id: 'guest-b', weddingId: 'wedding', seatingTable: { name: 'Private B', weddingId: 'wedding' } } }
    expect(await resolveGuestSessionForWedding({ id: 'wedding' } as any, session())).toBeNull()
    record.guest.id = 'guest-a'; record.guest.seatingTable.weddingId = 'other'
    expect((await resolveGuestSessionForWedding({ id: 'wedding' } as any, session()))?.tableName).toBeNull()
  })
  test('rotation rejects guest projection', async () => {
    record = { token: 'rotated', guest: { id: 'guest-a', weddingId: 'wedding' } }
    expect(await resolveGuestSessionForWedding({ id: 'wedding' } as any, session())).toBeNull()
  })
  test('rotated sessions never reach the WW2 issuer or Wedding Day query', async () => {
    record = { id: 'guest-a', weddingId: 'wedding', rsvp: { token: 'rotated', attending: true } }
    expect(await guestPassForRequest(request())).toBeNull()
    expect(await readWeddingDayGuestContext(request())).toBeNull()
    expect(rawQueries).toBe(0)
  })
  test('pending and declined cannot obtain pass or attending-only details', async () => {
    for (const attending of [null, false]) {
      record = { id: 'guest-a', weddingId: 'wedding', rsvp: { token: identity.rsvpToken, attending } }
      await expect(guestPassForRequest(request())).rejects.toThrow('ATTENDANCE_REQUIRED')
      await expect(readWeddingDayGuestContext(request())).rejects.toThrow('ATTENDANCE_REQUIRED')
    }
    expect(rawQueries).toBe(0)
  })
})
