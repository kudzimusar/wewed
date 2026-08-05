import { expect, test } from '@playwright/test'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }))
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1)
}

test.describe('Provider forms and public profiles', () => {
  test('cake provider application is preselected and keeps the initial application concise', async ({ page }) => {
    await page.goto('/register?accountType=vendor&service=cakes')

    await expect(page.getByRole('heading', { name: 'Join Wewed' })).toBeVisible()
    await expect(page.getByText('Wedding cakes & desserts', { exact: true })).toBeVisible()
    await expect(page.getByLabel(/Wedding cakes & desserts/)).toBeChecked()
    await expect(page.getByText('Each service gets a separate, relevant profile form after approval.')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Country', exact: true })).toBeVisible()
    await expect(page.getByLabel('City / town')).toBeVisible()
    await expect(page.getByLabel('Primary service area')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('cake provider directory supports filtered discovery and honest empty results', async ({ page }) => {
    await page.goto('/vendors?category=cakes')

    await expect(page.getByLabel('Service category')).toHaveValue('cakes')
    await expect(page.getByRole('heading', { name: 'Wedding cakes & desserts', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'List your business' })).toHaveAttribute('href', '/register?accountType=vendor&service=cakes')
    await expect.poll(async () =>
      (await page.getByTestId('provider-directory-results').count())
      + (await page.getByRole('status').count())
      + (await page.getByRole('alert').count()),
    ).toBeGreaterThan(0)
    await expectNoHorizontalOverflow(page)
  })})
