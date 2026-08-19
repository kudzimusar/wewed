import type { Page } from '@playwright/test'
import { expect, expectNoDocumentOverflow, test } from './support/planner-browser'

async function createSavedNote(page: Page, titleText: string) {
  const createdResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/notebook') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'New note', exact: true }).click()
  expect((await createdResponse).ok()).toBe(true)

  const title = page.getByPlaceholder('Note title')
  const editor = page.getByPlaceholder(/Start writing/)
  await title.fill(titleText)
  await editor.fill('## Recovery check\n\nAPPROVED: Keep this source available for recovery testing.')
  await expect(page.locator('span').filter({ hasText: /^Saved$/ }).first()).toBeVisible({ timeout: 10_000 })
}

async function openPhoneNoteList(page: Page) {
  const backToList = page.locator('main button').filter({ has: page.locator('svg.lucide-chevron-left') }).first()
  if (await backToList.isVisible().catch(() => false)) await backToList.click()
}

test('Notebook distinguishes Archive from Trash and restores both from visible Recovery', async ({ plannerPage: page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/planner/notebook')
  await expect(page.getByRole('heading', { name: 'Notebook', exact: true })).toBeVisible()

  const archivedTitle = `Notebook archived recovery ${Date.now()}`
  await createSavedNote(page, archivedTitle)

  const archive = page.getByRole('button', { name: 'Archive note — recoverable' })
  await expect(archive).toBeVisible()
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('does NOT delete')
    expect(dialog.message()).toContain('Recovery')
    await dialog.accept()
  })
  await archive.click()
  await expect(page.getByText(archivedTitle, { exact: true })).toHaveCount(0)

  await page.getByRole('link', { name: 'Recovery · files · tags' }).click()
  await expect(page).toHaveURL(/\/planner\/notebook\/manage#recovery$/)
  const recovery = page.getByRole('heading', { name: 'Recovery', exact: true })
  await expect(recovery).toBeVisible()
  const recoverySection = recovery.locator('..').locator('..')
  await expect(recoverySection.getByText(archivedTitle, { exact: true })).toBeVisible()
  const archivedRow = recoverySection.locator('div').filter({ hasText: archivedTitle }).filter({ has: page.getByRole('button', { name: 'Restore' }) }).first()
  await archivedRow.getByRole('button', { name: 'Restore' }).click()
  await expect(recoverySection.getByText(archivedTitle, { exact: true })).toHaveCount(0)

  await page.getByRole('link', { name: 'Back to Notebook' }).click()
  // On phone Notebook opens a note immediately and intentionally hides the list.
  // Return to the list before asserting that the restored note is available there.
  await openPhoneNoteList(page)
  await expect(page.getByText(archivedTitle, { exact: true })).toBeVisible()

  const trashedTitle = `Notebook trash recovery ${Date.now()}`
  await createSavedNote(page, trashedTitle)
  const trash = page.getByRole('button', { name: 'Move note to Trash — recoverable' })
  await expect(trash).toBeVisible()
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Trash')
    expect(dialog.message()).toContain('restored')
    await dialog.accept()
  })
  await trash.click()
  await expect(page.getByText(trashedTitle, { exact: true })).toHaveCount(0)

  await page.getByRole('link', { name: 'Recovery · files · tags' }).click()
  await expect(recovery).toBeVisible()
  await expect(recoverySection.getByText(trashedTitle, { exact: true })).toBeVisible()
  const trashRow = recoverySection.locator('div').filter({ hasText: trashedTitle }).filter({ has: page.getByRole('button', { name: 'Restore' }) }).first()
  await trashRow.getByRole('button', { name: 'Restore' }).click()
  await expect(recoverySection.getByText(trashedTitle, { exact: true })).toHaveCount(0)
  await expectNoDocumentOverflow(page)
})

test('Notebook explains secure sharing and record/transcribe behavior at the point of use', async ({ plannerPage: page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/planner/notebook')

  const title = `Notebook clarity ${Date.now()}`
  await createSavedNote(page, title)

  await page.locator('button[title="Share"]').click()
  const shareGuide = page.locator('[data-notebook-clarity-guide="share"]')
  await expect(shareGuide).toBeVisible()
  await expect(shareGuide).toContainText('persistent in-app notification')
  await expect(shareGuide).toContainText('Email or WhatsApp')
  await expect(shareGuide).toContainText('Can view or Can edit')
  await page.getByRole('button', { name: 'Close panel' }).click()

  await page.locator('button[title="Meeting and voice"]').click()
  const voiceGuide = page.locator('[data-notebook-clarity-guide="voice"]')
  await expect(voiceGuide).toBeVisible()
  await expect(voiceGuide).toContainText(/Record & transcribe|Recording is available/)
  await expect(voiceGuide).toContainText(/private audio/)
  await expectNoDocumentOverflow(page)
})
