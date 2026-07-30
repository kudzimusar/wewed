import { createHmac } from 'node:crypto'
import { basename } from 'node:path'
import * as XLSX from 'xlsx'
import { expect, test, type Page } from '@playwright/test'
import {
  E2E_USER,
  E2E_WEDDINGS,
  resetPlannerE2EFixture,
} from './support/planner-fixture'

const SESSION_COOKIE = 'wewed_admin_auth'
const SESSION_SECRET = process.env.WEWED_SESSION_SECRET ?? ''
const browserErrors = new WeakMap<Page, string[]>()

const MODULE_LABELS = {
  checklist: 'Tasks',
  budget: 'Budget',
  vendors: 'Vendors',
  guests: 'Guests',
  timeline: 'Timeline',
  seating: 'Seating',
} as const

type ModuleKey = keyof typeof MODULE_LABELS

function signedSession(activeWeddingId = E2E_WEDDINGS.primary.id): string {
  if (!SESSION_SECRET) throw new Error('WEWED_SESSION_SECRET is required for browser tests.')
  const payload = {
    version: 2,
    userId: E2E_USER.id,
    authUserId: E2E_USER.authUserId,
    email: E2E_USER.email,
    role: 'planner',
    coupleId: null,
    activeWeddingId,
    expiresAt: Date.now() + 60 * 60 * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

async function openPlanner(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: signedSession(),
      url: 'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.goto('/planner')
  await expect(page.getByRole('heading', { name: E2E_WEDDINGS.primary.title })).toBeVisible()
  await expect(page.locator('#active-wedding')).toHaveValue(E2E_WEDDINGS.primary.id)
}

async function openModule(page: Page, moduleKey: ModuleKey): Promise<void> {
  await page.getByTestId(`worksheet-module-${moduleKey}`).click()
  const workspaceNavigation = page.getByRole('navigation', {
    name: 'Planner workspace sections',
  })
  await expect(
    workspaceNavigation.getByRole('button', {
      name: MODULE_LABELS[moduleKey],
      exact: true,
    }),
  ).toHaveClass(/bg-gold/)
}

async function acceptNextConfirmation(page: Page): Promise<void> {
  page.once('dialog', async (dialog) => dialog.accept())
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(overflow.width).toBeLessThanOrEqual(overflow.viewport + 1)
}

test.beforeEach(async ({ page }) => {
  await resetPlannerE2EFixture()
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 500 && response.url().includes('/api/')) {
      errors.push(`http ${response.status()}: ${response.url()}`)
    }
  })
  await openPlanner(page)
})

