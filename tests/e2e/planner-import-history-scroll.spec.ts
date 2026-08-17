import { PrismaClient } from '@prisma/client'
import { E2E_WEDDINGS, expect, openModule, openWorksheetActions, test } from './support/planner-browser'

const IMPORT_JOBS = Array.from({ length: 8 }, (_, index) => ({
  id: `history-job-${index + 1}`,
  moduleKey: 'vendors',
  fileName: `history-${index + 1}.xlsx`,
  templateVersion: '1.1.0',
  status: index === 0 ? 'executed' : 'preview',
  totalRows: 1,
  createdCount: index === 0 ? 0 : 1,
  updatedCount: index === 0 ? 1 : 0,
  skippedCount: 0,
  errorCount: 0,
  errorReport: null,
  rollbackToken: index === 0 ? 'rollback-history-job-1' : null,
  rollbackData: index === 0 ? JSON.stringify({ moduleKey: 'vendors', createdIds: [], updatedRecords: [] }) : null,
  weddingId: E2E_WEDDINGS.primary.id,
  performedBy: 'e2e-planner-user',
  createdAt: new Date(`2026-08-04T00:0${index}:00.000Z`),
  updatedAt: new Date(`2026-08-04T00:0${index}:00.000Z`),
}))

test('recent import history scrolls and keeps the oldest rollback action reachable', async ({ plannerPage: page }) => {
  test.setTimeout(60_000)

  const prisma = new PrismaClient()
  try {
    await prisma.importJob.createMany({ data: IMPORT_JOBS })
  } finally {
    await prisma.$disconnect()
  }

  for (const viewport of [
    { width: 390, height: 667 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/planner/vendors#planner-workspace')
    await openModule(page, 'vendors')
    await openWorksheetActions(page)
    await page.getByRole('button', { name: /Recent imports/i }).click()

    const historyScroll = page.locator('[data-worksheet-data-recovery] > div.rounded-xl')
    await expect(historyScroll).toBeVisible()
    await expect(historyScroll.getByText('history-8.xlsx', { exact: true })).toBeAttached()
    await expect(historyScroll.getByText('history-1.xlsx', { exact: true })).toBeAttached()

    const contract = await historyScroll.evaluate((element) => {
      const style = getComputedStyle(element)
      const overflowOwned = ['auto', 'scroll'].includes(style.overflowY)
      const overflowPresent = element.scrollHeight > element.clientHeight + 1
      element.scrollTop = 0
      const origin = element.scrollTop
      element.scrollTop = element.scrollHeight
      return {
        overflowOwned,
        overflowPresent,
        moved: element.scrollTop > origin,
      }
    })

    expect(contract.overflowOwned, 'history owns vertical scrolling').toBe(true)
    expect(contract.overflowPresent, 'long history is bounded instead of clipped').toBe(true)
    expect(contract.moved, 'history scroll position can move').toBe(true)

    const oldestJob = historyScroll
      .getByText('history-1.xlsx', { exact: true })
      .locator('xpath=ancestor::div[.//button[normalize-space()="Roll back"]][1]')
    const rollback = oldestJob.getByRole('button', { name: 'Roll back', exact: true })
    await expect(rollback).toBeVisible()
    await expect(rollback).toBeInViewport()
  }
})
