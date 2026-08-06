import { describe, expect, test } from 'bun:test'
import { describeTaskDueState } from './task-due-state'

describe('describeTaskDueState', () => {
  const now = new Date('2026-08-06T09:00:00.000Z')

  test('keeps future UAT dates in the future', () => {
    expect(
      describeTaskDueState(
        new Date('2027-12-30T10:00:00.000Z'),
        'in_progress',
        now,
      ),
    ).toBe('due_in_511_days')
  })

  test('classifies relative dates deterministically', () => {
    expect(describeTaskDueState(new Date('2026-08-05T10:00:00.000Z'), 'todo', now))
      .toBe('overdue_by_1_days')
    expect(describeTaskDueState(new Date('2026-08-06T23:00:00.000Z'), 'todo', now))
      .toBe('due_today')
    expect(describeTaskDueState(new Date('2026-08-07T01:00:00.000Z'), 'todo', now))
      .toBe('due_tomorrow')
  })

  test('does not mark completed or undated tasks overdue', () => {
    expect(
      describeTaskDueState(
        new Date('2026-08-01T00:00:00.000Z'),
        'completed',
        now,
      ),
    ).toBe('completed')
    expect(describeTaskDueState(null, 'todo', now)).toBe('no_due_date')
  })
})