test.afterEach(async ({ page }, testInfo) => {
  await testInfo.attach('planner-release-gate.png', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
  expect(browserErrors.get(page) ?? [], 'browser/runtime errors').toEqual([])
})

test('real browser CRUD persists for tasks, budget, and vendors', async ({ page }) => {
  const taskName = 'Browser CRUD task'
  await openModule(page, 'checklist')
  await expect(page.getByRole('heading', { name: 'Planning checklist' })).toBeVisible()
  await page.locator('#workspace-task-title').fill(taskName)
  await page.locator('#workspace-task-assignee').fill('Day-of coordinator')
  await page.locator('#workspace-task-priority').selectOption('high')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(taskName, { exact: true })).toBeVisible()
  await page.getByLabel(`Update status for ${taskName}`).selectOption('done')
  await expect(page.getByLabel(`Update status for ${taskName}`)).toHaveValue('done')

  await page.reload()
  await expect(page.getByRole('heading', { name: E2E_WEDDINGS.primary.title })).toBeVisible()
  await openModule(page, 'checklist')
  await expect(page.getByLabel(`Update status for ${taskName}`)).toHaveValue('done')
  await acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${taskName}` }).click()
  await expect(page.getByText(taskName, { exact: true })).toHaveCount(0)

  const budgetName = 'Browser budget item'
  await openModule(page, 'budget')
  await page.locator('#workspace-budget-description').fill(budgetName)
  await page.locator('#workspace-budget-category').selectOption('catering')
  await page.locator('#workspace-budget-estimated-cost').fill('1200')
  await page.locator('#workspace-budget-actual-cost').fill('1150')
  await page.locator('#workspace-budget-paid-amount').fill('300')
  await page.locator('#workspace-budget-due-date').fill('2027-03-10')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(budgetName, { exact: true })).toBeVisible()

  let budgetRow = page
    .getByRole('button', { name: `Delete ${budgetName}` })
    .locator('xpath=ancestor::div[contains(@class,"grid")][1]')
  await budgetRow.locator('input[type="number"]').nth(0).fill('1100')
  await budgetRow.locator('input[type="number"]').nth(0).press('Tab')
  await expect(page.getByText('Actual cost updated', { exact: true })).toBeVisible()
  budgetRow = page
    .getByRole('button', { name: `Delete ${budgetName}` })
    .locator('xpath=ancestor::div[contains(@class,"grid")][1]')
  await budgetRow.locator('input[type="number"]').nth(1).fill('1100')
  await budgetRow.locator('input[type="number"]').nth(1).press('Tab')
  await expect(page.getByText('Payment updated', { exact: true })).toBeVisible()
  await expect(page.getByText('Paid', { exact: true }).last()).toBeVisible()
  await acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${budgetName}` }).click()
  await expect(page.getByText(budgetName, { exact: true })).toHaveCount(0)

  const vendorName = 'Browser Photo Studio'
  await openModule(page, 'vendors')
  await page.locator('#workspace-vendor-name').fill(vendorName)
  await page.locator('#workspace-vendor-category').selectOption('photographer')
  await page.locator('#workspace-vendor-contact').fill('Initial Contact')
  await page.locator('#workspace-vendor-phone').fill('+263700000001')
  await page.locator('#workspace-vendor-website').fill('https://example.test/studio')
  await page.locator('#workspace-vendor-contract').selectOption('pending')
  await page.locator('#workspace-vendor-payment').selectOption('unpaid')
  await page.locator('#workspace-vendor-notes').fill('Initial browser note')
  await page.getByRole('button', { name: 'Add vendor' }).click()
  await expect(page.getByText(vendorName, { exact: true })).toBeVisible()

  const vendorCard = page.getByText(vendorName, { exact: true }).locator('xpath=ancestor::section[1]')
  await vendorCard.getByText('Edit operational details').click()
  await vendorCard.locator('input[name="contact"]').fill('Updated Contact')
  await vendorCard.locator('select[name="contractStatus"]').selectOption('signed')
  await vendorCard.locator('select[name="paymentStatus"]').selectOption('deposit')
  await vendorCard.getByRole('button', { name: 'Save vendor details' }).click()
  await expect(page.getByText(/Photographer · Updated Contact/)).toBeVisible()
  await expect(vendorCard.getByText('Signed', { exact: true })).toBeVisible()
  await acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${vendorName}` }).click()
  await expect(page.getByText(vendorName, { exact: true })).toHaveCount(0)
})

test('real browser CRUD covers guests, seating, timeline, and printing', async ({ page }) => {
  const guestName = 'Browser Seating Guest'
  await openModule(page, 'guests')
  await page.locator('#workspace-guest-name').fill(guestName)
  await page.locator('#workspace-guest-email').fill('browser.guest@example.test')
  await page.locator('#workspace-guest-phone').fill('+263700000002')
  await page.locator('#workspace-guest-role').selectOption('family')
  await page.locator('#workspace-guest-side').selectOption('neutral')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(guestName, { exact: true })).toBeVisible()
  await expect(page.getByLabel(`Assign table for ${guestName}`)).toHaveValue('')

  const tableName = 'Browser Operations Table'
  const updatedTableName = 'Browser Operations Table Updated'
  await openModule(page, 'seating')
  await page.locator('#workspace-new-table-name').fill(tableName)
  await page.locator('#workspace-new-table-capacity').fill('6')
  await page.getByRole('button', { name: 'Add table' }).click()
  await expect(page.getByText(tableName, { exact: true })).toBeVisible()

  const assignment = page.getByLabel(`Assign guest ${guestName}`)
  const tableValue = await assignment
    .locator('option')
    .filter({ hasText: tableName })
    .getAttribute('value')
  expect(tableValue).toBeTruthy()
  await assignment.selectOption(tableValue ?? '')
  await expect(page.getByText(guestName, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: `Edit ${tableName}` }).click()
  const tableCard = page
    .getByRole('button', { name: `Save ${tableName}` })
    .locator('xpath=ancestor::section[1]')
  await tableCard.locator('input').nth(0).fill(updatedTableName)
  await tableCard.locator('input').nth(1).fill('7')
  await page.getByRole('button', { name: `Save ${tableName}` }).click()
  await expect(page.getByText(updatedTableName, { exact: true })).toBeVisible()

  await acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${updatedTableName}` }).click()
  await expect(page.getByText(updatedTableName, { exact: true })).toHaveCount(0)
  await expect(page.getByLabel(`Assign guest ${guestName}`)).toBeVisible()

  await openModule(page, 'guests')
  await expect(page.getByLabel(`Assign table for ${guestName}`)).toHaveValue('')
  await acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${guestName}` }).click()
  await expect(page.getByText(guestName, { exact: true })).toHaveCount(0)

  const timelineName = 'Browser processional'
  const updatedTimelineName = 'Browser processional updated'
  await openModule(page, 'timeline')
  await page.locator('#workspace-timeline-time').fill('14:30')
  await page.locator('#workspace-timeline-event').fill(timelineName)
  await page.locator('#workspace-timeline-duration').fill('20 min')
  await page.locator('#workspace-timeline-location').fill('Test Lawn')
  await page.locator('#workspace-timeline-notes').fill('Cue the musicians')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(timelineName, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: `Edit ${timelineName}` }).click()
  await page.locator('#workspace-timeline-event').fill(updatedTimelineName)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(updatedTimelineName, { exact: true })).toBeVisible()

  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Print run sheet' }).click()
  const printPage = await popupPromise
  await expect(printPage.getByRole('heading', { name: 'Wedding Day Timeline' })).toBeVisible()
  await expect(printPage.getByText(updatedTimelineName, { exact: true })).toBeVisible()
  await expect(printPage.getByText(E2E_WEDDINGS.secondary.seededTimeline, { exact: true })).toHaveCount(0)
  await printPage.close()

  await acceptNextConfirmation(page)
  await page.getByRole('button', { name: `Delete ${updatedTimelineName}` }).click()
  await expect(page.getByText(updatedTimelineName, { exact: true })).toHaveCount(0)
})

test('downloaded Excel template imports, exports, records history, and rolls back', async ({ page }, testInfo) => {
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
  const importDialog = page.getByRole('dialog')
  await importDialog.locator('input[type="file"]').setInputFiles(importPath)
  await expect(importDialog.getByText(importedTask, { exact: true })).toBeVisible()
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
  await acceptNextConfirmation(page)
  await historyRow.getByRole('button', { name: 'Roll back' }).click()
  await expect(page.getByText('Import rolled back', { exact: true })).toBeVisible()
  await openModule(page, 'checklist')
  await expect(page.getByText(importedTask, { exact: true })).toHaveCount(0)
})

test('two populated weddings remain isolated through a realistic planner day', async ({ page }) => {
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

test('keyboard navigation, dialogs, and desktop visual containment remain usable', async ({ page }) => {
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
          label?.textContent?.trim() ||
          element.textContent?.trim()
        return !name
      })
      .map((element) => element.outerHTML.slice(0, 180)),
  )
  expect(unlabeledControls).toEqual([])
})

test('mobile planner remains contained and operable @mobile', async ({ page }) => {
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
