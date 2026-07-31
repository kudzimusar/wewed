import {
  acceptNextConfirmation,
  expect,
  openModule,
  test,
} from './support/planner-browser'

test('module, task filter, and full task edits survive refresh and navigation', async ({ plannerPage: page }) => {
  await openModule(page, 'checklist')
  await page.reload()
  await expect(page).toHaveURL(/[?&]module=tasks/)
  await expect(page.getByRole('heading', { name: 'Planning checklist' })).toBeVisible()

  const search = page.getByPlaceholder('Search tasks, descriptions, or assignees')
  await search.fill('Primary')
  await page.reload()
  await expect(page).toHaveURL(/[?&]module=tasks/)
  await expect(page.getByPlaceholder('Search tasks, descriptions, or assignees')).toHaveValue('Primary')
  await page.getByRole('button', { name: 'Reset' }).click()

  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('#workspace-task-title-error')).toContainText('Enter a task title')
  await page.locator('#workspace-task-title').fill('--- !!!')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('#workspace-task-title-error')).toContainText('letter or number')

  const original = 'Gap closure editable task'
  const updated = 'Gap closure edited task'
  await page.locator('#workspace-task-title').fill(original)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(original, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Edit ${original}` }).click()
  await page.locator('[id^="task-edit-title-"]').fill(updated)
  await page.getByLabel(`Edit category for ${original}`).selectOption('catering')
  await page.getByLabel(`Edit priority for ${original}`).selectOption('high')
  await page.getByLabel(`Edit due date for ${original}`).fill('2027-04-12')
  await page.getByLabel(`Edit assignee for ${original}`).fill('Lead coordinator')
  await page.getByLabel(`Edit description for ${original}`).fill('All core task fields edited in browser UAT.')
  await page.getByRole('button', { name: 'Save task' }).click()
  await expect(page.getByText(updated, { exact: true })).toBeVisible()

  await openModule(page, 'budget')
  await page.goBack()
  await expect(page).toHaveURL(/[?&]module=tasks/)
  await expect(page.getByText(updated, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText(updated, { exact: true })).toBeVisible()

  const response = await page.request.get('/api/planner/tasks')
  const payload = (await response.json()) as { data: Array<{ title: string; description: string | null; category: string; priority: string; assignee: string | null; dueDate: string | null }> }
  const task = payload.data.find((item) => item.title === updated)
  expect(task).toMatchObject({ description: 'All core task fields edited in browser UAT.', category: 'catering', priority: 'high', assignee: 'Lead coordinator' })
  expect(task?.dueDate).toContain('2027-04-12')

  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${updated}` }).click()
  await expect(page.getByText(updated, { exact: true })).toHaveCount(0)
})

