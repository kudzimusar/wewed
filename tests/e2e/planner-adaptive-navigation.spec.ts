import {
  expect,
  expectNoDocumentOverflow,
  openModule,
  openWorksheetActions,
  test,
} from './support/planner-browser'

const VIEWPORTS = [
  { width: 390, height: 844, label: 'phone' },
  { width: 768, height: 900, label: 'compact tablet' },
  { width: 1024, height: 768, label: 'compact desktop' },
  { width: 1280, height: 800, label: 'desktop' },
] as const

test('adaptive Planner navigation keeps primary controls reachable without competing floating chrome', async ({ plannerPage: page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openModule(page, 'budget')
    await expectNoDocumentOverflow(page)

    await expect(page.getByTestId('workspace-quick-navigation')).toHaveCount(0)
    await expect(page.getByLabel('Planner account navigation')).toHaveCount(0)
    await expect(page.locator('[data-testid="planner-worksheet-command-trigger"].fixed')).toHaveCount(0)

    const menu = page.getByTestId('planner-adaptive-menu-trigger')
    await expect(menu, `${viewport.label}: adaptive menu trigger`).toBeVisible()
    await menu.click()

    const drawer = page.locator('[data-planner-adaptive-navigation]')
    await expect(drawer, `${viewport.label}: adaptive navigation drawer`).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Workspace', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Messages', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()

    await openWorksheetActions(page)
    const commandTrigger = page.getByTestId('planner-worksheet-command-trigger')
    await expect(commandTrigger, `${viewport.label}: contextual Print / Arrange / Select`).toBeVisible()
    await expect(commandTrigger).toContainText('Print / Arrange / Select')
    await commandTrigger.click()
    await expect(page.locator('[data-planner-worksheet-command-center]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Budget worksheet tools' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-planner-worksheet-command-center]')).toBeHidden()
    await expectNoDocumentOverflow(page)

    const actionsToggle = page.getByTestId('worksheet-actions-toggle')
    if ((await actionsToggle.getAttribute('aria-expanded')) === 'true') await actionsToggle.click()
  }
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

test('Planner portfolio uses the same adaptive navigation shell without worksheet tools or duplicate quick chrome', async ({ plannerPage: page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/planner/portfolio')

    await expect(page.locator('[data-planner-portfolio-shell]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'All weddings', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your wedding command centre' })).toBeVisible()
    await expect(page.getByTestId('workspace-quick-navigation')).toHaveCount(0)
    await expect(page.getByTestId('planner-worksheet-command-trigger')).toHaveCount(0)
    await expect(page.locator('[data-planner-worksheet-command-center]')).toHaveCount(0)

    const menu = page.getByTestId('planner-adaptive-menu-trigger')
    await expect(menu, `${viewport.label}: portfolio adaptive menu trigger`).toBeVisible()
    await menu.click()
    const drawer = page.locator('[data-planner-adaptive-navigation]')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Workspace', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Messages', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expectNoDocumentOverflow(page)
  }
})

test('phone Planner uses a worksheet selector rather than requiring the wide worksheet tab row', async ({ plannerPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openModule(page, 'budget')

  const mobileSelector = page.getByRole('combobox', { name: 'Planner workspace section' })
  await expect(mobileSelector).toBeVisible()
  await expect(mobileSelector).toHaveValue('budget')
  await expect(page.getByRole('navigation', { name: 'Planner workspace sections' })).toBeHidden()
  await expectNoDocumentOverflow(page)
})
