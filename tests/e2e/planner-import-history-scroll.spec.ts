import { expect, openModule, test } from './support/planner-browser'

const IMPORT_JOBS = Array.from({ length: 8 }, (_, index) => ({
  id: `history-job-${index + 1}`,
  moduleKey: 'vendors',
  fileName: `history-${index + 1}.xlsx`,
  templateVersion: '1.1.0',
  status: index === 7 ? 'executed' : 'preview',
  totalRows: 1,
  createdCount: index === 7 ? 0 : 1,
  updatedCount: index === 7 ? 1 : 0,
  skippedCount: 0,
  errorCount: 0,
  errorReport: null,
  rollbackToken: index === 7 ? 'rollback-history-job-8' : null,
  createdAt: `2026-08-04T00:0${index}:00.000Z`,
  updatedAt: `2026-08-04T00:0${index}:00.000Z`,
}))

async function openWorksheetTools(page: Parameters<typeof openModule>[0]) {
  const toggle = page.getByTestId('worksheet-tools-toggle')
  if (await toggle.isVisible()) {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  }
  await expect(page.locator('#planner-worksheet-tools')).toBeVisible()
}

test('recent import history scrolls and keeps the oldest rollback action reachable', async ({ plannerPage: page }) => {
  test.setTimeout(60_000)

  await page.route('**/api/imports?*', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/imports' && url.searchParams.get('module') === 'vendors') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: IMPORT_JOBS }),
      })
      return
    }
    await route.continue()
  })

  for (const viewport of [
    { width: 390, height: 667 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/planner/vendors?panel=worksheet#planner-workspace')
    await openModule(page, 'vendors')
    await openWorksheetTools(page)
    await page.getByRole('button', { name: /Recent imports/i }).click()

    const historyScroll = page.locator('#planner-worksheet-tools > div.rounded-xl').last()
    await expect(historyScroll).toBeVisible()
    await expect(historyScroll.getByText('history-8.xlsx', { exact: true })).toBeAttached()

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

    const rollback = historyScroll.getByRole('button', { name: 'Roll back', exact: true }).last()
    await expect(rollback).toBeVisible()
    await expect(rollback).toBeInViewport()
  }
})
