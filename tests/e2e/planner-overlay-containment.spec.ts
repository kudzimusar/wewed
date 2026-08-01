import { expect, openModule, test } from './support/planner-browser'

test('mobile planner dialogs and notifications remain visible, scrollable, and dismissible', async ({ plannerPage: page }, testInfo) => {
  await page.setViewportSize({ width: 412, height: 732 })
  await openModule(page, 'guests')

  const worksheetToggle = page.getByTestId('worksheet-tools-toggle')
  await expect(worksheetToggle).toBeVisible()
  await worksheetToggle.click()
  await expect(page.locator('#planner-worksheet-tools')).toBeVisible()

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
  const semanticDialog = page.getByRole('dialog')
  const dialog = page.locator('[data-slot="dialog-content"]')
  await expect(semanticDialog).toBeVisible()
  await dialog.locator('input[type="file"]').setInputFiles(templatePath)
  await expect(dialog.getByTestId('import-stat-rows').getByText('0', { exact: true })).toBeVisible()

  const dialogBox = await dialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0)
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(733)

  let closeButton = dialog.getByRole('button', { name: 'Close' })
  await expect(closeButton).toBeVisible()
  const closeBox = await closeButton.boundingBox()
  expect(closeBox).not.toBeNull()
  expect(closeBox!.y).toBeGreaterThanOrEqual(dialogBox!.y)
  expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height)

  const dialogZ = await dialog.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || '0', 10))
  const mappingTrigger = dialog.locator('[data-slot="select-trigger"]').first()
  await mappingTrigger.click()
  const selectContent = page.locator('[data-slot="select-content"]:visible')
  await expect(selectContent).toBeVisible()
  const selectZ = await selectContent.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || '0', 10))
  expect(selectZ).toBeGreaterThan(dialogZ)
  await page.keyboard.press('Escape')
  await expect(selectContent).toHaveCount(0)
  await expect(dialog).toBeVisible()

  closeButton = dialog.getByRole('button', { name: 'Close' })
  await closeButton.click()
  await expect(dialog).toHaveCount(0)
})
