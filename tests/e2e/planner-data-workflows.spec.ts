import { basename } from 'node:path'
import * as XLSX from 'xlsx'
import {
  E2E_WEDDINGS,
  acceptNextConfirmation,
  expect,
  openModule,
  test,
} from './support/planner-browser'

test('downloaded Excel template imports, exports, records history, and rolls back', async ({ plannerPage: page }, testInfo) => {
  const importedTask = 'Excel round-trip task'
  await openModule(page, 'checklist')

  const templateDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Template', exact: true }).click()
  const templateDownload = await templateDownloadPromise
  const templatePath = testInfo.outputPath('checklist-template.xlsx')
  await templateDownload.saveAs(templatePath)

  const workbook = XLSX.readFile(templatePath)
  const templateSheet = workbook.Sheets.Template
  expect(templateSheet).toBeTruthy()
  const existingRows = XLSX.utils.sheet_to_json<unknown[]>(templateSheet, { header: 1 })
  const headers = (existingRows[0] ?? []).map(String)
  const values: Record<string, string> = {
    'Task ID': '',
    Task: importedTask,
    Category: 'venue',
    Description: 'Created by the executable XLSX release gate',
    'Assigned Person': 'Planner E2E',
    'Due Date': '2027-04-20',
    Priority: 'high',
    Status: 'todo',
    Dependency: '',
    'Completion %': '0',
    Notes: 'Round-trip marker',
  }
  workbook.Sheets.Template = XLSX.utils.aoa_to_sheet([
    headers,
    headers.map((header) => values[header] ?? ''),
  ])
  const importPath = testInfo.outputPath('checklist-roundtrip.xlsx')
  XLSX.writeFile(workbook, importPath)

  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/\/planner\/tasks\/import(?:[?#]|$)/)
  const importDialog = page.getByRole('dialog')
  await expect(importDialog).toBeVisible()
  const previewResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/imports') && response.request().method() === 'POST',
  )
  await importDialog.locator('input[type="file"]').setInputFiles(importPath)
  expect((await previewResponse).ok()).toBe(true)
  await expect(importDialog.getByTestId('import-review-table-scroll').getByRole('cell', { name: importedTask, exact: true })).toBeVisible()
  await importDialog.getByRole('button', { name: 'Review import' }).click()
  await importDialog.getByRole('button', { name: 'Import now' }).click()
  await expect(importDialog.getByRole('heading', { name: 'Import completed' })).toBeVisible()
  await expect(importDialog.getByText(/1 created/)).toBeVisible()
  await importDialog.getByRole('button', { name: 'View in planner' }).click()
  await openModule(page, 'checklist')
  await expect(page.getByText(importedTask, { exact: true })).toBeVisible()

  const exportDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const exportDownload = await exportDownloadPromise
  const exportPath = testInfo.outputPath('checklist-export.xlsx')
  await exportDownload.saveAs(exportPath)
  const exportedWorkbook = XLSX.readFile(exportPath)
  const exportedSheet = exportedWorkbook.Sheets[exportedWorkbook.SheetNames[0]]
  const exportedCells = XLSX.utils.sheet_to_json<unknown[]>(exportedSheet, { header: 1 }).flat()
  expect(exportedCells).toContain(importedTask)

  await page.getByRole('button', { name: /Recent imports/ }).click()
  const historyRow = page
    .getByText(basename(importPath), { exact: true })
    .locator('xpath=ancestor::div[.//button[normalize-space()="Roll back"]][1]')
  await expect(historyRow).toBeVisible()
  acceptNextConfirmation(page)
  await historyRow.getByRole('button', { name: 'Roll back' }).click()
  await expect(page.getByText('Import rolled back', { exact: true })).toBeVisible()
  await openModule(page, 'checklist')
  await expect(page.getByText(importedTask, { exact: true })).toHaveCount(0)
})

test('two populated weddings remain isolated through a realistic planner day', async ({ plannerPage: page }) => {
  const primaryDailyTask = 'Primary daily coordination task'
  const secondaryDailyTask = 'Secondary daily coordination task'

  await openModule(page, 'checklist')
  await expect(page.getByText(E2E_WEDDINGS.primary.seededTask, { exact: true })).toBeVisible()
  await expect(page.getByText(E2E_WEDDINGS.secondary.seededTask, { exact: true })).toHaveCount(0)
  await page.locator('#workspace-task-title').fill(primaryDailyTask)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(primaryDailyTask, { exact: true })).toBeVisible()

  await page.locator('#active-wedding').selectOption(E2E_WEDDINGS.secondary.id)
  await expect(page.getByRole('heading', { name: E2E_WEDDINGS.secondary.title })).toBeVisible()
  await openModule(page, 'checklist')
  await expect(page.getByText(E2E_WEDDINGS.secondary.seededTask, { exact: true })).toBeVisible()
  await expect(page.getByText(E2E_WEDDINGS.primary.seededTask, { exact: true })).toHaveCount(0)
  await expect(page.getByText(primaryDailyTask, { exact: true })).toHaveCount(0)
  await page.locator('#workspace-task-title').fill(secondaryDailyTask)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(secondaryDailyTask, { exact: true })).toBeVisible()

  const secondaryResponse = await page.request.get('/api/planner/tasks')
  expect(secondaryResponse.ok()).toBeTruthy()
  const secondaryPayload = (await secondaryResponse.json()) as { data: Array<{ title: string }> }
  expect(secondaryPayload.data.map((task) => task.title)).toContain(secondaryDailyTask)
  expect(secondaryPayload.data.map((task) => task.title)).not.toContain(primaryDailyTask)

  await page.locator('#active-wedding').selectOption(E2E_WEDDINGS.primary.id)
  await expect(page.getByRole('heading', { name: E2E_WEDDINGS.primary.title })).toBeVisible()
  await openModule(page, 'checklist')
  await expect(page.getByText(primaryDailyTask, { exact: true })).toBeVisible()
  await expect(page.getByText(secondaryDailyTask, { exact: true })).toHaveCount(0)

  await page.reload()
  await expect(page.locator('#active-wedding')).toHaveValue(E2E_WEDDINGS.primary.id)
  await openModule(page, 'checklist')
  await expect(page.getByText(primaryDailyTask, { exact: true })).toBeVisible()
  await openModule(page, 'budget')
  await expect(page.getByText('Primary venue booking', { exact: true })).toBeVisible()
  await openModule(page, 'vendors')
  await expect(page.getByText(E2E_WEDDINGS.primary.seededVendor, { exact: true })).toBeVisible()
  await openModule(page, 'guests')
  await expect(page.getByText(E2E_WEDDINGS.primary.seededGuest, { exact: true })).toBeVisible()
  await openModule(page, 'timeline')
  await expect(page.getByText(E2E_WEDDINGS.primary.seededTimeline, { exact: true })).toBeVisible()
  await openModule(page, 'seating')
  await expect(page.getByText(E2E_WEDDINGS.primary.seededTable, { exact: true })).toBeVisible()
})

