import { describe, expect, test } from 'bun:test'
import { sanitizePulseFieldSnapshot, sanitizeTimelineFieldSnapshot } from './field-mode-policy'
import type { PlannerBudgetSummary, PlannerTask } from './types'

function task(index: number): PlannerTask {
  return {
    id: `task-${index}`,
    title: `Task ${index}`,
    description: `Private planning detail ${index}`,
    category: 'venue',
    status: 'todo',
    priority: index % 2 === 0 ? 'high' : 'medium',
    dueDate: '2027-01-15T09:00:00.000Z',
    assignee: 'Planner E2E',
  }
}

const budget: PlannerBudgetSummary = {
  totalEstimated: 5000,
  totalActual: 4800,
  totalPaid: 2400,
  totalOutstanding: 2400,
  currency: 'USD',
  percentPaid: 50,
}

describe('Field Mode privacy policy', () => {
  test('caps cached tasks at 100 and removes descriptions', () => {
    const source = Array.from({ length: 105 }, (_, index) => task(index))
    const snapshot = sanitizePulseFieldSnapshot({ tasks: source, budget })

    expect(snapshot.tasks).toHaveLength(100)
    expect(snapshot.tasks.every((item) => item.description === null)).toBe(true)
    expect(snapshot.tasks[0]?.id).toBe('task-0')
    expect(snapshot.tasks[99]?.id).toBe('task-99')
    expect(source[0]?.description).toBe('Private planning detail 0')
    expect(snapshot.budget).toEqual(budget)
  })

  test('caps cached timeline items at 150 and removes notes', () => {
    const source = Array.from({ length: 155 }, (_, index) => ({
      id: `timeline-${index}`,
      time: '15:00',
      title: `Programme item ${index}`,
      notes: `Private MC cue ${index}`,
      duration: '15 minutes',
      location: 'Primary Lawn',
      order: index,
    }))
    const snapshot = sanitizeTimelineFieldSnapshot(source)

    expect(snapshot).toHaveLength(150)
    expect(snapshot.every((item) => item.notes === '')).toBe(true)
    expect(snapshot[149]?.id).toBe('timeline-149')
    expect(source[0]?.notes).toBe('Private MC cue 0')
  })
})
