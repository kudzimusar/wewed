import { expect, test } from '@playwright/test'

test.describe('Africa-ready Wewed experience', () => {
  test('public homepage is visual, interactive and connected', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('africa-ready-hero')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Plan a wedding as unforgettable as your love.' })).toBeVisible()
    await expect(page.locator('video[muted][autoplay][loop][playsinline]')).toHaveCount(1)
    await expect(page.getByTestId('hero-video-control')).toBeVisible()

    await expect(page.getByRole('link', { name: 'Find your planner' }).first()).toHaveAttribute('href', '/planners')
    await expect(page.getByRole('link', { name: 'Get started' }).first()).toHaveAttribute('href', '/register')
    await expect(page.getByRole('link', { name: 'For planners' }).first()).toHaveAttribute('href', '/for-planners')

    await expect(page.getByTestId('featured-planner-carousel')).toBeVisible()
    expect(await page.getByTestId('featured-planner-carousel').locator('article').count()).toBeGreaterThan(0)

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
})
