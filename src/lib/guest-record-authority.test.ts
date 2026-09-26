import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { guestPartySize, guestRsvpStatus, guestSeatingIdentity } from '@/lib/guest-record-authority'
import { weddingHouseholdAttendeeKeys } from '@/lib/wedding-pass-availability'

describe('shared Guest-record projection (QRO 01 §24)', () => {
  test('RSVP status has one derivation', () => {
    expect(guestRsvpStatus(true)).toBe('attending')
    expect(guestRsvpStatus(false)).toBe('declined')
    expect(guestRsvpStatus(null)).toBe('pending')
    expect(guestRsvpStatus(undefined)).toBe('pending')
  })

  test('a table is Guest authority only inside the same wedding', () => {
    const table = { id: 'table-1', name: 'Acacia', weddingId: 'wedding-a' }
    expect(guestSeatingIdentity(table, 'wedding-a')).toEqual({ seatingTableId: 'table-1', tableName: 'Acacia' })
    expect(guestSeatingIdentity(table, 'wedding-b')).toEqual({ seatingTableId: null, tableName: null })
    expect(guestSeatingIdentity(null, 'wedding-a')).toEqual({ seatingTableId: null, tableName: null })
  })

  test('party size is the canonical Gate household', () => {
    const rsvp = { plusOne: true, kidsAttending: true, kidsCount: 2 }
    expect(guestPartySize(rsvp)).toBe(weddingHouseholdAttendeeKeys(rsvp).length)
    expect(guestPartySize(rsvp)).toBe(4)
    expect(guestPartySize({ plusOne: false, kidsAttending: false, kidsCount: 3 })).toBe(1)
    expect(guestPartySize(null)).toBe(1)
  })

  test('desktop, native and Guest-session transports consume the one projection', () => {
    const native = readFileSync('src/app/api/native/wedding/guests/route.ts', 'utf8')
    expect(native).toContain('guestSeatingIdentity(guest.seatingTable, scope.weddingId)')
    expect(native).toContain('guestRsvpStatus(guest.rsvp?.attending)')
    expect(native).not.toContain("attending === true ? 'attending'")
    const desktop = readFileSync('src/app/api/planner/guests/route.ts', 'utf8')
    expect(desktop).toContain('guestRsvpStatus(g.rsvp?.attending)')
    expect(desktop).toContain('guestPartySize(g.rsvp)')
    expect(readFileSync('src/lib/wedding-public-access.ts', 'utf8')).toContain('guestSeatingIdentity(rsvp.guest.seatingTable, wedding.id)')
  })
})
