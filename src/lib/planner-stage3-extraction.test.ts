import { describe, expect, test } from 'bun:test'
import {
  ACTIVE_PLANNER_SOURCE_PATHS,
  KNOWN_ACTIVE_PARITY_GAPS,
  ORIGINAL_PLANNER_SOURCE,
  missingActiveCapabilities,
} from './planner-parity-contract'

const MODULES = [
  {
    key: 'tasks',
    path: 'src/components/wedding/planner/modules/planner-tasks-module.tsx',
    importName: 'PlannerTasksModule',
    markers: [
      'workspace-task-title',
      'taskForm.category',
      'taskForm.priority',
      'taskForm.dueDate',
      'taskProgressPercent',
      'No tasks yet',
      'onUpdateTaskStatus(task, event.target.value)',
    ],
  },
  {
    key: 'budget',
    path: 'src/components/wedding/planner/modules/planner-budget-module.tsx',
    importName: 'PlannerBudgetModule',
    markers: [
      "['Estimated', budgetSummary?.totalEstimated",
      "['Actual', budgetSummary?.totalActual",
      "['Paid', budgetSummary?.totalPaid",
      "['Outstanding', budgetSummary?.totalOutstanding",
      'budgetForm.description',
      'budgetForm.category',
      'budgetForm.estimatedCost',
      "onUpdateBudgetItem(item, 'actualCost'",
      "onUpdateBudgetItem(item, 'paidAmount'",
      'No budget items',
    ],
  },
  {
    key: 'vendors',
    path: 'src/components/wedding/planner/modules/planner-vendors-module.tsx',
    importName: 'PlannerVendorsModule',
    markers: [
      'vendorForm.name',
      'vendorForm.category',
      'vendorForm.contact',
      'vendor.contractStatus',
      'vendor.paymentStatus',
      'No vendors yet',
    ],
  },
  {
    key: 'guests',
    path: 'src/components/wedding/planner/modules/planner-guests-module.tsx',
    importName: 'PlannerGuestsModule',
    markers: [
      'guestForm.name',
      'guestForm.email',
      'guestStats.confirmed',
      'guestStats.heads',
      'guest.rsvp?.attending',
      'guest.seatingTableName',
      'No guests yet',
    ],
  },
  {
    key: 'timeline',
    path: 'src/components/wedding/planner/modules/planner-timeline-module.tsx',
    importName: 'PlannerTimelineModule',
    markers: [
      'timelineForm.time',
      'timelineForm.event',
      'timelineForm.location',
      'item.duration',
      'No timeline items',
    ],
  },
  {
    key: 'seating',
    path: 'src/components/wedding/planner/modules/planner-seating-module.tsx',
    importName: 'PlannerSeatingModule',
    markers: [
      'tableForm.name',
      'tableForm.capacity',
      'tableOccupancy.get(table.id)',
      'occupied > table.capacity',
      'No seating tables',
    ],
  },
] as const

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Stage 3 six-module extraction', () => {
  test('workspace mounts every extracted module in the existing tabs', async () => {
    const workspace = await source('src/components/wedding/planner-workspace.tsx')

    for (const module of MODULES) {
      expect(workspace).toContain(`import { ${module.importName} }`)
      expect(workspace).toContain(`activeTab === '${module.key}'`)
      expect(workspace).toContain(`<${module.importName}`)
    }

    expect(workspace).toContain('tasks={tasks}')
    expect(workspace).toContain('budget={budget}')
    expect(workspace).toContain('vendors={vendors}')
    expect(workspace).toContain('guests={guests}')
    expect(workspace).toContain('timeline={timeline}')
    expect(workspace).toContain('tables={tables}')
  })

  test('extracted modules preserve the currently active behavior exactly', async () => {
    for (const module of MODULES) {
      const moduleSource = await source(module.path)
      for (const marker of module.markers) {
        expect(moduleSource).toContain(marker)
      }
    }
  })

  test('workspace retains the shared active-wedding data and mutation layer', async () => {
    const workspace = await source('src/components/wedding/planner-workspace.tsx')

    for (const marker of [
      "api<{ data: TaskRow[] }>('/api/planner/tasks')",
      'byCategory: CategoryBreakdown[]',
      ">('/api/planner/budget')",
      "api<{ data: VendorRow[] }>('/api/planner/vendors')",
      "api<{ data: GuestRow[]; tables: SeatingTableRow[] }>('/api/planner/guests')",
      "api<{ data: TimelineRow[] }>('/api/planner/timeline')",
      'window.setInterval(() => void refresh(false), 30_000)',
      'async function addTask',
      'async function updateTaskStatus',
      'async function addBudgetItem',
      'async function updateBudgetItem',
      'async function addVendor',
      'async function addGuest',
      'async function addTimelineItem',
      'async function addTable',
    ]) {
      expect(workspace).toContain(marker)
    }
  })

  test('extraction does not reintroduce the retired shell, auth, or client seeding', async () => {
    const sources = await Promise.all(
      ['src/components/wedding/planner-workspace.tsx', ...MODULES.map((module) => module.path)].map(
        source,
      ),
    )

    for (const activeSource of sources) {
      expect(activeSource).not.toContain('<Dialog')
      expect(activeSource).not.toContain('SEED_')
      expect(activeSource).not.toContain('Charity')
      expect(activeSource).not.toContain('Kudzie')
      expect(activeSource).not.toContain('admin-auth')
      expect(activeSource).not.toContain('isAdminLoggedIn')
    }
  })

  test('known original parity debt is unchanged by extraction', async () => {
    const activeSurface = (
      await Promise.all(
        [...ACTIVE_PLANNER_SOURCE_PATHS, ...MODULES.map((module) => module.path)].map(source),
      )
    ).join('\n')

    expect(missingActiveCapabilities(activeSurface)).toEqual([...KNOWN_ACTIVE_PARITY_GAPS])
  })

  test('the original mature implementations remain the restoration sources', async () => {
    const original = await source(ORIGINAL_PLANNER_SOURCE)

    for (const marker of [
      'function ChecklistTab',
      'function BudgetTab',
      'function VendorsTab',
      'function GuestsTab',
      'function TimelineTab',
      'function SeatingTab',
      '<ImportExportBar moduleKey="checklist"',
      '<ImportExportBar moduleKey="budget"',
      '<ImportExportBar moduleKey="vendors"',
      '<ImportExportBar moduleKey="guests"',
      '<ImportExportBar moduleKey="timeline"',
      '<ImportExportBar moduleKey="seating"',
    ]) {
      expect(original).toContain(marker)
    }
  })
})
