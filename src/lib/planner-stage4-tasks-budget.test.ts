import { describe, expect, test } from 'bun:test'
import { KNOWN_ACTIVE_PARITY_GAPS, ORIGINAL_PLANNER_SOURCE } from './planner-parity-contract'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

const RESTORED_STAGE4_CAPABILITIES = [
  'tasks.delete',
  'tasks.search-filter',
  'tasks.assignee',
  'tasks.taxonomy',
  'budget.delete',
  'budget.category-breakdown',
  'budget.due-date',
] as const

describe('Stage 4 Tasks and Budget parity', () => {
  test('restored task workflows remain grounded in the original ChecklistTab', async () => {
    const original = await source(ORIGINAL_PLANNER_SOURCE)

    for (const marker of [
      'function ChecklistTab',
      'activeCategory',
      'statusFilter',
      'setSearch',
      'const deleteTask',
      "assignee: ''",
      'newTask.assignee',
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
    ]) {
      expect(original).toContain(marker)
    }
  })

  test('task module restores filtering, taxonomy, assignee and confirmed deletion', async () => {
    const tasks = await source(
      'src/components/wedding/planner/modules/planner-tasks-module.tsx',
    )

    for (const marker of [
      "usePlannerFilterState('wewed:planner:tasks:filters'",
      'filters.search',
      'filters.category',
      'filters.status',
      "task.description ?? ''",
      "task.assignee ?? ''",
      'workspace-task-assignee',
      'timeline_12_18',
      'timeline_9_12',
      'timeline_6_9',
      'timeline_3_6',
      'timeline_2mo',
      'timeline_1mo',
      'timeline_2wk',
      'timeline_1wk',
      'wedding_day',
      'spiritual',
      'roora',
      'magumo',
      'window.confirm',
      'onDeleteTask(task)',
    ]) {
      expect(tasks).toContain(marker)
    }
  })

  test('workspace preserves free-text task ownership and wedding-scoped deletion', async () => {
    const workspace = await source('src/components/wedding/planner-workspace.tsx')
    const taskRoute = await source('src/app/api/planner/tasks/[id]/route.ts')

    expect(workspace).toContain('assignee: taskForm.assignee.trim() || null')
    expect(workspace).toContain('async function deleteTask')
    expect(workspace).toContain("api(`/api/planner/tasks/${task.id}`")
    expect(workspace).toContain("method: 'DELETE'")
    expect(workspace).toContain('onDeleteTask={deleteTask}')
    expect(taskRoute).toContain("where: { id, weddingId: access.context.weddingId }")
    expect(taskRoute).toContain("requireWeddingPermission(request, 'planner.edit')")
  })

  test('restored budget workflows remain grounded in the original BudgetTab', async () => {
    const original = await source(ORIGINAL_PLANNER_SOURCE)

    for (const marker of [
      'function BudgetTab',
      'byCategory.map',
      'dueDate: newItem.dueDate || null',
      'newItem.dueDate',
      'const handleDelete',
      "fetch(`/api/planner/budget/${item.id}`, { method: 'DELETE' })",
      'actualCost: newItem.actualCost',
      'paidAmount: Number(newItem.paidAmount)',
    ]) {
      expect(original).toContain(marker)
    }
  })

  test('budget module restores category reporting, complete entry and confirmed deletion', async () => {
    const budget = await source(
      'src/components/wedding/planner/modules/planner-budget-module.tsx',
    )

    for (const marker of [
      'Budget category breakdown',
      'budgetByCategory.map',
      'workspace-budget-due-date',
      'budgetForm.actualCost',
      'budgetForm.paidAmount',
      'budgetForm.dueDate',
      "{ value: 'roora', label: 'Roora' }",
      'window.confirm',
      'onDeleteBudgetItem(item)',
    ]) {
      expect(budget).toContain(marker)
    }
  })

  test('workspace consumes server category totals and preserves budget mutation scope', async () => {
    const workspace = await source('src/components/wedding/planner-workspace.tsx')
    const collectionRoute = await source('src/app/api/planner/budget/route.ts')
    const itemRoute = await source('src/app/api/planner/budget/[id]/route.ts')

    expect(workspace).toContain('byCategory: CategoryBreakdown[]')
    expect(workspace).toContain('setBudgetByCategory(budgetPayload.byCategory ?? [])')
    expect(workspace).toContain('actualCost: budgetForm.actualCost')
    expect(workspace).toContain('paidAmount: Number(budgetForm.paidAmount')
    expect(workspace).toContain('dueDate: budgetForm.dueDate || null')
    expect(workspace).toContain('async function deleteBudgetItem')
    expect(workspace).toContain('onDeleteBudgetItem={deleteBudgetItem}')
    expect(collectionRoute).toContain('byCategory: Array.from(categories.entries())')
    expect(itemRoute).toContain("where: { id, weddingId: access.context.weddingId }")
    expect(itemRoute).toContain("requireWeddingPermission(request, 'budget.edit')")
  })

  test('Stage 4 capabilities remain restored after worksheet completion', () => {
    for (const capability of RESTORED_STAGE4_CAPABILITIES) {
      expect(KNOWN_ACTIVE_PARITY_GAPS).not.toContain(capability)
    }
    expect(KNOWN_ACTIVE_PARITY_GAPS).not.toContain('tasks.worksheet')
    expect(KNOWN_ACTIVE_PARITY_GAPS).not.toContain('budget.worksheet')
  })

  test('restoration does not reactivate the retired shell or sample client data', async () => {
    const activeSurface = (
      await Promise.all([
        source('src/components/wedding/planner-workspace.tsx'),
        source('src/components/wedding/planner/modules/planner-tasks-module.tsx'),
        source('src/components/wedding/planner/modules/planner-budget-module.tsx'),
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
