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
  /** Markers proving the capability existed in the original baseline. */
  originalMarkers: readonly string[]
  /** Markers required on the reachable PlannerPortal/workspace surface. */
  activeMarkers: readonly string[]
}

export const ORIGINAL_PLANNER_SOURCE = 'src/components/wedding/wedding-planner.tsx'
export const ACTIVE_PLANNER_SOURCE_PATHS = [
  'src/components/wedding/planner-portal.tsx',
  'src/components/wedding/planner-workspace-stage7.tsx',
  'src/components/wedding/planner-workspace.tsx',
] as const

function capability(
  id: string,
  module: PlannerParityModule,
  description: string,
  originalMarkers: readonly string[],
  activeMarkers: readonly string[],
): PlannerParityCapability {
  return { id, module, description, originalMarkers, activeMarkers }
}

/**
 * Functional contract extracted from the original WeddingPlanner.
 *
 * An API route, parser, or unmounted component does not satisfy active parity.
 * The equivalent workflow must be reachable through PlannerPortal or its mounted
 * workspace. Stage 7 completes the original six-module worksheet surface while
 * retaining the independent, permission-aware planner shell.
 */
export const ORIGINAL_PLANNER_PARITY: readonly PlannerParityCapability[] = [
  capability(
    'shell.six-core-modules',
    'shell',
    'Checklist, Budget, Vendors, Guests, Timeline, and Seating are reachable.',
    [
      '<TabsContent value="checklist"',
      '<TabsContent value="budget"',
      '<TabsContent value="vendors"',
      '<TabsContent value="guests"',
      '<TabsContent value="timeline"',
      '<TabsContent value="seating"',
    ],
    [
      "activeTab === 'tasks'",
      "activeTab === 'budget'",
      "activeTab === 'vendors'",
      "activeTab === 'guests'",
      "activeTab === 'timeline'",
      "activeTab === 'seating'",
    ],
  ),

  capability(
    'tasks.create',
    'tasks',
    'Tasks can be entered manually.',
    ['function ChecklistTab', 'Add Task', "fetch('/api/planner/tasks'"],
    ['async function addTask', 'workspace-task-title'],
  ),
  capability(
    'tasks.status',
    'tasks',
    'Task completion/status can be changed.',
    ['const toggleTask', 'body: JSON.stringify({ status: nextStatus })'],
    ['async function updateTaskStatus', 'body: JSON.stringify({ status })'],
  ),
  capability(
    'tasks.delete',
    'tasks',
    'Incorrect or obsolete tasks can be removed.',
    ['const deleteTask', "fetch(`/api/planner/tasks/${task.id}`, { method: 'DELETE' })"],
    ['async function deleteTask', "method: 'DELETE'"],
  ),
  capability(
    'tasks.search-filter',
    'tasks',
    'Tasks can be searched and filtered by category and status.',
    ['activeCategory', 'statusFilter', 'setSearch'],
    ['taskSearch', 'taskCategoryFilter', 'taskStatusFilter'],
  ),
  capability(
    'tasks.assignee',
    'tasks',
    'Free-text assignees can be entered and displayed.',
    ["assignee: ''", 'newTask.assignee'],
    ['workspace-task-assignee', 'assignee: taskForm.assignee'],
  ),
  capability(
    'tasks.taxonomy',
    'tasks',
    'Time-based and Zimbabwean planning terminology is preserved.',
    [
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
    [
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
  ),
  capability(
    'tasks.progress',
    'tasks',
    'Progress, blocked work, and overdue work are reported.',
    ['Checklist Progress', 'stats.percent', 'stats.blocked'],
    ['Task progress', 'taskStats.percent', 'taskStats.blocked', 'taskStats.overdue'],
  ),
  capability(
    'tasks.worksheet',
    'tasks',
    'Checklist worksheet template/import/export actions are reachable.',
    ['<ImportExportBar moduleKey="checklist"'],
    ['<ImportExportBar moduleKey="checklist"'],
  ),

  capability(
    'budget.create',
    'budget',
    'Budget items can be entered manually.',
    ['function BudgetTab', 'Add Budget Item', "fetch('/api/planner/budget'"],
    ['async function addBudgetItem', 'Budget item added'],
  ),
  capability(
    'budget.cost-payment-edit',
    'budget',
    'Actual cost and paid amount can be maintained.',
    ['const handleEdit', 'actualCost', 'paidAmount'],
    ['async function updateBudgetItem', "'actualCost' | 'paidAmount'"],
  ),
  capability(
    'budget.delete',
    'budget',
    'Budget items can be deleted.',
    ["fetch(`/api/planner/budget/${item.id}`, { method: 'DELETE' })", "title: 'Item removed'"],
    ['async function deleteBudgetItem', "method: 'DELETE'"],
  ),
  capability(
    'budget.summary',
    'budget',
    'Estimated, actual, paid, and outstanding totals are visible.',
    ['label="Estimated"', 'label="Actual"', 'label="Paid"', 'label="Outstanding"'],
    [
      "['Estimated', budgetSummary?.totalEstimated",
      "['Actual', budgetSummary?.totalActual",
      "['Paid', budgetSummary?.totalPaid",
      "['Outstanding', budgetSummary?.totalOutstanding",
    ],
  ),
  capability(
    'budget.category-breakdown',
    'budget',
    'Budget totals are reported by category.',
    ['By Category', 'byCategory.map'],
    ['Budget category breakdown', 'budgetByCategory'],
  ),
  capability(
    'budget.due-date',
    'budget',
    'Budget due dates can be entered and maintained.',
    ['dueDate: newItem.dueDate || null', 'newItem.dueDate'],
    ['workspace-budget-due-date', 'dueDate: budgetForm.dueDate'],
  ),
  capability(
    'budget.worksheet',
    'budget',
    'Budget worksheet template/import/export actions are reachable.',
    ['<ImportExportBar moduleKey="budget"'],
    ['<ImportExportBar moduleKey="budget"'],
  ),

  capability(
    'vendors.create-basic',
    'vendors',
    'Vendors can be added with category and contact information.',
    ['function VendorsTab', 'Add Vendor', 'newVendor.contact'],
    ['async function addVendor', 'vendorForm.contact'],
  ),
  capability(
    'vendors.operational-fields',
    'vendors',
    'Contract, payment, rating, and notes fields are maintainable.',
    ["contractStatus: 'pending'", "paymentStatus: 'unpaid'", "rating: '4'", "notes: ''"],
    ['async function updateVendor', 'Contract status', 'Payment status', 'Vendor notes', 'Vendor rating'],
  ),
  capability(
    'vendors.delete',
    'vendors',
    'Vendor records can be removed.',
    ["fetch(`/api/planner/vendors/${vendor.id}`, { method: 'DELETE' })", "title: 'Vendor removed'"],
    ['async function deleteVendor', "method: 'DELETE'"],
  ),
  capability(
    'vendors.worksheet',
    'vendors',
    'Vendor worksheet template/import/export actions are reachable.',
    ['<ImportExportBar moduleKey="vendors"'],
    ['<ImportExportBar moduleKey="vendors"'],
  ),

  capability(
    'guests.create-complete',
    'guests',
    'Guest creation includes contact, role, side, and initial table.',
    ["phone: ''", "role: 'guest'", "side: 'neutral'", "seatingTableId: ''"],
    ['workspace-guest-phone', 'workspace-guest-role', 'workspace-guest-side', 'workspace-guest-table'],
  ),
  capability(
    'guests.search-filter',
    'guests',
    'Guests can be searched and filtered by side and RSVP status.',
    ['sideFilter', 'statusFilter', 'Search by name or email'],
    ['guestSearch', 'guestSideFilter', 'guestStatusFilter'],
  ),
  capability(
    'guests.delete',
    'guests',
    'Guest records can be deleted.',
    ["fetch(`/api/planner/guests/${guest.id}`, { method: 'DELETE' })", "title: 'Guest removed'"],
    ['async function deleteGuest', "method: 'DELETE'"],
  ),
  capability(
    'guests.seating-assignment',
    'guests',
    'Guests can be assigned and unassigned from tables.',
    ['const handleAssignTable', 'body: JSON.stringify({ seatingTableId: tableId })'],
    ['async function assignGuestTable', 'seatingTableId: tableId'],
  ),
  capability(
    'guests.rsvp-readiness',
    'guests',
    'RSVP, meal, plus-one, child, and check-in detail is visible.',
    ['mealChoice', 'plusOneName', 'kidsCount', 'checkedIn'],
    ['Meal choice', 'Plus-one name', 'Dietary notes', 'Checked in'],
  ),
  capability(
    'guests.worksheet',
    'guests',
    'Guest worksheet template/import/export actions are reachable.',
    ['<ImportExportBar moduleKey="guests"'],
    ['<ImportExportBar moduleKey="guests"'],
  ),

  capability(
    'timeline.create-edit',
    'timeline',
    'Timeline records support create/edit with duration, location, and notes.',
    ['function TimelineTab', 'const startEdit', 'form.duration', 'form.location', 'form.notes'],
    ['async function updateTimelineItem', 'workspace-timeline-duration', 'workspace-timeline-notes'],
  ),
  capability(
    'timeline.delete',
    'timeline',
    'Timeline records can be deleted.',
    ["fetch(`/api/planner/timeline/${id}`, { method: 'DELETE' })", "title: 'Block removed'"],
    ['async function deleteTimelineItem', "method: 'DELETE'"],
  ),
  capability(
    'timeline.reorder',
    'timeline',
    'Timeline ordering can be changed and persisted.',
    ['const move', 'Reassign sequential order values', 'body: JSON.stringify({ order:'],
    ['async function moveTimelineItem', 'order: reordered'],
  ),
  capability(
    'timeline.print',
    'timeline',
    'The wedding-day timeline has a printable view.',
    ['const handlePrint', '<Printer', 'win.print()'],
    ['const printTimeline', '<Printer', 'window.print'],
  ),
  capability(
    'timeline.worksheet',
    'timeline',
    'Timeline worksheet template/import/export actions are reachable.',
    ['<ImportExportBar moduleKey="timeline"'],
    ['<ImportExportBar moduleKey="timeline"'],
  ),

  capability(
    'seating.create',
    'seating',
    'Tables can be created with a capacity.',
    ['const handleAddTable', "kind: 'table'", 'newTable.capacity'],
    ['async function addTable', "kind: 'table'", 'tableForm.capacity'],
  ),
  capability(
    'seating.edit-delete',
    'seating',
    'Tables can be renamed, resized, and deleted.',
    ['const handleRenameTable', 'const handleDeleteTable', 'editTable.capacity'],
    ['async function updateTable', 'async function deleteTable', 'workspace-table-capacity'],
  ),
  capability(
    'seating.manual-assignment',
    'seating',
    'Guests can be assigned and unassigned manually.',
    ['const handleAssign', 'Unassign ${g.name}', 'Assign →'],
    ['async function assignGuestToTable', 'Unassign guest', 'Assign guest'],
  ),
  capability(
    'seating.capacity',
    'seating',
    'Table occupancy and capacity are visible.',
    ['seated.length >= table.capacity', '{seated.length}/{table.capacity} seated'],
    ['tableOccupancy', 'table.capacity'],
  ),
  capability(
    'seating.worksheet',
    'seating',
    'Seating worksheet template/import/export actions are reachable.',
    ['<ImportExportBar moduleKey="seating"'],
    ['<ImportExportBar moduleKey="seating"'],
  ),
]

/** Stage 7 restores every original planner capability on the active surface. */
export const KNOWN_ACTIVE_PARITY_GAPS = [] as const

export const INTENTIONAL_UPGRADES = [
  'Dedicated /planner route.',
  'Independent non-modal application shell.',
  'Membership-based active-wedding authorization.',
  'No automatic client data seeding.',
  'Phase 1-6 upgrades retained during restoration.',
  'Versioned worksheet history and persisted rollback controls.',
] as const

export function missingMarkers(source: string, markers: readonly string[]): string[] {
  return markers.filter((marker) => !source.includes(marker))
}

export function missingActiveCapabilities(source: string): string[] {
  return ORIGINAL_PLANNER_PARITY
    .filter((item) => missingMarkers(source, item.activeMarkers).length > 0)
    .map((item) => item.id)
}
