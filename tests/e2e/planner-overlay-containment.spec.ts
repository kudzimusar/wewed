import { expect, openModule, test } from './support/planner-browser'

test('mobile planner dialogs and notifications remain visible, scrollable, and dismissible', async ({ plannerPage: page }, testInfo) => {
  await page.setViewportSize({ width: 412, height: 732 })
  await openModule(page, 'guests')

  const header = page.locator('[data-planner-portal] > header')
  const templateDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Template', exact: true }).click()
  const templateDownload = await templateDownloadPromise
  const templatePath = testInfo.outputPath('mobile-guests-template.xlsx')
  await templateDownload.saveAs(templatePath)

  const toastTitle = page.getByText('Template downloaded', { exact: true })
  await expect(toastTitle).toBeVisible()
  const headerBox = await header.boundingBox()
  const toastBox = await toastTitle.boundingBox()
  expect(headerBox).not.toBeNull()
  expect(toastBox).not.toBeNull()
  expect(toastBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1)

  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input[type="file"]').setInputFiles(templatePath)
  await expect(dialog.getByTestId('import-stat-rows').getByText('0', { exact: true })).toBeVisible()

  const dialogBox = await dialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0)
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(733)

  const closeButton = dialog.getByRole('button', { name: 'Close' })
  await expect(closeButton).toBeVisible()
  const closeBox = await closeButton.boundingBox()
  expect(closeBox).not.toBeNull()
  expect(closeBox!.y).toBeGreaterThanOrEqual(dialogBox!.y)
  expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height)

  const mappingTrigger = dialog.locator('[data-slot="select-trigger"]').first()
  await mappingTrigger.click()
  const selectContent = page.locator('[data-slot="select-content"]')
  await expect(selectContent).toBeVisible()
  const dialogZ = await dialog.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || '0', 10))
  const selectZ = await selectContent.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || '0', 10))
  expect(selectZ).toBeGreaterThan(dialogZ)
  await page.keyboard.press('Escape')

  await closeButton.click()
  await expect(dialog).toHaveCount(0)
})
