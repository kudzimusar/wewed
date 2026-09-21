import { beforeEach, describe, expect, mock, test } from 'bun:test'
mock.module('server-only', () => ({}))
process.env.WEWED_SESSION_SECRET = 'synthetic-projection-test-secret'
let record: any
let query: any
mock.module('@/lib/db', () => ({ db: {
  rSVP: { findUnique: async (input: any) => { query = input; return record } },
  guest: { findFirst: async (input: any) => { query = input; return record } },
} }))
const { createWeddingGuestSessionToken, verifyWeddingGuestSessionToken } = await import('./wedding-guest-session')
const { resolveGuestSessionForWedding } = await import('./wedding-public-access')
const identity = { weddingId: 'wedding', guestId: 'guest-a', rsvpToken: 'test-private-a' }
const session = () => verifyWeddingGuestSessionToken(createWeddingGuestSessionToken(identity))!
beforeEach(() => { query = undefined })
// Guest Session v2 only: the server-side tableName projection and the guest/wedding isolation it
// depends on. Deliberately carries no dependency on ./wedding-day — that module, and the WW2/pass
// tests that exercise it, live on the Wedding Day promotion branch stacked on top of this one, so
// this branch can be reviewed and deployed without introducing the Wedding Day domain at all.
describe('guest-specific server projection', () => {
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
})
