export type PlannerParityModule =
  | 'shell'
  | 'tasks'
  | 'budget'
  | 'vendors'
  | 'guests'
  | 'timeline'
  | 'seating'

export interface PlannerParityCapability {
  id: string
  module: PlannerParityModule
  description: string
  /** Markers that prove the capability existed in the original planner baseline. */
  originalMarkers: readonly string[]
  /** Markers required on the reachable active planner surface. */
  activeMarkers: readonly string[]
}

export const ORIGINAL_PLANNER_SOURCE = 'src/components/wedding/wedding-planner.tsx'

export const ACTIVE_PLANNER_SOURCE_PATHS = [
  'src/components/wedding/planner-portal.tsx',
  'src/components/wedding/planner-workspace.tsx',
] as const

/**
 * Functional contract extracted from the original WeddingPlanner implementation.
 *
 * A parser, API route, or unmounted component does not satisfy an active marker.
 * The marker must be reachable through PlannerPortal or the mounted workspace.
 */
export const ORIGINAL_PLANNER_PARITY = [
  {
    id: 'shell.six-core-modules',
    module: 'shell',
    description: 'Checklist, Budget, Vendors, Guests, Timeline, and Seating are all reachable.',
    originalMarkers: [
      '<TabsContent value="checklist"',
      '<TabsContent value="budget"',
      '<TabsContent value="vendors"',
      '<TabsContent value="guests"',
      '<TabsContent value="timeline"',
      '<TabsContent value="seating"',
    ],
    activeMarkers: [
      "activeTab === 'tasks'",
      "activeTab === 'budget'",
      "activeTab === 'vendors'",
      "activeTab === 'guests'",
      "activeTab === 'timeline'",
      "activeTab === 'seating'",
    ],
  },
  {
    id: 'tasks.create',
    module: 'tasks',
    description: 'A planner can manually create a task with planning fields.',
    originalMarkers: ['function ChecklistTab', 'Add Task', "fetch('/api/planner/tasks'"],
    activeMarkers: ['async function addTask', 'workspace-task-title'],
  },
  {
    id: 'tasks.status',
    module: 'tasks',
    description: 'A planner can update task completion/status.',
    originalMarkers: ['const toggleTask', 'body: JSON.stringify({ status: nextStatus })'],
    activeMarkers: ['async function updateTaskStatus', 'body: JSON.stringify({ status })'],
  },
  {
    id: 'tasks.delete',
    module: 'tasks',
    description: 'A planner can delete an incorrect or obsolete task.',
    originalMarkers: ['const deleteTask', "fetch(`/api/planner/tasks/${task.id}`, { method: 'DELETE' })"],
    activeMarkers: ['async function deleteTask', "method: 'DELETE'"],
  },
  {
    id: 'tasks.search-filter',
    module: 'tasks',
    description: 'Tasks can be searched and filtered by category and status.',
    originalMarkers: ['activeCategory', 'statusFilter', 'setSearch'],
    activeMarkers: ['taskSearch', 'taskCategoryFilter', 'taskStatusFilter'],
  },
  {
    id: 'tasks.assignee',
    module: 'tasks',
    description: 'Free-text task assignees remain editable and visible.',
    originalMarkers: ["assignee: ''", 'newTask.assignee'],
    activeMarkers: ['workspace-task-assignee', 'assignee: taskForm.assignee'],
  },
  {
    id: 'tasks.taxonomy',
    module: 'tasks',
    description: 'The original time-based and Zimbabwean planning taxonomy remains available.',
    originalMarkers: [
      'timeline_12_18',
      'timeline_9_12',
      'timeline_6_9',
      'timeline_3_6',
      'timeline_1mo',
      'timeline_2wk',
      'timeline_1wk',
      'wedding_day',
      'spiritual',
      'roora',
      'magumo',
    ],
    activeMarkers: [
      'timeline_12_18',
      'timeline_9_12',
      'timeline_6_9',
      'timeline_3_6',
      'timeline_1mo',
      'timeline_2wk',
      'timeline_1wk',
      'spiritual',
      'roora',
      'magumo',
    ],
  },
  {
    id: 'tasks.progress',
    module: 'tasks',
    description: 'Task progress, blocked work, and overdue work are reported.',
    originalMarkers: ['Checklist Progress', 'stats.percent', 'stats.blocked'],
    activeMarkers: ['Task progress', 'taskStats.percent', 'taskStats.blocked', 'taskStats.overdue'],
  },
  {
    id: 'tasks.worksheet',
    module: 'tasks',
    description: 'Checklist worksheet template, import, and export controls are reachable.',
    originalMarkers: ['<ImportExportBar moduleKey="checklist"'],
    activeMarkers: ['<ImportExportBar moduleKey="checklist"'],
  },
  {
    id: 'budget.create',
    module: 'budget',
    description: 'A planner can manually create a budget item.',
    originalMarkers: ['function BudgetTab', 'Add Budget Item', "fetch('/api/planner/budget'"],
    activeMarkers: ['async function addBudgetItem', 'Budget item added'],
  },
  {
    id: 'budget.cost-payment-edit',
    module: 'budget',
    description: 'Actual cost and paid amount can be updated.',
    originalMarkers: ['const handleEdit', 'actualCost', 'paidAmount'],
    activeMarkers: ['async function updateBudgetItem', "'actualCost' | 'paidAmount'"],
  },
  {
    id: 'budget.delete',
    module: 'budget',
    description: 'A planner can delete a budget item.',
    originalMarkers: ["fetch(`/api/planner/budget/${item.id}`, { method: 'DELETE' })", "title: 'Item removed'"],
    activeMarkers: ['async function deleteBudgetItem', "method: 'DELETE'"],
  },
  {
    id: 'budget.summary',
    module: 'budget',
    description: 'Estimated, actual, paid, and outstanding totals are visible.',
    originalMarkers: ['label="Estimated"', 'label="Actual"', 'label="Paid"', 'label="Outstanding"'],
    activeMarkers: [
      "['Estimated', budgetSummary?.totalEstimated",
      "['Actual', budgetSummary?.totalActual",
      "['Paid', budgetSummary?.totalPaid",
      "['Outstanding', budgetSummary?.totalOutstanding",
    ],
  },
  {
    id: 'budget.category-breakdown',
    module: 'budget',
    description: 'Budget totals are broken down by category.',
    originalMarkers: ['By Category', 'byCategory.map'],
    activeMarkers: ['Budget category breakdown', 'budgetByCategory'],
  },
  {
    id: 'budget.due-date',
    module: 'budget',
    description: 'Budget due dates can be entered and maintained.',
    originalMarkers: ['dueDate: newItem.dueDate || null', 'budget-due'],
    activeMarkers: ['workspace-budget-due-date', 'dueDate: budgetForm.dueDate'],
  },
  {
    id: 'budget.worksheet',
    module: 'budget',
    description: 'Budget worksheet template, import, and export controls are reachable.',
    originalMarkers: ['<ImportExportBar moduleKey="budget"'],
    activeMarkers: ['<ImportExportBar moduleKey="budget"'],
  },
  {
    id: 'vendors.create-basic',
    module: 'vendors',
    description: 'A planner can add a vendor with category and contact information.',
    originalMarkers: ['function VendorsTab', 'Add Vendor', 'newVendor.contact'],
    activeMarkers: ['async function addVendor', 'vendorForm.contact'],
  },
  {
    id: 'vendors.operational-fields',
    module: 'vendors',
    description: 'Contract, payment, rating, and notes fields remain maintainable.',
    originalMarkers: ["contractStatus: 'pending'", "paymentStatus: 'unpaid'", "rating: '4'", "notes: ''"],
    activeMarkers: ['async function updateVendor', 'Contract status', 'Payment status', 'Vendor notes', 'Vendor rating'],
  },
  {
    id: 'vendors.delete',
    module: 'vendors',
    description: 'A planner can delete a vendor record.',
    originalMarkers: ["fetch(`/api/planner/vendors/${vendor.id}`, { method: 'DELETE' })", "title: 'Vendor removed'"],
    activeMarkers: ['async function deleteVendor', "method: 'DELETE'"],
  },
  {
    id: 'vendors.worksheet',
    module: 'vendors',
    description: 'Vendor worksheet template, import, and export controls are reachable.',
    originalMarkers: ['<ImportExportBar moduleKey="vendors"'],
    activeMarkers: ['<ImportExportBar moduleKey="vendors"'],
  },
  {
    id: 'guests.create-complete',
    module: 'guests',
    description: 'Guest creation includes contact, role, side, and initial seating fields.',
    originalMarkers: ["phone: ''", "role: 'guest'", "side: 'neutral'", "seatingTableId: ''"],
    activeMarkers: ['workspace-guest-phone', 'workspace-guest-role', 'workspace-guest-side', 'workspace-guest-table'],
  },
  {
    id: 'guests.search-filter',
    module: 'guests',
    description: 'Guests can be searched and filtered by side and RSVP state.',
    originalMarkers: ['sideFilter', 'statusFilter', 'Search by name or email'],
    activeMarkers: ['guestSearch', 'guestSideFilter', 'guestStatusFilter'],
  },
  {
    id: 'guests.delete',
    module: 'guests',
    description: 'A planner can delete a guest record.',
    originalMarkers: ["fetch(`/api/planner/guests/${guest.id}`, { method: 'DELETE' })", "title: 'Guest removed'"],
    activeMarkers: ['async function deleteGuest', "method: 'DELETE'"],
  },
  {
    id: 'guests.seating-assignment',
    module: 'guests',
    description: 'A guest can be assigned or unassigned from a table.',
    originalMarkers: ['const handleAssignTable', 'body: JSON.stringify({ seatingTableId: tableId })'],
    activeMarkers: ['async function assignGuestTable', 'seatingTableId: tableId'],
  },
  {
    id: 'guests.rsvp-readiness',
    module: 'guests',
    description: 'RSVP, meal, plus-one, child, and check-in detail is operationally visible.',
    originalMarkers: ['mealChoice', 'plusOneName', 'kidsCount', 'checkedIn'],
    activeMarkers: ['Meal choice', 'Plus-one name', 'Dietary notes', 'Checked in'],
  },
  {
    id: 'guests.worksheet',
    module: 'guests',
    description: 'Guest worksheet template, import, and export controls are reachable.',
    originalMarkers: ['<ImportExportBar moduleKey="guests"'],
    activeMarkers: ['<ImportExportBar moduleKey="guests"'],
  },
  {
    id: 'timeline.create-edit',
    module: 'timeline',
    description: 'Timeline records support create and edit with duration, location, and notes.',
    originalMarkers: ['function TimelineTab', 'const startEdit', 'form.duration', 'form.location', 'form.notes'],
    activeMarkers: ['async function updateTimelineItem', 'workspace-timeline-duration', 'workspace-timeline-notes'],
  },
  {
    id: 'timeline.delete',
    module: 'timeline',
    description: 'A planner can delete a timeline record.',
    originalMarkers: ["fetch(`/api/planner/timeline/${id}`, { method: 'DELETE' })", "title: 'Block removed'"],
    activeMarkers: ['async function deleteTimelineItem', "method: 'DELETE'"],
  },
  {
    id: 'timeline.reorder',
    module: 'timeline',
    description: 'Timeline records can be reordered and the order is persisted.',
    originalMarkers: ['const move', 'Reassign sequential order values', 'body: JSON.stringify({ order:'],
    activeMarkers: ['async function moveTimelineItem', 'order: reordered'],
  },
  {
    id: 'timeline.print',
    module: 'timeline',
    description: 'The wedding-day timeline has a printable view.',
    originalMarkers: ['const handlePrint', '<Printer', 'win.print()'],
    activeMarkers: ['const printTimeline', '<Printer', 'window.print'],
  },
  {
    id: 'timeline.worksheet',
    module: 'timeline',
    description: 'Timeline worksheet template, import, and export controls are reachable.',
    originalMarkers: ['<ImportExportBar moduleKey="timeline"'],
    activeMarkers: ['<ImportExportBar moduleKey="timeline"'],
  },
  {
    id: 'seating.create',
    module: 'seating',
    description: 'A planner can create a table with a capacity.',
    originalMarkers: ['const handleAddTable', "kind: 'table'", 'newTable.capacity'],
    activeMarkers: ['async function addTable', "kind: 'table'", 'tableForm.capacity'],
  },
  {
    id: 'seating.edit-delete',
    module: 'seating',
    description: 'Tables can be renamed, resized, and deleted.',
    originalMarkers: ['const handleRenameTable', 'const handleDeleteTable', 'editTable.capacity'],
    activeMarkers: ['async function updateTable', 'async function deleteTable', 'workspace-table-capacity'],
  },
  {
    id: 'seating.manual-assignment',
    module: 'seating',
    description: 'Guests can be assigned and unassigned manually.',
    originalMarkers: ['const handleAssign', 'Unassign ${g.name}', 'Assign →'],
    activeMarkers: ['async function assignGuestToTable', 'Unassign guest', 'Assign guest'],
  },
  {
    id: 'seating.capacity',
    module: 'seating',
    description: 'Table occupancy and capacity are visible.',
    originalMarkers: ['seated.length >= table.capacity', '{seated.length}/{table.capacity} seated'],
    activeMarkers: ['tableOccupancy', 'table.capacity'],
  },
  {
    id: 'seating.worksheet',
    module: 'seating',
    description: 'Seating worksheet template, import, and export controls are reachable.',
    originalMarkers: ['<ImportExportBar moduleKey="seating"'],
    activeMarkers: ['<ImportExportBar moduleKey="seating"'],
  },
] as const satisfies readonly PlannerParityCapability[]