test('untouched guest template is non-executable and formula cells are rejected in preview', async ({ plannerPage: page }, testInfo) => {
  await openModule(page, 'guests')
  const templateDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Template', exact: true }).click()
  const templateDownload = await templateDownloadPromise
  const templatePath = testInfo.outputPath('guest-safe-template.xlsx')
  await templateDownload.saveAs(templatePath)

  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/\/planner\/guests\/import(?:[?#]|$)/)
  let dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const blankPreviewResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/imports') && response.request().method() === 'POST',
  )
  await dialog.locator('input[type="file"]').setInputFiles(templatePath)
  expect((await blankPreviewResponse).ok()).toBe(true)
  await expect(dialog.getByTestId('import-stat-rows').getByText('0', { exact: true })).toBeVisible()
  await expect(dialog.getByTestId('import-stat-create').getByText('0', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Blank template confirmed', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Review import' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Choose another file' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Close preview' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/planner\/guests(?:[?#]|$)/)

  const workbook = XLSX.readFile(templatePath, { cellFormula: true })
  const sheet = workbook.Sheets.Template
  const headers = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0]?.map(String) ?? []
  const firstNameColumn = headers.indexOf('First Name')
  expect(firstNameColumn).toBeGreaterThanOrEqual(0)
  const address = XLSX.utils.encode_cell({ r: 1, c: firstNameColumn })
  sheet[address] = { t: 'n', f: '1+1', v: 2 }
  const formulaPath = testInfo.outputPath('guest-formula-rejected.xlsx')
  XLSX.writeFile(workbook, formulaPath)

  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/\/planner\/guests\/import(?:[?#]|$)/)
  dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const formulaPreviewResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/imports') && response.request().method() === 'POST',
  )
  const formulaFileChooserPromise = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Choose file' }).click()
  const formulaFileChooser = await formulaFileChooserPromise
  await formulaFileChooser.setFiles(formulaPath)
  expect((await formulaPreviewResponse).ok()).toBe(true)
  await expect(dialog.getByTestId('import-review-table-scroll').getByRole('cell').filter({ hasText: /Formula detected in "First Name"/ })).toBeVisible()
  await expect(dialog.getByTestId('import-stat-invalid').getByText('1', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Review import' })).toBeDisabled()
})
