import { expect, test } from '@playwright/test'
import { E2E_WEDDINGS } from './support/planner-fixture'
import { resetMarketplaceE2EFixture } from './support/marketplace-fixture'

async function expectNoWeddingMetadata(page: import('@playwright/test').Page) {
  for (const selector of [
    'meta[name="keywords"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
  ]) {
    const content = await page.locator(selector).getAttribute('content')
    for (const forbidden of ['Charity', 'Kudzie', 'Imba Manor', '23.12.26']) {
      expect(content ?? '').not.toContain(forbidden)
    }
  }
}

test('planner directory and profile metadata never inherit wedding identity', async ({ page }) => {
  await resetMarketplaceE2EFixture()
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) runtimeErrors.push(`${response.status()} ${response.url()}`)
  })

  await page.goto('/planners')
  await expect(page).toHaveTitle('Find a Wedding Planner | Wewed')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Discover verified wedding planners by service, style, price band, location, and availability through the Wewed planner marketplace.',
  )
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    'content',
    'Find a Wedding Planner | Wewed',
  )
  await expect(page.getByText('Planner E2E Studio', { exact: true })).toBeVisible()
  await expect(page.getByText(E2E_WEDDINGS.primary.seededTask)).toHaveCount(0)
  await expectNoWeddingMetadata(page)

  await page.getByRole('link', { name: 'View planner profile' }).click()
  await expect(page).toHaveTitle('Planner E2E Studio | Wewed Planner Marketplace')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Secure full-service planning',
  )
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Planner E2E Studio | Wewed Planner Marketplace',
  )
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    'content',
    'Planner E2E Studio | Wewed Planner Marketplace',
  )
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
    'content',
    'Secure full-service planning',
  )
  await expect(page.locator('body')).not.toContainText(E2E_WEDDINGS.primary.seededTask)
  await expectNoWeddingMetadata(page)
  expect(runtimeErrors).toEqual([])
})

test('secure planner workspace metadata never inherit wedding identity', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) runtimeErrors.push(`${response.status()} ${response.url()}`)
  })

  await page.goto('/planner/tasks')
  await expect(page).toHaveTitle('Wewed Planner Workspace')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Secure workspace for wedding planners, coordinators, and couples.',
  )
  await expect(page.locator('meta[name="keywords"]')).toHaveAttribute(
    'content',
    'Wewed,planner workspace,wedding planning',
  )
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Wewed Planner Workspace',
  )
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    'content',
    'Wewed Planner Workspace',
  )
  await expectNoWeddingMetadata(page)
  expect(runtimeErrors).toEqual([])
})
