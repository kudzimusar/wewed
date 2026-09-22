import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
mock.module('server-only', () => ({}))
const originalSessionSecret = process.env.WEWED_SESSION_SECRET
let record: any
let query: any
const fakeDb = {
  rSVP: { findUnique: async (input: any) => { query = input; return record } },
} as any
const { createWeddingGuestSessionToken, verifyWeddingGuestSessionToken } = await import('./wedding-guest-session')
const { resolveGuestSessionForWedding } = await import('./wedding-public-access')
const identity = { weddingId: 'wedding', guestId: 'guest-a', rsvpToken: 'test-private-a' }
const session = () => verifyWeddingGuestSessionToken(createWeddingGuestSessionToken(identity))!
beforeEach(() => {
  query = undefined
  process.env.WEWED_SESSION_SECRET = 'synthetic-projection-test-secret'
})
afterEach(() => {
  if (originalSessionSecret === undefined) delete process.env.WEWED_SESSION_SECRET
  else process.env.WEWED_SESSION_SECRET = originalSessionSecret
})
// Guest Session v2 only: the server-side tableName projection and the guest/wedding isolation it
// depends on. Deliberately carries no dependency on ./wedding-day — that module, and the WW2/pass
// tests that exercise it, live on the Wedding Day promotion branch stacked on top of this one, so
// this branch can be reviewed and deployed without introducing the Wedding Day domain at all.
describe('guest-specific server projection', () => {
  test('only current guest seating relationship is selected', async () => {
    record = { token: identity.rsvpToken, guest: { id: 'guest-a', weddingId: 'wedding', name: 'Synthetic A', tableNumber: 1, seatingTable: { name: 'Acacia', weddingId: 'wedding' } } }
    const value = await resolveGuestSessionForWedding({ id: 'wedding' } as any, session(), fakeDb)
    expect(value?.tableNumber).toBe(1)
    expect(value?.tableName).toBe('Acacia')
    expect(query.where).toEqual({ guestId: 'guest-a' })
    expect(query.include.guest.select.seatingTable).toEqual({ select: { name: true, weddingId: true } })
  })
  test('another guest and a cross-wedding table cannot leak', async () => {
    record = { token: identity.rsvpToken, guest: { id: 'guest-b', weddingId: 'wedding', seatingTable: { name: 'Private B', weddingId: 'wedding' } } }
    expect(await resolveGuestSessionForWedding({ id: 'wedding' } as any, session(), fakeDb)).toBeNull()
    record.guest.id = 'guest-a'; record.guest.seatingTable.weddingId = 'other'
    expect((await resolveGuestSessionForWedding({ id: 'wedding' } as any, session(), fakeDb))?.tableName).toBeNull()
  })
  test('rotation rejects guest projection', async () => {
    record = { token: 'rotated', guest: { id: 'guest-a', weddingId: 'wedding' } }
    expect(await resolveGuestSessionForWedding({ id: 'wedding' } as any, session(), fakeDb)).toBeNull()
  })
})
