import { describe, expect, test } from 'bun:test'
import {
  inferSeatingTableType,
  parseSeatingTableMetadata,
  plannedSeatsForGuest,
  seatingTableTypeLabel,
  serializeSeatingTableMetadata,
} from './planner-seating-metadata'

describe('planner seating metadata', () => {
  test('preserves legacy coordinate positions while adding operational metadata', () => {
    const parsed = parseSeatingTableMetadata(JSON.stringify({ x: 100, y: 200 }), 'High Table')
    expect(parsed).toEqual({
      tableType: 'high',
      zone: 'Floor position 100, 200',
      notes: null,
      x: 100,
      y: 200,
    })

    const serialized = serializeSeatingTableMetadata({
      ...parsed,
      zone: 'Stage centre',
      notes: 'Couple and bridal party',
    })
    expect(JSON.parse(serialized)).toEqual({
      version: 1,
      tableType: 'high',
      zone: 'Stage centre',
      notes: 'Couple and bridal party',
      x: 100,
      y: 200,
    })
  })

  test('treats plain legacy positions as zones and infers table classes', () => {
    expect(parseSeatingTableMetadata('Front left', 'VIP Parents — Bride')).toEqual({
      tableType: 'vip_parents',
      zone: 'Front left',
      notes: null,
    })
    expect(inferSeatingTableType('VIP Friends — Groom')).toBe('vip_friends')
    expect(inferSeatingTableType('Ordinary Table 12')).toBe('ordinary')
    expect(seatingTableTypeLabel('vip_parents')).toBe('VIP — parents')
  })

  test('counts the complete planned party size', () => {
    expect(plannedSeatsForGuest({ rsvp: null })).toBe(1)
    expect(plannedSeatsForGuest({ rsvp: { plusOne: true, kidsAttending: false, kidsCount: 0 } })).toBe(2)
    expect(plannedSeatsForGuest({ rsvp: { plusOne: true, kidsAttending: true, kidsCount: 3 } })).toBe(5)
    expect(plannedSeatsForGuest({ rsvp: { plusOne: false, kidsAttending: true, kidsCount: -2 } })).toBe(1)
  })
})
