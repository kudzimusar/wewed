import { describe, expect, test } from 'bun:test'
import {
  comparePlannerIntegrity,
  createPlannerIntegritySnapshot,
  plannerIntegrityHash,
  snapshotsMatch,
  type PlannerIntegrityWeddingInput,
} from './planner-integrity'

function wedding(overrides: Partial<PlannerIntegrityWeddingInput> = {}): PlannerIntegrityWeddingInput {
  return {
    id: 'wedding-a',
    slug: 'charity-kudzie',
    title: 'Charity & Kudzie',
    date: new Date('2026-12-23T00:00:00.000Z'),
    venue: 'Imba Manor',
    plannerTasks: [
      { id: 'task-2', title: 'Book caterer', status: 'todo', weddingId: 'wedding-a' },
      { id: 'task-1', title: 'Set date', status: 'done', weddingId: 'wedding-a' },
    ],
    budgetItems: [
      {
        id: 'budget-1',
        description: 'Venue',
        estimatedCost: 5000,
        actualCost: 5200,
        paidAmount: 2500,
        weddingId: 'wedding-a',
      },
    ],
    vendors: [{ id: 'vendor-1', name: 'Imba Manor', weddingId: 'wedding-a' }],
    guests: [
      {
        id: 'guest-1',
        name: 'Tariro',
        weddingId: 'wedding-a',
        seatingTableId: 'table-1',
        rsvp: { attending: true, checkedIn: false },
      },
      {
        id: 'guest-2',
        name: 'Tendai',
        weddingId: 'wedding-a',
        seatingTableId: null,
        rsvp: { attending: null, checkedIn: false },
      },
    ],
    programmeItems: [{ id: 'timeline-1', time: '14:00', title: 'Ceremony', order: 1 }],
    seatingTables: [{ id: 'table-1', name: 'Family', capacity: 10, weddingId: 'wedding-a' }],
    memberships: [{ id: 'member-1', userId: 'user-1', role: 'planner', weddingId: 'wedding-a' }],
    importJobs: [],
    contentRevisions: [],
    ...overrides,
  }
}

describe('planner integrity snapshots', () => {
  test('is deterministic when record ordering changes', () => {
    const first = wedding()
    const second = wedding({
      plannerTasks: [...(first.plannerTasks ?? [])].reverse(),
      guests: [...(first.guests ?? [])].reverse(),
    })

    const before = createPlannerIntegritySnapshot([first], '2026-07-29T12:00:00.000Z')
    const after = createPlannerIntegritySnapshot([second], '2026-07-29T13:00:00.000Z')

    expect(snapshotsMatch(before, after)).toBe(true)
    expect(comparePlannerIntegrity(before, after)).toEqual([])
  })

  test('captures counts, financial totals, RSVP state, and capacity', () => {
    const snapshot = createPlannerIntegritySnapshot([wedding()])
    const result = snapshot.weddings[0]

    expect(result.tasks.count).toBe(2)
    expect(result.budget.totalEstimated).toBe(5000)
    expect(result.budget.totalActual).toBe(5200)
    expect(result.budget.totalPaid).toBe(2500)
    expect(result.guests.count).toBe(2)
    expect(result.guests.confirmed).toBe(1)
    expect(result.guests.pending).toBe(1)
    expect(result.guests.assignedToTable).toBe(1)
    expect(result.seating.totalCapacity).toBe(10)
  })

  test('reports content changes without exposing record contents in the summary hash', () => {
    const before = createPlannerIntegritySnapshot([wedding()], '2026-07-29T12:00:00.000Z')
    const after = createPlannerIntegritySnapshot(
      [wedding({ venue: 'Changed venue' })],
      '2026-07-29T13:00:00.000Z',
    )

    expect(snapshotsMatch(before, after)).toBe(false)
    expect(comparePlannerIntegrity(before, after)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ weddingId: 'wedding-a', path: 'wedding.hash' }),
      ]),
    )
  })

  test('keeps weddings isolated in the snapshot', () => {
    const second = wedding({
      id: 'wedding-b',
      slug: 'second-wedding',
      title: 'Second Wedding',
      plannerTasks: [{ id: 'task-b', title: 'Second task', weddingId: 'wedding-b' }],
      budgetItems: [],
      vendors: [],
      guests: [],
      programmeItems: [],
      seatingTables: [],
      memberships: [],
    })

    const snapshot = createPlannerIntegritySnapshot([second, wedding()])

    expect(snapshot.weddings.map((item) => item.id)).toEqual(['wedding-a', 'wedding-b'])
    expect(snapshot.weddings[0].tasks.count).toBe(2)
    expect(snapshot.weddings[1].tasks.count).toBe(1)
    expect(snapshot.weddings[0].tasks.hash).not.toBe(snapshot.weddings[1].tasks.hash)
  })

  test('detects wedding removal and record-count regression', () => {
    const second = wedding({ id: 'wedding-b', slug: 'second-wedding', title: 'Second Wedding' })
    const before = createPlannerIntegritySnapshot([wedding(), second])
    const after = createPlannerIntegritySnapshot([
      wedding({ plannerTasks: [{ id: 'task-1', title: 'Set date', status: 'done' }] }),
    ])

    const differences = comparePlannerIntegrity(before, after)

    expect(differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ weddingId: 'wedding-a', path: 'tasks.count', before: 2, after: 1 }),
        expect.objectContaining({ weddingId: 'wedding-b', path: 'wedding', after: null }),
      ]),
    )
  })

  test('does not mutate the supplied wedding records', () => {
    const input = wedding()
    const beforeHash = plannerIntegrityHash(input)

    createPlannerIntegritySnapshot([input])

    expect(plannerIntegrityHash(input)).toBe(beforeHash)
  })
})
