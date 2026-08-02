import {
  E2E_WEDDINGS,
  acceptNextConfirmation,
  expect,
  openModule,
  test,
} from './support/planner-browser'

test('real browser CRUD persists for tasks, budget, and vendors', async ({ plannerPage: page }) => {
  const taskName = 'Browser CRUD task'
  await openModule(page, 'checklist')
  await expect(page.getByRole('heading', { name: 'Planning checklist' })).toBeVisible()
  await page.locator('#workspace-task-title').fill(taskName)
  await page.locator('#workspace-task-assignee').fill('Day-of coordinator')
  await page.locator('#workspace-task-priority').selectOption('high')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(taskName, { exact: true })).toBeVisible()

  const lowPriorityTask = 'Browser low-priority task'
  await page.locator('#workspace-task-title').fill(lowPriorityTask)
  await page.locator('#workspace-task-priority').selectOption('low')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(lowPriorityTask, { exact: true })).toBeVisible()

  await page.getByLabel('Filter tasks by priority').selectOption('high')
  await expect(page.getByText(taskName, { exact: true })).toBeVisible()
  await expect(page.getByText(lowPriorityTask, { exact: true })).toHaveCount(0)
  await page.getByLabel('Filter tasks by priority').selectOption('all')
  await expect(page.getByText(lowPriorityTask, { exact: true })).toBeVisible()

  await page.getByLabel(`Update status for ${taskName}`).selectOption('done')
  await expect(page.getByLabel(`Update status for ${taskName}`)).toHaveValue('done')

  await page.reload()
  await expect(page.getByRole('heading', { name: E2E_WEDDINGS.primary.title })).toBeVisible()
  await openModule(page, 'checklist')
  await expect(page.getByLabel(`Update status for ${taskName}`)).toHaveValue('done')
  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${taskName}` }).click()
  await expect(page.getByText(taskName, { exact: true })).toHaveCount(0)
  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${lowPriorityTask}` }).click()
  await expect(page.getByText(lowPriorityTask, { exact: true })).toHaveCount(0)

  const budgetName = 'Browser budget item'
  await openModule(page, 'budget')
  await page.locator('#workspace-budget-description').fill(budgetName)
  await page.locator('#workspace-budget-category').selectOption('catering')
  await page.locator('#workspace-budget-estimated-cost').fill('1200')
  await page.locator('#workspace-budget-actual-cost').fill('1150')
  await page.locator('#workspace-budget-paid-amount').fill('300')
  await page.locator('#workspace-budget-due-date').fill('2027-03-10')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(budgetName, { exact: true })).toBeVisible()

  let budgetRow = page
    .getByRole('button', { name: `Delete ${budgetName}` })
    .locator('xpath=ancestor::div[contains(@class,"grid")][1]')
  await budgetRow.locator('input[type="number"]').nth(0).fill('1100')
  await budgetRow.locator('input[type="number"]').nth(0).press('Tab')
  await expect(page.getByText('Actual cost updated', { exact: true })).toBeVisible()

  budgetRow = page
    .getByRole('button', { name: `Delete ${budgetName}` })
    .locator('xpath=ancestor::div[contains(@class,"grid")][1]')
  await budgetRow.locator('input[type="number"]').nth(1).fill('1100')
  await budgetRow.locator('input[type="number"]').nth(1).press('Tab')
  await expect(page.getByText('Payment updated', { exact: true })).toBeVisible()
  await expect(page.getByText('Paid', { exact: true }).last()).toBeVisible()
  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${budgetName}` }).click()
  await expect(page.getByText(budgetName, { exact: true })).toHaveCount(0)

  const vendorName = 'Browser Photo Studio'
  await openModule(page, 'vendors')
  await page.locator('#workspace-vendor-name').fill(vendorName)
  await page.locator('#workspace-vendor-category').selectOption('photographer')
  await page.locator('#workspace-vendor-contact').fill('Initial Contact')
  await page.locator('#workspace-vendor-phone').fill('+263700000001')
  await page.locator('#workspace-vendor-website').fill('https://example.test/studio')
  await page.locator('#workspace-vendor-contract').selectOption('pending')
  await page.locator('#workspace-vendor-payment').selectOption('unpaid')
  await page.locator('#workspace-vendor-notes').fill('Initial browser note')
  await page.getByRole('button', { name: 'Add vendor' }).click()
  await expect(page.getByText(vendorName, { exact: true })).toBeVisible()

  const vendorCard = page.getByText(vendorName, { exact: true }).locator('xpath=ancestor::section[1]')
  await vendorCard.getByText('Edit operational details').click()
  await vendorCard.locator('input[name="contact"]').fill('Updated Contact')
  await vendorCard.locator('select[name="contractStatus"]').selectOption('signed')
  await vendorCard.locator('select[name="paymentStatus"]').selectOption('deposit')
  await vendorCard.getByRole('button', { name: 'Save vendor details' }).click()
  await expect(page.getByText(/Photographer · Updated Contact/)).toBeVisible()
  await expect(
    vendorCard.locator('span[data-slot="badge"]').filter({ hasText: 'Signed' }),
  ).toBeVisible()
  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${vendorName}` }).click()
  await expect(page.getByText(vendorName, { exact: true })).toHaveCount(0)
})

