import { expect, openModule, openWorksheetActions, test } from './support/planner-browser'

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

async function workspaceRatio(page: Parameters<typeof openModule>[0]) {
  return page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.planner-portal-body')
    const active = document.querySelector<HTMLElement>('[data-planner-active-slot]')
    const rail = document.querySelector<HTMLElement>('[data-planner-compact-control-rail]')
    const context = document.querySelector<HTMLElement>('[data-planner-wedding-context]')
    if (!body || !active || !rail || !context) return null
    const bodyBox = body.getBoundingClientRect()
    const activeBox = active.getBoundingClientRect()
    const railBox = rail.getBoundingClientRect()
    const contextBox = context.getBoundingClientRect()
    const tolerance = 2
    return {
      activeToBody: activeBox.height / bodyBox.height,
      activeHeight: activeBox.height,
      railHeight: railBox.height,
      contextInsideRail:
        contextBox.left >= railBox.left - tolerance &&
        contextBox.right <= railBox.right + tolerance &&
        contextBox.top >= railBox.top - tolerance &&
        contextBox.bottom <= railBox.bottom + tolerance,
    }
  })
}

test('compact planner chrome gives at least four fifths of the usable body to active work', async ({ plannerPage: page }) => {
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
    const activeWedding = page.locator('#active-wedding')
    const toolsToggle = page.locator('[data-planner-tools-disclosure]')
    const tools = page.locator('#planner-experience-tools')

    await expect(shell).toBeVisible()
    await expect(moduleScroll).toBeVisible()
    await expect(activeWedding).toBeVisible()
    await expect(moduleSelector).toBeHidden()
    await expect(actions).toBeHidden()
    await expect(toolsToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(tools).toBeHidden()

    await expect.poll(async () => (await workspaceRatio(page))?.contextInsideRail).toBe(true)
    const compact = await workspaceRatio(page)
    expect(compact).not.toBeNull()
    expect(compact!.railHeight, 'compact planner rail stays shallow').toBeLessThan(viewport.height * 0.09)
    expect(compact!.activeToBody, 'active planner slot owns at least four fifths of usable planner height').toBeGreaterThanOrEqual(0.8)

    await toolsToggle.click()
    await expect(toolsToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(tools).toBeVisible()
    const expandedTools = await workspaceRatio(page)
    expect(expandedTools).not.toBeNull()
    expect(expandedTools!.activeHeight).toBeLessThan(compact!.activeHeight)

    await toolsToggle.click()
    await expect(toolsToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(tools).toBeHidden()
    const restoredTools = await workspaceRatio(page)
    expect(restoredTools).not.toBeNull()
    expect(restoredTools!.activeToBody).toBeGreaterThanOrEqual(0.8)

    await openWorksheetActions(page)
    await expect(actions).toBeVisible()
    const expandedWorksheetModule = await moduleScroll.boundingBox()
    expect(expandedWorksheetModule).not.toBeNull()

    const actionsToggle = page.getByTestId('worksheet-actions-toggle')
    await actionsToggle.click()
    await expect(actionsToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(actions).toBeHidden()
    const restoredModule = await moduleScroll.boundingBox()
    expect(restoredModule).not.toBeNull()
    expect(restoredModule!.height).toBeGreaterThan(expandedWorksheetModule!.height)

    const switchToggle = page.getByTestId('worksheet-tools-toggle')
    await switchToggle.click()
    await expect(switchToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(moduleSelector).toBeVisible()
    await page.getByTestId('worksheet-module-timeline').click()
    await expect(moduleSelector).toBeHidden()
    await expect(actions).toBeHidden()

    await page.reload()
    await openModule(page, 'timeline')
    await expect(activeWedding).toBeVisible()
    await expect(moduleSelector).toBeHidden()
    await expect(actions).toBeHidden()
    await expect(tools).toBeHidden()
    const reloaded = await workspaceRatio(page)
    expect(reloaded).not.toBeNull()
    expect(reloaded!.activeToBody).toBeGreaterThanOrEqual(0.8)
  }
})