/**
 * Exact known Phase 4/5/6 parity debt on main when this contract was introduced.
 * Each recovery stage must reduce this list. Adding a new ID is a regression and
 * requires an explicit review against the original planner.
 */
export const KNOWN_ACTIVE_PARITY_GAPS = [
  'tasks.delete',
  'tasks.search-filter',
  'tasks.assignee',
  'tasks.taxonomy',
  'tasks.worksheet',
  'budget.delete',
  'budget.category-breakdown',
  'budget.due-date',
  'budget.worksheet',
  'vendors.operational-fields',
  'vendors.delete',
  'vendors.worksheet',
  'guests.create-complete',
  'guests.search-filter',
  'guests.delete',
  'guests.seating-assignment',
  'guests.rsvp-readiness',
  'guests.worksheet',
  'timeline.create-edit',
  'timeline.delete',
  'timeline.reorder',
  'timeline.print',
  'timeline.worksheet',
  'seating.edit-delete',
  'seating.manual-assignment',
  'seating.worksheet',
] as const

export const INTENTIONAL_UPGRADES = [
  'The planner is reached through the dedicated /planner route.',
  'The active workspace is not a nested Dialog.',
  'The active workspace does not use the legacy shared-password UI.',
  'Empty weddings are not automatically seeded with another couple’s data.',
  'All active reads and mutations are scoped to the authenticated active wedding.',
] as const

export function missingMarkers(source: string, markers: readonly string[]): string[] {
  return markers.filter((marker) => !source.includes(marker))
}

export function missingActiveCapabilities(source: string): string[] {
  return ORIGINAL_PLANNER_PARITY
    .filter((capability) => missingMarkers(source, capability.activeMarkers).length > 0)
    .map((capability) => capability.id)
}
