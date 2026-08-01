import {
  E2E_WEDDINGS,
  expect,
  expectNoDocumentOverflow,
  openModule,
  test,
} from './support/planner-browser'

async function waitForDialogKeyboardReady(page: Parameters<typeof openModule>[0]) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-state', 'open')
  await expect.poll(
    async () => dialog.evaluate((element) => element.contains(document.activeElement)),
    { message: 'open dialog owns keyboard focus' },
  ).toBe(true)
  return dialog
}

test('keyboard navigation, dialogs, and desktop visual containment remain usable', async ({ plannerPage: page }) => {
  await expectNoDocumentOverflow(page)
  await page.getByTestId('worksheet-module-checklist').focus()
  await expect(page.getByTestId('worksheet-module-checklist')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Planning checklist' })).toBeVisible()

  const importButton = page.getByRole('button', { name: 'Import', exact: true })
  await importButton.focus()
  await expect(importButton).toBeFocused()
  await page.keyboard.press('Enter')
  const dialog = await waitForDialogKeyboardReady(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  const unlabeledControls = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button, input, select, textarea'))
      .filter((element) => {
        const style = window.getComputedStyle(element)
        const visible = style.display !== 'none' && style.visibility !== 'hidden'
        if (!visible || element.getAttribute('aria-hidden') === 'true') return false
        const id = element.id
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null
        const name =
          element.getAttribute('aria-label') ||
          element.getAttribute('aria-labelledby') ||
          element.getAttribute('title') ||
          element.getAttribute('placeholder') ||
          label?.textContent?.trim() ||
          element.textContent?.trim()
        return !name
      })
      .map((element) => element.outerHTML.slice(0, 180)),
  )
  expect(unlabeledControls).toEqual([])
})

test('notification controls retain an accessible close name', async ({ plannerPage: page }) => {
  await openModule(page, 'checklist')
  await page.locator('#workspace-task-title').fill('Accessibility toast task')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Task added', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close notification' })).toBeVisible()
})

test('mobile planner remains contained and operable @mobile', async ({ plannerPage: page }) => {
  await expectNoDocumentOverflow(page)
  await expect(page.getByRole('heading', { name: E2E_WEDDINGS.primary.title })).toBeVisible()
  await expect(page.locator('#active-wedding')).toBeVisible()
  await openModule(page, 'budget')
  await expect(page.locator('#workspace-budget-description')).toBeVisible()

  const workspaceSelector = page.locator('#planner-workspace-section')
  await expect(workspaceSelector).toBeVisible()
  await expect(workspaceSelector).toHaveValue('budget')
  const selectorBox = await workspaceSelector.boundingBox()
  const workspaceBox = await page.locator('#planner-workspace').boundingBox()
  expect(selectorBox).not.toBeNull()
  expect(workspaceBox).not.toBeNull()
  expect(selectorBox?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect((selectorBox?.x ?? 0) + (selectorBox?.width ?? 0)).toBeLessThanOrEqual(393 + 1)
  for (const label of ['Show help tour', 'Open ambient music player', 'Open WhatsApp RSVP', 'Keyboard shortcuts']) {
    await expect(page.getByLabel(label)).toHaveCount(0)
  }

  const plannerLayout = await page.evaluate(() => {
    const context = document.querySelector<HTMLElement>('[data-planner-wedding-context]')
    const experience = document.querySelector<HTMLElement>('[data-planner-experience-nav]')
    const workspace = document.querySelector<HTMLElement>('#planner-workspace')
    const boxes = [context, experience, workspace].map((element) => element?.getBoundingClientRect() ?? null)
    const fixedControls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-planner-portal] button, [data-planner-portal] select'),
    ).filter((element) => window.getComputedStyle(element).position === 'fixed')
    return {
      boxes,
      fixedControls: fixedControls.map((element) => element.getAttribute('aria-label') || element.id || element.textContent),
    }
  })
  expect(plannerLayout.fixedControls).toEqual([])
  const [contextBox, experienceBox, workspaceRect] = plannerLayout.boxes
  expect(contextBox).not.toBeNull()
  expect(experienceBox).not.toBeNull()
  expect(workspaceRect).not.toBeNull()
  expect((contextBox?.bottom ?? 0)).toBeLessThanOrEqual((experienceBox?.top ?? 0) + 1)
  expect((experienceBox?.bottom ?? 0)).toBeLessThanOrEqual((workspaceRect?.top ?? 0) + 1)

  const plannerTools = page.locator('[data-planner-tools-disclosure]')
  await expect(plannerTools).toBeVisible()
  await plannerTools.click()
  await expect(plannerTools).toHaveText('Close tools')
  await plannerTools.click()
  await expect(plannerTools).toHaveText('Planner tools')

  const worksheetToolsToggle = page.getByTestId('worksheet-tools-toggle')
  await worksheetToolsToggle.click()
  await expect(page.getByLabel('Worksheet module selector')).toBeVisible()
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const mobileDialog = await waitForDialogKeyboardReady(page)
  await page.keyboard.press('Escape')
  await expect(mobileDialog).toHaveCount(0)
  await expectNoDocumentOverflow(page)
})
