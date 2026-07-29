import { describe, expect, test } from 'bun:test'
import {
  buildAutoAssignments,
  dateFromOffset,
  normalizeTitle,
  renderReminderTemplate,
  selectReminderRecipients,
} from './planner-phase2'

describe('phase 2 planner helpers', () => {
  test('selects pending RSVP recipients and deduplicates emails', () => {
    const recipients = selectReminderRecipients(
      [
        { id: '1', name: 'A', email: 'A@example.com', rsvp: { token: 't1', attending: null } },
        { id: '2', name: 'A duplicate', email: 'a@example.com', rsvp: { token: 't2', attending: null } },
        { id: '3', name: 'B', email: 'b@example.com', rsvp: { token: 't3', attending: true } },
        { id: '4', name: 'No email', email: null, rsvp: null },
      ],
      'pending',
    )

    expect(recipients).toHaveLength(1)
    expect(recipients[0]).toMatchObject({ guestId: '1', email: 'a@example.com', token: 't1' })
  })

  test('calculates relative template dates from the wedding date', () => {
    expect(dateFromOffset('2027-06-15T00:00:00.000Z', -30).toISOString()).toBe(
      '2027-05-16T00:00:00.000Z',
    )
    expect(dateFromOffset('2027-06-15T00:00:00.000Z', 7).toISOString()).toBe(
      '2027-06-22T00:00:00.000Z',
    )
  })

  test('auto seating never exceeds table capacity', () => {
    const result = buildAutoAssignments(
      [
        { id: 't1', name: 'Table 1', capacity: 4, occupied: 1 },
        { id: 't2', name: 'Table 2', capacity: 2, occupied: 0 },
      ],
      [
        { id: 'g1', name: 'Family', seatingTableId: null, headcount: 3 },
        { id: 'g2', name: 'Couple', seatingTableId: null, headcount: 2 },
        { id: 'g3', name: 'Single', seatingTableId: null, headcount: 1 },
      ],
    )

    expect(result.assignments).toEqual([
      { guestId: 'g1', tableId: 't1', headcount: 3 },
      { guestId: 'g2', tableId: 't2', headcount: 2 },
    ])
    expect(result.unassignedGuestIds).toEqual(['g3'])
  })

  test('renders reminder variables without evaluating unknown content', () => {
    expect(
      renderReminderTemplate('Hello {{ guest_name }} — {{rsvp_link}} {{unknown}}', {
        guest_name: 'Taylor',
        rsvp_link: 'https://example.test/rsvp',
      }),
    ).toBe('Hello Taylor — https://example.test/rsvp ')
  })

  test('normalizes duplicate titles', () => {
    expect(normalizeTitle('  Confirm   Venue ')).toBe('confirm venue')
  })
})