test('real browser CRUD covers guests, seating, timeline, and printing', async ({ plannerPage: page }) => {
  const guestName = 'Browser Seating Guest'
  await openModule(page, 'guests')
  await page.locator('#workspace-guest-name').fill(guestName)
  await page.locator('#workspace-guest-email').fill('browser.guest@example.test')
  await page.locator('#workspace-guest-phone').fill('+263700000002')
  await page.locator('#workspace-guest-role').selectOption('family')
  await page.locator('#workspace-guest-side').selectOption('neutral')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(guestName, { exact: true })).toBeVisible()
  await expect(page.getByLabel(`Assign table for ${guestName}`)).toHaveValue('')

  const tableName = 'Browser Operations Table'
  const updatedTableName = 'Browser Operations Table Updated'
  await openModule(page, 'seating')
  await page.locator('#workspace-new-table-name').fill(tableName)
  await page.locator('#workspace-new-table-capacity').fill('6')
  await page.getByRole('button', { name: 'Add table' }).click()
  await expect(page.getByText(tableName, { exact: true })).toBeVisible()

  const assignment = page.getByLabel(`Assign guest ${guestName}`)
  const tableValue = await assignment
    .locator('option')
    .filter({ hasText: tableName })
    .getAttribute('value')
  expect(tableValue).toBeTruthy()
  await assignment.selectOption(tableValue ?? '')
  await expect(page.getByText(guestName, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: `Edit ${tableName}` }).click()
  const tableCard = page
    .getByRole('button', { name: `Save ${tableName}` })
    .locator('xpath=ancestor::section[1]')
  await tableCard.locator('input').nth(0).fill(updatedTableName)
  await tableCard.locator('input').nth(1).fill('7')
  await page.getByRole('button', { name: `Save ${tableName}` }).click()
  await expect(page.getByText(updatedTableName, { exact: true })).toBeVisible()

  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${updatedTableName}` }).click()
  await expect(page.getByText(updatedTableName, { exact: true })).toHaveCount(0)
  await expect(page.getByLabel(`Assign guest ${guestName}`)).toBeVisible()

  await openModule(page, 'guests')
  await expect(page.getByLabel(`Assign table for ${guestName}`)).toHaveValue('')
  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${guestName}` }).click()
  await expect(page.getByText(guestName, { exact: true })).toHaveCount(0)

  const timelineName = 'Browser processional'
  const updatedTimelineName = 'Browser processional updated'
  await openModule(page, 'timeline')
  await page.locator('#workspace-timeline-time').fill('14:30')
  await page.locator('#workspace-timeline-event').fill(timelineName)
  await page.locator('#workspace-timeline-duration').fill('20 min')
  await page.locator('#workspace-timeline-location').fill('Test Lawn')
  await page.locator('#workspace-timeline-notes').fill('Cue the musicians')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(timelineName, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: `Edit ${timelineName}` }).click()
  await page.locator('#workspace-timeline-event').fill(updatedTimelineName)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(updatedTimelineName, { exact: true })).toBeVisible()

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Print run sheet' }).click()
  const printPage = await popupPromise
  await expect(printPage.getByRole('heading', { name: 'Wedding Day Timeline' })).toBeVisible()
  await expect(printPage.locator('.event').filter({ hasText: updatedTimelineName })).toBeVisible()
  await expect(
    printPage.getByText(E2E_WEDDINGS.secondary.seededTimeline, { exact: true }),
  ).toHaveCount(0)
  await printPage.close()

  acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${updatedTimelineName}` }).click()
  await expect(page.getByText(updatedTimelineName, { exact: true })).toHaveCount(0)
})
