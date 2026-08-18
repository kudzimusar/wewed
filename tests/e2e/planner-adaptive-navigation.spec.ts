import {
  expect,
  expectNoDocumentOverflow,
  openModule,
  openWorksheetActions,
  test,
} from './support/planner-browser'

const REQUIRED_VIEWPORTS = [
  { width: 320, height: 720, label: '320 phone' },
  { width: 375, height: 812, label: '375 phone' },
  { width: 390, height: 844, label: '390 phone' },
  { width: 768, height: 900, label: '768 compact tablet' },
  { width: 1024, height: 768, label: '1024 compact desktop' },
  { width: 1280, height: 800, label: '1280 desktop' },
  { width: 1440, height: 900, label: '1440 desktop' },
] as const

const INTERMEDIATE_PHONE_VIEWPORT = { width: 700, height: 900, label: '700 intermediate phone/tablet' } as const

test('adaptive Planner navigation satisfies the complete stamped geometry matrix without competing floating chrome', async ({ plannerPage: page }) => {
  test.setTimeout(120_000)

  for (const viewport of REQUIRED_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openModule(page, 'budget')
    await expectNoDocumentOverflow(page)

    await expect(page.getByTestId('workspace-quick-navigation')).toHaveCount(0)
    await expect(page.getByLabel('Planner account navigation')).toHaveCount(0)
    await expect(page.locator('[data-testid="planner-worksheet-command-trigger"].fixed')).toHaveCount(0)
    await expect(page.getByLabel('Open Notebook')).toHaveCount(0)
    await expect(page.getByLabel('Create Quick Note')).toHaveCount(0)

    const menu = page.getByTestId('planner-adaptive-menu-trigger')
    await expect(menu, `${viewport.label}: adaptive menu trigger`).toBeVisible()
    await menu.click()

    const drawer = page.locator('[data-planner-adaptive-navigation]')
    await expect(drawer, `${viewport.label}: adaptive navigation drawer`).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Workspace', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Messages', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Notebook', exact: true })).toBeVisible()
    await expect(drawer.getByTestId('planner-quick-note-menu-action')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()

    await openWorksheetActions(page)
    const commandTrigger = page.getByTestId('planner-worksheet-command-trigger')
    await expect(commandTrigger, `${viewport.label}: contextual Print / Arrange / Select`).toBeVisible()
    await expect(commandTrigger).toContainText('Print / Arrange / Select')
    await expect(page.getByTestId('worksheet-refresh-action')).toBeVisible()
    await expectNoDocumentOverflow(page)

    const actionsToggle = page.getByTestId('worksheet-actions-toggle')
    if ((await actionsToggle.getAttribute('aria-expanded')) === 'true') await actionsToggle.click()
  }
})

test('contextual worksheet actions own command centre and refresh while Quick Note opens from the adaptive menu', async ({ plannerPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openModule(page, 'budget')

  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0)
  await openWorksheetActions(page)

  const refreshResponse = page.waitForResponse(
    (response) => response.url().includes('/api/planner/tasks') && response.request().method() === 'GET',
  )
  await page.getByTestId('worksheet-refresh-action').click()
  expect((await refreshResponse).ok()).toBe(true)

  const commandTrigger = page.getByTestId('planner-worksheet-command-trigger')
  await commandTrigger.click()
  await expect(page.locator('[data-planner-worksheet-command-center]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Budget worksheet tools' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-planner-worksheet-command-center]')).toBeHidden()

  await page.getByTestId('planner-adaptive-menu-trigger').click()
  const drawer = page.locator('[data-planner-adaptive-navigation]')
  await drawer.getByTestId('planner-quick-note-menu-action').click()
  await expect(page.getByRole('dialog', { name: 'Quick Note' })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Quick Note' })).toBeHidden()
  await expectNoDocumentOverflow(page)
})

test('Overview keeps print access through Actions without a floating launcher', async ({ plannerPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openModule(page, 'overview')
  await expect(page.locator('[data-testid="planner-worksheet-command-trigger"].fixed')).toHaveCount(0)

  await openWorksheetActions(page)
  const commandTrigger = page.getByTestId('planner-worksheet-command-trigger')
  await expect(commandTrigger).toBeVisible()
  await expect(commandTrigger).toContainText('Print / Save PDF')
  await expect(commandTrigger).toContainText('A4 overview working document')
  await commandTrigger.click()

  const commandCenter = page.locator('[data-planner-worksheet-command-center]')
  await expect(commandCenter).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Overview worksheet tools' })).toBeVisible()
  await expect(commandCenter.getByRole('button', { name: 'Print / Save PDF' })).toBeVisible()
  await expect(commandCenter.getByRole('button', { name: 'Arrange' })).toHaveCount(0)
  await expect(commandCenter.getByRole('button', { name: 'Select & act' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(commandCenter).toBeHidden()
  await expectNoDocumentOverflow(page)
})

test('Planner portfolio uses the same adaptive navigation shell without worksheet tools or floating Notebook utilities', async ({ plannerPage: page }) => {
  for (const viewport of REQUIRED_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/planner/portfolio')

    await expect(page.locator('[data-planner-portfolio-shell]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'All weddings', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your wedding command centre' })).toBeVisible()
    await expect(page.getByTestId('workspace-quick-navigation')).toHaveCount(0)
    await expect(page.getByTestId('planner-worksheet-command-trigger')).toHaveCount(0)
    await expect(page.locator('[data-planner-worksheet-command-center]')).toHaveCount(0)
    await expect(page.getByLabel('Open Notebook')).toHaveCount(0)
    await expect(page.getByLabel('Create Quick Note')).toHaveCount(0)

    const menu = page.getByTestId('planner-adaptive-menu-trigger')
    await expect(menu, `${viewport.label}: portfolio adaptive menu trigger`).toBeVisible()
    await menu.click()
    const drawer = page.locator('[data-planner-adaptive-navigation]')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Workspace', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Messages', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Notebook', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expectNoDocumentOverflow(page)
  }
})

test('phone and intermediate widths use the worksheet selector through the complete sub-768 range', async ({ plannerPage: page }) => {
  for (const viewport of [REQUIRED_VIEWPORTS[0], REQUIRED_VIEWPORTS[1], REQUIRED_VIEWPORTS[2], INTERMEDIATE_PHONE_VIEWPORT]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openModule(page, 'budget')

    const mobileSelector = page.getByRole('combobox', { name: 'Planner workspace section' })
    await expect(mobileSelector, `${viewport.label}: worksheet selector`).toBeVisible()
    await expect(mobileSelector).toHaveValue('budget')
    await expect(page.getByRole('navigation', { name: 'Planner workspace sections' })).toBeHidden()
    await expectNoDocumentOverflow(page)
  }

  await page.setViewportSize({ width: 768, height: 900 })
  await openModule(page, 'budget')
  await expect(page.getByRole('combobox', { name: 'Planner workspace section' })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Planner workspace sections' })).toBeVisible()
  await expectNoDocumentOverflow(page)
})

test('secondary Planner routes use the adaptive menu instead of the legacy floating account pill', async ({ plannerPage: page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })

  for (const route of ['/planner/ai-workspace', '/planner/marketplace', '/planner/wedding-brief', '/planner/notebook']) {
    await page.goto(route)
    await expect(page.getByTestId('workspace-quick-navigation')).toHaveCount(0)
    await expect(page.getByTestId('planner-secondary-adaptive-navigation')).toBeVisible()
    await expect(page.getByTestId('planner-adaptive-menu-trigger')).toBeVisible()
    await expectNoDocumentOverflow(page)
  }
})
