import { describe, expect, it } from 'bun:test'
import { combineWeddingDateAndProgrammeTime, isCalendarItemInRange } from './contracts'

describe('calendar projection contracts', () => {
  it('combines a wedding date with 24-hour programme time', () => {
    const weddingDate = new Date(2026, 10, 14, 0, 0, 0, 0)
    const result = combineWeddingDateAndProgrammeTime(weddingDate, '14:30')

    expect(result.allDay).toBe(false)
    expect(result.date.getFullYear()).toBe(2026)
    expect(result.date.getMonth()).toBe(10)
    expect(result.date.getDate()).toBe(14)
    expect(result.date.getHours()).toBe(14)
    expect(result.date.getMinutes()).toBe(30)
  })

  it('combines a wedding date with 12-hour programme time', () => {
    const weddingDate = new Date(2026, 10, 14, 0, 0, 0, 0)
    const result = combineWeddingDateAndProgrammeTime(weddingDate, '2:05 pm')

    expect(result.allDay).toBe(false)
    expect(result.date.getHours()).toBe(14)
    expect(result.date.getMinutes()).toBe(5)
  })

  it('falls back to an all-day item rather than guessing an invalid programme time', () => {
    const weddingDate = new Date(2026, 10, 14, 18, 30, 0, 0)
    const result = combineWeddingDateAndProgrammeTime(weddingDate, 'after photos')

    expect(result.allDay).toBe(true)
    expect(result.date.getHours()).toBe(0)
    expect(result.date.getMinutes()).toBe(0)
  })

  it('filters a projected item by the requested calendar range', () => {
    const item = { startAt: new Date('2026-11-14T10:00:00.000Z') }
    expect(
      isCalendarItemInRange(
        item,
        new Date('2026-11-01T00:00:00.000Z'),
        new Date('2026-11-30T23:59:59.999Z'),
      ),
    ).toBe(true)
    expect(
      isCalendarItemInRange(
        item,
        new Date('2026-12-01T00:00:00.000Z'),
        new Date('2026-12-31T23:59:59.999Z'),
      ),
    ).toBe(false)
  })
})
