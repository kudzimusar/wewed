import {
  E2E_WEDDINGS,
  expect,
  expectNoDocumentOverflow,
  openModule,
  test,
} from './support/planner-browser'

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
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

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

  const selectorBox = await page.getByLabel('Worksheet module selector').boundingBox()
  const workspaceBox = await page.locator('#planner-workspace').boundingBox()
  expect(selectorBox).not.toBeNull()
  expect(workspaceBox).not.toBeNull()
  expect(selectorBox?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect((selectorBox?.x ?? 0) + (selectorBox?.width ?? 0)).toBeLessThanOrEqual(393 + 1)

  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expectNoDocumentOverflow(page)
})
