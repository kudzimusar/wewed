import { describe, expect, test } from 'bun:test'
import {
  ACTIVE_PLANNER_SOURCE_PATHS,
  KNOWN_ACTIVE_PARITY_GAPS,
  ORIGINAL_PLANNER_SOURCE,
  missingActiveCapabilities,
} from './planner-parity-contract'

const TASKS_MODULE = 'src/components/wedding/planner/modules/planner-tasks-module.tsx'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Stage 3 Tasks module extraction', () => {
  test('workspace mounts the extracted module in the existing Tasks tab', async () => {
    const workspace = await source('src/components/wedding/planner-workspace.tsx')

    expect(workspace).toContain("import { PlannerTasksModule }")
    expect(workspace).toContain("activeTab === 'tasks'")
    expect(workspace).toContain('<PlannerTasksModule')
    expect(workspace).toContain('tasks={tasks}')
    expect(workspace).toContain('taskForm={taskForm}')
    expect(workspace).toContain('onAddTask={addTask}')
    expect(workspace).toContain('onUpdateTaskStatus={updateTaskStatus}')
  })

  test('extracted module preserves the active Tasks behavior exactly', async () => {
    const module = await source(TASKS_MODULE)

    for (const marker of [
      'workspace-task-title',
      'Confirm supplier arrival times',
      'taskForm.category',
      'taskForm.priority',
      'taskForm.dueDate',
      'taskProgressPercent',
      'No tasks yet',
      'No couple-specific sample data is inserted automatically.',
      'onUpdateTaskStatus(task, event.target.value)',
      'To do',
      'In progress',
      'Blocked',
      'Done',
    ]) {
      expect(module).toContain(marker)
    }
  })

  test('extraction does not reintroduce the retired shell or client seeding', async () => {
    const module = await source(TASKS_MODULE)

    expect(module).not.toContain('<Dialog')
    expect(module).not.toContain('SEED_')
    expect(module).not.toContain('Charity')
    expect(module).not.toContain('Kudzie')
    expect(module).not.toContain('admin-auth')
    expect(module).not.toContain('isAdminLoggedIn')
  })

  test('known original parity debt is unchanged by extraction', async () => {
    const activeSurface = (
      await Promise.all([...ACTIVE_PLANNER_SOURCE_PATHS, TASKS_MODULE].map(source))
    ).join('\n')

    expect(missingActiveCapabilities(activeSurface)).toEqual([...KNOWN_ACTIVE_PARITY_GAPS])
  })

  test('the original mature Tasks implementation remains the restoration source', async () => {
    const original = await source(ORIGINAL_PLANNER_SOURCE)

    expect(original).toContain('function ChecklistTab')
    expect(original).toContain('activeCategory')
    expect(original).toContain('statusFilter')
    expect(original).toContain('setSearch')
    expect(original).toContain('const deleteTask')
    expect(original).toContain('<ImportExportBar moduleKey="checklist"')
  })
})