test('budget search covers item, vendor, category, notes, status, and persists', async ({ plannerPage: page }) => {
  const item = 'Gap closure floral budget'
  await openModule(page, 'budget')
  await page.locator('#workspace-budget-description').fill(item)
  await page.locator('#workspace-budget-vendor').fill('Mavambo Florals')
  await page.locator('#workspace-budget-category').selectOption('decor')
  await page.locator('#workspace-budget-estimated-cost').fill('800')
  await page.locator('#workspace-budget-paid-amount').fill('200')
  await page.locator('#workspace-budget-notes').fill('Final quote includes table centrepieces')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(item, { exact: true })).toBeVisible()
  await expect(page.getByText('Vendor: Mavambo Florals', { exact: true })).toBeVisible()

  const search = page.getByPlaceholder('Search item, vendor, category, or notes')
  await search.fill('Mavambo')
  await expect(page.getByText(item, { exact: true })).toBeVisible()
  await search.fill('centrepieces')
  await expect(page.getByText(item, { exact: true })).toBeVisible()
  await search.fill('')
  await page.getByLabel('Filter budget by category').selectOption('decor')
  await page.getByLabel('Filter budget by payment status').selectOption('outstanding')
  await expect(page.getByText(item, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/[?&]module=budget/)
  await expect(page.getByLabel('Filter budget by category')).toHaveValue('decor')
  await expect(page.getByLabel('Filter budget by payment status')).toHaveValue('outstanding')
  await expect(page.getByText(item, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()

  const badge = page.locator('span[data-slot="badge"]').filter({ hasText: 'Decor' }).last()
  await expect(badge).toHaveClass(/bg-champagne/)
  await expect(badge).toHaveClass(/text-espresso/)
  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${item}` }).click()
})

test('guest core fields edit directly with duplicate-email feedback and wedding-scoped persistence', async ({ plannerPage: page }) => {
  const first = 'Gap Guest One'
  const second = 'Gap Guest Two'
  await openModule(page, 'guests')
  for (const [name, email] of [[first, 'gap.one@example.test'], [second, 'gap.two@example.test']] as const) {
    await page.locator('#workspace-guest-name').fill(name)
    await page.locator('#workspace-guest-email').fill(email)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }

  await page.getByRole('button', { name: `Edit ${first}` }).click()
  await page.getByLabel(`Edit email for ${first}`).fill('gap.two@example.test')
  await page.getByRole('button', { name: 'Save guest' }).click()
  await expect(page.locator('[id^="guest-edit-error-"]')).toContainText('already exists')

  await page.getByLabel(`Edit name for ${first}`).fill('Gap Guest One Updated')
  await page.getByLabel(`Edit email for ${first}`).fill('gap.one.updated@example.test')
  await page.getByLabel(`Edit phone for ${first}`).fill('+263700001111')
  await page.getByLabel(`Edit role for ${first}`).selectOption('vip')
  await page.getByLabel(`Edit side for ${first}`).selectOption('groom')
  await page.getByRole('button', { name: 'Save guest' }).click()
  await expect(page.getByText('Gap Guest One Updated', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/[?&]module=guests/)
  await expect(page.getByText('Gap Guest One Updated', { exact: true })).toBeVisible()

  const response = await page.request.get('/api/planner/guests')
  const payload = (await response.json()) as { data: Array<{ name: string; email: string | null; phone: string | null; role: string; side: string | null }> }
  expect(payload.data.find((guest) => guest.name === 'Gap Guest One Updated')).toMatchObject({ email: 'gap.one.updated@example.test', phone: '+263700001111', role: 'vip', side: 'groom' })

  for (const name of ['Gap Guest One Updated', second]) {
    acceptNextConfirmation(page)
    await page.getByRole('button', { name: `Delete ${name}` }).click()
    await expect(page.getByText(name, { exact: true })).toHaveCount(0)
  }
})

test('seating search and assignment, availability, and occupancy filters combine without mutation', async ({ plannerPage: page }) => {
  const guestName = 'Gap Seating Guest'
  const tableName = 'Gap Full Table'
  await openModule(page, 'guests')
  await page.locator('#workspace-guest-name').fill(guestName)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await openModule(page, 'seating')
  await page.locator('#workspace-new-table-name').fill(tableName)
  await page.locator('#workspace-new-table-capacity').fill('1')
  await page.getByRole('button', { name: 'Add table' }).click()
  const assignment = page.getByLabel(`Assign guest ${guestName}`)
  const tableValue = await assignment.locator('option').filter({ hasText: tableName }).getAttribute('value')
  await assignment.selectOption(tableValue ?? '')
  await expect(page.getByText(tableName, { exact: true })).toBeVisible()

  await page.getByPlaceholder('Search table or guest').fill(guestName)
  await page.getByLabel('Filter seating by assignment').selectOption('assigned')
  await page.getByLabel('Filter seating by capacity').selectOption('full')
  await page.getByLabel('Filter seating by occupancy').selectOption('full')
  await expect(page.getByText(tableName, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByPlaceholder('Search table or guest')).toHaveValue(guestName)
  await expect(page.getByLabel('Filter seating by assignment')).toHaveValue('assigned')
  await expect(page.getByText(tableName, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByText(guestName, { exact: true })).toBeVisible()
  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${tableName}` }).click()
  await openModule(page, 'guests')
  await expect(page.getByLabel(`Assign table for ${guestName}`)).toHaveValue('')
  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${guestName}` }).click()
})