import { expect, openModule, test } from './support/planner-browser'

interface TaskPayload {
  data: Array<{
    id: string
    title: string
    status: string
    priority: string
  }>
}

async function addTask(
  page: Parameters<typeof openModule>[0],
  title: string,
  priority: 'high' | 'medium' | 'low',
) {
  await page.locator('#workspace-task-title').fill(title)
  await page.locator('#workspace-task-priority').selectOption(priority)

  const createResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/planner/tasks')
      && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  expect((await createResponse).ok()).toBe(true)
  await expect(page.getByText(title, { exact: true })).toBeVisible()
}

test('Task Test 11 filters tasks by priority without changing task data', async ({ plannerPage: page }) => {
  const uatTask = 'UAT-TASK-001 Confirm florist arrival'
  const mediumTask = 'UAT-TASK-002 Confirm stationery proof'
  const lowTask = 'UAT-TASK-003 Archive inspiration links'

  await openModule(page, 'checklist')
  await addTask(page, uatTask, 'high')
  await addTask(page, mediumTask, 'medium')
  await addTask(page, lowTask, 'low')

  const statusControl = page.getByRole('combobox', { name: `Update status for ${uatTask}` })
  const updateResponse = page.waitForResponse((response) =>
    response.url().includes('/api/planner/tasks/')
      && ['PATCH', 'PUT'].includes(response.request().method()),
  )
  await statusControl.selectOption('in_progress')
  expect((await updateResponse).ok()).toBe(true)
  await expect(statusControl).toHaveValue('in_progress')

  const beforeResponse = await page.request.get('/api/planner/tasks')
  expect(beforeResponse.ok()).toBe(true)
  const before = (await beforeResponse.json()) as TaskPayload

  const priorityFilter = page.getByRole('combobox', { name: 'Filter tasks by priority' })
  await expect(priorityFilter).toHaveValue('all')
  await priorityFilter.selectOption('high')
  await expect(priorityFilter).toHaveValue('high')

  await expect(page.getByText(uatTask, { exact: true })).toHaveCount(1)
  await expect(page.getByText(mediumTask, { exact: true })).toHaveCount(0)
  await expect(page.getByText(lowTask, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: `Update status for ${uatTask}` })).toHaveValue('in_progress')

  const afterResponse = await page.request.get('/api/planner/tasks')
  expect(afterResponse.ok()).toBe(true)
  const after = (await afterResponse.json()) as TaskPayload
  expect(after.data).toEqual(before.data)
})
