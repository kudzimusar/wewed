import { expect, openModule, openWorksheetActions, test } from './support/planner-browser'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

test('worksheet recovery stays compact and yields the viewport to active work', async ({ plannerPage: page }) => {
  test.setTimeout(90_000)

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.evaluate(() => {
      sessionStorage.setItem('wewed:planner:worksheet-module-picker-open', 'false')
      sessionStorage.setItem('wewed:planner:worksheet-actions-open', 'false')
    })
    await page.goto('/planner/timeline#planner-workspace')
    await openModule(page, 'timeline')

    const shell = page.locator('[data-worksheet-recovery-shell]')
    const moduleScroll = page.locator('[data-planner-module-scroll="true"]')
    const moduleSelector = page.getByLabel('Worksheet module selector')
    const actions = page.locator('#planner-worksheet-actions')

    await expect(shell).toBeVisible()
    await expect(moduleScroll).toBeVisible()
    await expect(moduleSelector).toBeHidden()
    await expect(actions).toBeHidden()

    const compactShell = await shell.boundingBox()
    const compactModule = await moduleScroll.boundingBox()
    expect(compactShell).not.toBeNull()
    expect(compactModule).not.toBeNull()
    expect(compactShell!.height).toBeLessThan(viewport.height * 0.24)
    expect(compactModule!.height).toBeGreaterThan(viewport.height * 0.28)

    await openWorksheetActions(page)
    await expect(actions).toBeVisible()
    const expandedModule = await moduleScroll.boundingBox()
    expect(expandedModule).not.toBeNull()
    expect(expandedModule!.height).toBeLessThan(compactModule!.height)

    const actionsToggle = page.getByTestId('worksheet-actions-toggle')
    await actionsToggle.click()
    await expect(actionsToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(actions).toBeHidden()
    const restoredModule = await moduleScroll.boundingBox()
    expect(restoredModule).not.toBeNull()
    expect(restoredModule!.height).toBeGreaterThan(expandedModule!.height)

    const switchToggle = page.getByTestId('worksheet-tools-toggle')
    await switchToggle.click()
    await expect(switchToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(moduleSelector).toBeVisible()
    await page.getByTestId('worksheet-module-timeline').click()
    await expect(moduleSelector).toBeHidden()
    await expect(actions).toBeHidden()

    await page.reload()
    await openModule(page, 'timeline')
    await expect(moduleSelector).toBeHidden()
    await expect(actions).toBeHidden()
  }
})
