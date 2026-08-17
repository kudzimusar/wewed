import { expect, openModule, test } from './support/planner-browser'

test('Planner fixed-dark form controls stay readable under light and dark system themes', async ({ plannerPage: page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await openModule(page, 'budget')

    const description = page.locator('#workspace-budget-description')
    const estimate = page.locator('#workspace-budget-estimated-cost')
    const dueDate = page.locator('#workspace-budget-due-date')
    await description.fill(`Contrast ${colorScheme}`)
    await estimate.fill('987')
    await dueDate.fill('2027-04-20')

    for (const locator of [description, estimate, dueDate]) {
      const colours = await locator.evaluate((element) => {
        const computed = window.getComputedStyle(element)
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          colorScheme: computed.colorScheme,
          plannerText: computed.getPropertyValue('--planner-field-text').trim(),
        }
      })
      expect(colours.color).toBe('rgb(251, 246, 238)')
      expect(colours.backgroundColor).not.toBe(colours.color)
      expect(colours.plannerText.toLowerCase()).toBe('#fbf6ee')
      expect(colours.colorScheme).toContain('dark')
    }

    await expect(description).toHaveValue(`Contrast ${colorScheme}`)
    await expect(estimate).toHaveValue('987')
  }
})

test('shared worksheet tools print an A4 document and persist presentation order without changing task data', async ({ plannerPage: page }) => {
  await openModule(page, 'checklist')

  const trigger = page.getByTestId('planner-worksheet-command-trigger')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByRole('heading', { name: 'Tasks worksheet tools' })).toBeVisible()

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: /Print full worksheet/ }).click()
  const printPage = await popupPromise
  await printPage.waitForLoadState('domcontentloaded')
  await expect(printPage.locator('text=Wewed Planner Workspace')).toBeVisible()
  await expect(printPage.locator('text=Tasks')).toBeVisible()
  const pageRule = await printPage.locator('style').textContent()
  expect(pageRule).toContain('@page { size: A4 portrait;')
  expect(pageRule).toContain('thead { display: table-header-group; }')
  await printPage.close()

  await page.getByRole('button', { name: 'Arrange', exact: true }).click()
  const arranged = page.locator('[data-planner-arrange-record]')
  const count = await arranged.count()
  expect(count).toBeGreaterThan(1)

  const firstId = await arranged.nth(0).getAttribute('data-planner-arrange-record')
  const secondId = await arranged.nth(1).getAttribute('data-planner-arrange-record')
  expect(firstId).toBeTruthy()
  expect(secondId).toBeTruthy()

  const firstTitle = (await arranged.nth(0).locator('p').first().textContent()) ?? ''
  const secondTitle = (await arranged.nth(1).locator('p').first().textContent()) ?? ''
  await arranged.nth(1).getByRole('button', { name: 'Move to top' }).click()

  const saveResponse = page.waitForResponse(
    (response) => response.url().includes('/api/planner/worksheet-order?module=tasks') && response.request().method() === 'PUT',
  )
  await page.getByRole('button', { name: 'Save order', exact: true }).click()
  expect((await saveResponse).ok()).toBe(true)

  const stored = await page.request.get('/api/planner/worksheet-order?module=tasks')
  expect(stored.ok()).toBe(true)
  const payload = (await stored.json()) as { data: string[] }
  expect(payload.data[0]).toBe(secondId)
  expect(payload.data[1]).toBe(firstId)

  await page.keyboard.press('Escape')
  await openModule(page, 'checklist')
  await expect(page.getByText(firstTitle, { exact: true })).toBeVisible()
  await expect(page.getByText(secondTitle, { exact: true })).toBeVisible()
})

test('multi-select exposes safe task actions while excluding financial and timeline bulk overwrites', async ({ plannerPage: page }) => {
  await openModule(page, 'checklist')
  await page.getByTestId('planner-worksheet-command-trigger').click()
  await page.getByRole('button', { name: 'Select & act', exact: true }).click()
  await page.getByRole('button', { name: /Select all in current view/ }).click()

  const actionSelect = page.locator('[data-planner-worksheet-command-center] select').filter({ has: page.locator('option[value="move_top"]') }).first()
  await expect(actionSelect).toBeVisible()
  await expect(actionSelect.locator('option[value="status"]')).toHaveCount(1)
  await expect(actionSelect.locator('option[value="priority"]')).toHaveCount(1)
  await expect(actionSelect.locator('option[value="delete"]')).toHaveCount(1)

  await page.keyboard.press('Escape')
  await openModule(page, 'budget')
  await page.getByTestId('planner-worksheet-command-trigger').click()
  await page.getByRole('button', { name: 'Select & act', exact: true }).click()
  await page.getByRole('button', { name: /Select all in current view/ }).click()
  const budgetActions = page.locator('[data-planner-worksheet-command-center] select').filter({ has: page.locator('option[value="move_top"]') }).first()
  await expect(budgetActions.locator('option[value="category"]')).toHaveCount(1)
  await expect(budgetActions.locator('option[value="dueDate"]')).toHaveCount(1)
  await expect(budgetActions.locator('option[value="vendor"]')).toHaveCount(1)
  await expect(budgetActions.locator('option[value="paidAmount"]')).toHaveCount(0)
  await expect(budgetActions.locator('option[value="actualCost"]')).toHaveCount(0)
})
