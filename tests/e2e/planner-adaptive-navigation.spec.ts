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
    const commandTrigger = page.locator('[data-testid="planner-worksheet-command-trigger"]:not(.fixed)')
    await expect(commandTrigger, `${viewport.label}: contextual Print / Arrange / Select`).toBeVisible()
    await expect(commandTrigger).toContainText('Print / Arrange / Select')
    await expect(page.locator('[data-testid="planner-worksheet-command-trigger"].fixed')).toBeHidden()
    await expectNoDocumentOverflow(page)

    const actionsToggle = page.getByTestId('worksheet-actions-toggle')
    if ((await actionsToggle.getAttribute('aria-expanded')) === 'true') await actionsToggle.click()
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
