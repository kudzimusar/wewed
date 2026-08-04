import { expect, test } from '@playwright/test'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }))
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function expectWeddingFirstHero(page: import('@playwright/test').Page) {
  const hero = page.getByTestId('africa-ready-hero')
  await expect(hero).toBeVisible()
  await expect(hero.locator('img')).toHaveAttribute('src', '/media/wewed-couple-hero.svg')
  await expect(hero.locator('video[muted][autoplay][loop][playsinline]')).toHaveCount(1)
  await expect(page.getByTestId('hero-video-control')).toBeVisible()
  await expect(hero).not.toContainText('Zimbabwe first')
  await expect(hero).not.toContainText('Africa ready')
}

test.describe('Wewed wedding-first experience', () => {
  test('public homepage is visual, interactive and connected', async ({ page }) => {
    await page.goto('/')

    await expectWeddingFirstHero(page)
    await expect(page.getByRole('heading', { name: 'Plan a wedding as unforgettable as your love.' })).toBeVisible()
    await expect(page.getByText('Everything for a beautifully planned wedding')).toBeVisible()

    await expect(page.getByRole('link', { name: 'Find your planner' }).first()).toHaveAttribute('href', '/planners')
    await expect(page.getByRole('link', { name: 'Get started' }).first()).toHaveAttribute('href', '/register')
    await expect(page.getByRole('link', { name: 'For planners' }).first()).toHaveAttribute('href', '/for-planners')
    await expect(page.getByRole('link', { name: 'For couples' }).first()).toHaveAttribute('href', '/#couples')

    const plannerCarousel = page.getByTestId('featured-planner-carousel')
    await expect(plannerCarousel).toBeVisible()
    await expect.poll(async () => (await plannerCarousel.getByRole('link', { name: 'View profile' }).count()) + (await plannerCarousel.getByRole('status').count())).toBeGreaterThan(0)
    await expect(plannerCarousel).not.toContainText('Eleven Eleven Testing')

    const inspiration = page.getByTestId('wedding-inspiration-carousel')
    await expect(inspiration).toBeVisible()
    await expect(inspiration.locator('article').first()).toContainText('Garden vows')
    await page.getByRole('button', { name: 'Next inspiration' }).click()
    await expect(inspiration.locator('article').first()).toContainText('Champagne and candlelight')

    await expect(page.locator('#vendors')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Professionals who bring the vision to life.' })).toBeVisible()
    await expect(page.getByText('Made for weddings. Built to bring people together.')).toBeVisible()
    await expect(page.locator('img[src*="pexels"]')).toHaveCount(0)
  })

  test('public information and marketplace pages retain the shared visual system', async ({ page }) => {
    await page.goto('/guest-access-help')
    await expect(page.getByText('Made for meaningful celebrations.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your invitation is your private entrance.' })).toBeVisible()
    await expect(page.locator('img[src*="pexels"]')).toHaveCount(0)

    await page.goto('/planners')
    await expect(page.getByText('Public planner marketplace')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Planner directory' })).toBeVisible()
  })

  test('mobile homepage keeps media, discovery and navigation operable @mobile', async ({ page }) => {
    await page.goto('/')

    await expectWeddingFirstHero(page)
    await page.getByLabel('Open public navigation').click()
    const mobileMenu = page.locator('details[open]')
    await expect(mobileMenu.getByRole('link', { name: 'For couples' })).toHaveAttribute('href', '/#couples')
    await expect(mobileMenu.getByRole('link', { name: 'For planners' })).toHaveAttribute('href', '/for-planners')

    const inspiration = page.getByTestId('wedding-inspiration-carousel')
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
