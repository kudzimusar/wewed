import { expect, test } from '@playwright/test'
import { E2E_WEDDINGS } from './support/planner-fixture'
import { resetMarketplaceE2EFixture } from './support/marketplace-fixture'

test('planner directory and profile metadata never inherit wedding identity', async ({ page }) => {
  await resetMarketplaceE2EFixture()
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) runtimeErrors.push(`${response.status()} ${response.url()}`)
  })

  await page.goto('/planners')
  await expect(page).toHaveTitle('Find a Wedding Planner | Wewed')
  await expect(page.getByText('Planner E2E Studio', { exact: true })).toBeVisible()
  expect(await page.title()).not.toContain('Charity')
  await expect(page.getByText(E2E_WEDDINGS.primary.seededTask)).toHaveCount(0)

  await page.getByRole('link', { name: 'View planner profile' }).click()
  await expect(page).toHaveTitle('Planner E2E Studio | Wewed Planner Marketplace')
  expect(await page.title()).not.toContain('Charity')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Secure full-service planning',
  )
  await expect(page.locator('body')).not.toContainText(E2E_WEDDINGS.primary.seededTask)
  expect(runtimeErrors).toEqual([])
})
