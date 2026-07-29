import { describe, expect, test } from 'bun:test'
import { KNOWN_ACTIVE_PARITY_GAPS, ORIGINAL_PLANNER_SOURCE } from './planner-parity-contract'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

const EXPECTED_WORKSHEET_GAPS = [
  'tasks.worksheet',
  'budget.worksheet',
  'vendors.worksheet',
  'guests.worksheet',
  'timeline.worksheet',
  'seating.worksheet',
] as const

describe('Stage 6 Timeline and Seating parity', () => {
  test('restored timeline workflows remain grounded in the original TimelineTab', async () => {
    const original = await source(ORIGINAL_PLANNER_SOURCE)

    for (const marker of [
      'function TimelineTab',
      'const startEdit',
      'form.duration',
      'form.location',
      'form.notes',
      "fetch(`/api/planner/timeline/${editingId}`",
      "fetch(`/api/planner/timeline/${id}`, { method: 'DELETE' })",
      'Reassign sequential order values',
      'body: JSON.stringify({ order:',
      'const handlePrint',
      'win.print()',
    ]) {
      expect(original).toContain(marker)
    }
  })

  test('timeline module restores full entry, editing, deletion, ordering and print controls', async () => {
    const timeline = await source(
      'src/components/wedding/planner/modules/planner-timeline-module.tsx',
    )

    for (const marker of [
      'workspace-timeline-time',
      'workspace-timeline-event',
      'workspace-timeline-duration',
      'workspace-timeline-location',
      'workspace-timeline-notes',
      'function startEdit',
      'onUpdateTimelineItem(editingItem, timelineForm)',
      'onMoveTimelineItem(item, -1)',
      'onMoveTimelineItem(item, 1)',
      'window.confirm',
      'onDeleteTimelineItem(item)',
      '<Printer',
      'onPrintTimeline',
    ]) {
      expect(timeline).toContain(marker)
    }
  })

  test('workspace persists normalized timeline fields and scoped order/delete mutations', async () => {
    const [workspace, collectionRoute, itemRoute] = await Promise.all([
      source('src/components/wedding/planner-workspace.tsx'),
      source('src/app/api/planner/timeline/route.ts'),
      source('src/app/api/planner/timeline/[id]/route.ts'),
    ])

    for (const marker of [
      'async function addTimelineItem',
      'async function updateTimelineItem',
      'duration: input.duration.trim()',
      'location: input.location.trim()',
      'notes: input.notes.trim()',
      'async function deleteTimelineItem',
      'async function moveTimelineItem',
      'order: reordered',
      'onCreateTimelineItem={addTimelineItem}',
      'onUpdateTimelineItem={updateTimelineItem}',
      'onDeleteTimelineItem={deleteTimelineItem}',
      'onMoveTimelineItem={moveTimelineItem}',
    ]) {
      expect(workspace).toContain(marker)
    }

    expect(collectionRoute).toContain("requireWeddingPermission(request, 'timeline.edit')")
    expect(collectionRoute).toContain('duration: body.duration?.trim() || null')
    expect(collectionRoute).toContain('location: body.location?.trim() || null')
    expect(collectionRoute).toContain('description: (body.notes ?? body.description ?? \'\').trim() || null')
    expect(itemRoute).toContain("where: { id, weddingId: access.context.weddingId }")
    expect(itemRoute).toContain('updates.duration = body.duration?.trim() || null')
    expect(itemRoute).toContain('updates.location = body.location?.trim() || null')
    expect(itemRoute).toContain('updates.description = (body.notes ?? body.description)?.trim() || null')
    expect(itemRoute).not.toContain('encodeLegacyTimelineIcon')
    expect(itemRoute).not.toContain('JSON.stringify({ d:')
  })

  test('print workflow is escaped, wedding-neutral, and based on selected records', async () => {
    const workspace = await source('src/components/wedding/planner-workspace.tsx')

    for (const marker of [
      'function escapeHtml',
      'const printTimeline',
      'timeline.map',
      'escapeHtml(item.time)',
      'escapeHtml(item.event)',
      'escapeHtml(item.location)',
      'escapeHtml(item.notes)',
      'Operational run sheet generated from the selected wedding.',
      'printWindow.window.print()',
    ]) {
      expect(workspace).toContain(marker)
    }

    expect(workspace).not.toContain('Charity')
    expect(workspace).not.toContain('Kudzie')
    expect(workspace).not.toContain('Imba Manor')
    expect(workspace).not.toContain('23 December 2026')
  })

  test('restored seating workflows remain grounded in the original SeatingTab', async () => {
    const original = await source(ORIGINAL_PLANNER_SOURCE)

    for (const marker of [
      'function SeatingTab',
      'const handleRenameTable',
      'const handleDeleteTable',
      'editTable.capacity',
      "kind=table`, { method: 'DELETE'",
      'const handleAssign',
      'body: JSON.stringify({ seatingTableId: tableId })',
      'Unassign ${g.name}',
      'Assign →',
      '{seated.length}/{table.capacity} seated',
    ]) {
      expect(original).toContain(marker)
    }
  })

  test('seating module restores table editing, deletion, assignment and capacity warnings', async () => {
    const seating = await source(
      'src/components/wedding/planner/modules/planner-seating-module.tsx',
    )

    for (const marker of [
      'workspace-table-name-',
      'workspace-table-capacity-',
      'onUpdateTable(table',
      'onDeleteTable(table)',
      'assigned guest record',
      'Assign guest',
      'Unassign guest',
      'onAssignGuestToTable(guest, null)',
      'onAssignGuestToTable(guest, table.id)',
      'tableOccupancy.get(table.id)',
      'occupied > table.capacity',
      'Over capacity',
    ]) {
      expect(seating).toContain(marker)
    }
  })

  test('workspace and seating APIs keep table and assignment mutations wedding scoped', async () => {
    const [workspace, route] = await Promise.all([
      source('src/components/wedding/planner-workspace.tsx'),
      source('src/app/api/planner/guests/[id]/route.ts'),
    ])

    for (const marker of [
      'async function updateTable',
      'async function deleteTable',
      'async function assignGuestToTable',
      '?kind=table`, {',
      "method: 'PATCH'",
      "method: 'DELETE'",
      'onUpdateTable={updateTable}',
      'onDeleteTable={deleteTable}',
      'onAssignGuestToTable={assignGuestToTable}',
    ]) {
      expect(workspace).toContain(marker)
    }

    expect(route).toContain("kind === 'table' ? 'seating.edit' : 'guests.edit'")
    expect(route).toContain('where: { id, weddingId: access.context.weddingId }')
    expect(route).toContain('updates.capacity = Math.min(50, Math.floor(body.capacity))')
    expect(route).toContain('data: { seatingTableId: null }')
    expect(route).toContain('db.seatingTable.delete({ where: { id: existing.id } })')
    expect(route).toContain('updates.seatingTableId = body.seatingTableId')
  })

  test('only the six worksheet capabilities remain as original parity debt', () => {
    expect([...KNOWN_ACTIVE_PARITY_GAPS]).toEqual([...EXPECTED_WORKSHEET_GAPS])
  })

  test('restoration does not reactivate the retired shell or sample client data', async () => {
    const activeSurface = (
      await Promise.all([
        source('src/components/wedding/planner-workspace.tsx'),
        source('src/components/wedding/planner/modules/planner-timeline-module.tsx'),
        source('src/components/wedding/planner/modules/planner-seating-module.tsx'),
      ])
    ).join('\n')

    expect(activeSurface).not.toContain('<Dialog')
    expect(activeSurface).not.toContain('SEED_')
    expect(activeSurface).not.toContain('admin-auth')
    expect(activeSurface).not.toContain('isAdminLoggedIn')
    expect(activeSurface).not.toContain('Charity')
    expect(activeSurface).not.toContain('Kudzie')
  })
})
