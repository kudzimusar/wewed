import { expect, test } from '@playwright/test'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }))
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function expectTargetedHeroReplacement(page: import('@playwright/test').Page) {
  const hero = page.getByTestId('africa-ready-hero')
  await expect(hero).toBeVisible()
  await expect(hero).toHaveCSS('background-image', /wewed-zimbabwe-couple\.svg/)
  await expect(page.locator('video[muted][autoplay][loop][playsinline]')).toBeHidden()
  await expect(page.getByTestId('hero-video-control')).toBeHidden()
}

test.describe('Africa-ready Wewed experience', () => {
  test('public homepage is visual, interactive and connected', async ({ page }) => {
    await page.goto('/')

    await expectTargetedHeroReplacement(page)
    await expect(page.getByRole('heading', { name: 'Plan a wedding as unforgettable as your love.' })).toBeVisible()

    await expect(page.getByRole('link', { name: 'Find your planner' }).first()).toHaveAttribute('href', '/planners')
    await expect(page.getByRole('link', { name: 'Get started' }).first()).toHaveAttribute('href', '/register')
    await expect(page.getByRole('link', { name: 'For planners' }).first()).toHaveAttribute('href', '/for-planners')
    await expect(page.getByRole('link', { name: 'For couples' }).first()).toHaveAttribute('href', '/#couples')

    const plannerCarousel = page.getByTestId('featured-planner-carousel')
    await expect(plannerCarousel).toBeVisible()
    await expect.poll(async () =>
      (await plannerCarousel.getByRole('link', { name: 'View profile' }).count()) +
      (await plannerCarousel.getByRole('status').count()),
    ).toBeGreaterThan(0)
    await expect(plannerCarousel).not.toContainText('Eleven Eleven Testing')

    const inspiration = page.getByTestId('wedding-inspiration-carousel')
    await expect(inspiration).toBeVisible()
    await expect(inspiration.locator('article').first()).toContainText('Garden vows in Harare')
    await page.getByRole('button', { name: 'Next inspiration' }).click()
    await expect(inspiration.locator('article').first()).toContainText('Champagne and candlelight')

    await expect(page.locator('#vendors')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Professionals who bring the vision to life.' })).toBeVisible()
    await expect(page.getByText('Built in Zimbabwe. Designed for Africa.')).toBeVisible()
  })

  test('public information and marketplace pages inherit the richer visual system', async ({ page }) => {
    await page.goto('/guest-access-help')
    await expect(page.getByText('Zimbabwe first. Africa ready.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your invitation is your private entrance.' })).toBeVisible()

    await page.goto('/planners')
    await expect(page.getByText('Public planner marketplace')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Planner directory' })).toBeVisible()
  })

  test('mobile homepage keeps media, discovery and navigation operable @mobile', async ({ page }) => {
    await page.goto('/')

    await expectTargetedHeroReplacement(page)
    await expect(page.getByRole('heading', { name: 'Plan a wedding as unforgettable as your love.' })).toBeVisible()

    await page.getByLabel('Open public navigation').click()
    const mobileMenu = page.locator('details[open]')
    await expect(mobileMenu.getByRole('link', { name: 'For couples' })).toHaveAttribute('href', '/#couples')
    await expect(mobileMenu.getByRole('link', { name: 'For planners' })).toHaveAttribute('href', '/for-planners')

    const inspiration = page.getByTestId('wedding-inspiration-carousel')
    await expect(inspiration).toBeVisible()
    await page.getByRole('button', { name: 'Next inspiration' }).click()
    await expect(inspiration.locator('article').first()).toContainText('Champagne and candlelight')
    await expectNoHorizontalOverflow(page)
  })

  test('mobile information and marketplace pages retain the shared visual frame @mobile', async ({ page }) => {
    await page.goto('/guest-access-help')
    await expect(page.getByRole('heading', { name: 'Your invitation is your private entrance.' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.goto('/planners')
    await expect(page.getByText('Public planner marketplace')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Planner directory' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})