import { expect, openModule, openWorksheetActions, test } from './support/planner-browser'

test('planner modules, filters, tools, history, and scroll position have durable URLs', async ({ plannerPage }) => {
  await plannerPage.goto('/planner?module=guests#planner-workspace')
  await expect(plannerPage).toHaveURL(/\/planner\/guests(?:[?#]|$)/)

  const guestSearch = plannerPage.getByPlaceholder('Search name, email, phone, or table')
  await guestSearch.fill('UAT guest')
  await expect(plannerPage).toHaveURL(/filter_search=UAT(?:\+|%20)guest/)
  await plannerPage.reload()
  await expect(guestSearch).toHaveValue('UAT guest')

  await openWorksheetActions(plannerPage)
  await plannerPage.getByRole('button', { name: 'Recent imports' }).click()
  await expect(plannerPage).toHaveURL(/\/planner\/guests\/imports(?:[?#]|$)/)
  await plannerPage.reload()
  await expect(plannerPage.getByRole('button', { name: 'Recent imports' })).toBeVisible()

  await plannerPage.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(plannerPage).toHaveURL(/\/planner\/guests\/import(?:[?#]|$)/)
  await expect(plannerPage.getByRole('dialog')).toBeVisible()
  await plannerPage.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await expect(plannerPage).toHaveURL(/\/planner\/guests(?:[?#]|$)/)

  await openModule(plannerPage, 'budget')
  await openModule(plannerPage, 'guests')
  await plannerPage.goBack()
  await expect(plannerPage).toHaveURL(/\/planner\/budget(?:[?#]|$)/)
  await plannerPage.goForward()
  await expect(plannerPage).toHaveURL(/\/planner\/guests(?:[?#]|$)/)

  await plannerPage.setViewportSize({ width: 430, height: 667 })
  await openModule(plannerPage, 'checklist')
  const scrollOwner = plannerPage.locator('[data-planner-primary-scroll="true"]')
  await expect(scrollOwner).toBeVisible()
  await expect.poll(async () =>
    scrollOwner.evaluate((element) => element.scrollHeight - element.clientHeight),
  ).toBeGreaterThan(80)
  await scrollOwner.evaluate((element) => {
    element.scrollTop = Math.min(320, element.scrollHeight - element.clientHeight)
    element.dispatchEvent(new Event('scroll'))
  })
  const savedPosition = await scrollOwner.evaluate((element) => element.scrollTop)
  expect(savedPosition).toBeGreaterThan(0)
  await expect.poll(async () => plannerPage.evaluate(() => {
    const key = `wewed:planner:scroll:${window.location.pathname}`
    return Number(window.sessionStorage.getItem(key) ?? 0)
  })).toBeGreaterThan(0)

  await plannerPage.reload()
  await expect.poll(async () => {
    const restored = plannerPage.locator('[data-planner-primary-scroll="true"]')
    return restored.evaluate((element) => element.scrollTop)
  }).toBeGreaterThan(0)
})
