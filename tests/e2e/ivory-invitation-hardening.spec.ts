import { expect, test } from '@playwright/test'

const PREVIEW = '/preview/invitation/ivory-floral-gold'
const REQUIRED_ARTWORK = [
  'closed-surface.webp',
  'left-door.webp',
  'right-door.webp',
  'open-surface.webp',
  'details-surface.webp',
  'paper.webp',
]

function collectRuntimeErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
}

async function openToDetails(page: import('@playwright/test').Page) {
  const card = page.getByTestId('invitation-trifold')
  await expect(card).toHaveAttribute('data-invitation-view', 'closed')
  await page.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'opening', { timeout: 800 })
  await expect(card).toHaveAttribute('data-invitation-view', 'open', { timeout: 4_000 })
  await page.getByTestId('invitation-details-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'details')
  return card
}

test.describe('Ivory Floral Gold hardening', () => {
  test('all runtime artwork surfaces are deployable WebP assets', async ({ request }) => {
    for (const file of REQUIRED_ARTWORK) {
      const response = await request.get(`/invitation-art/ivory/${file}`)
      expect(response.ok(), `${file} should be available`).toBe(true)
      expect(response.headers()['content-type'] || '', `${file} should be served as an image`).toContain('image/')
      expect((await response.body()).byteLength, `${file} should not be empty`).toBeGreaterThan(1_000)
    }
  })

  test('rapid opening and repeated details/note/replay cycles remain stable', async ({ page }) => {
    const errors = collectRuntimeErrors(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(PREVIEW)

    const card = page.getByTestId('invitation-trifold')
    await expect(card).toHaveAttribute('data-invitation-view', 'closed')

    // Two synchronous taps model an impatient guest without relying on locator timing.
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-testid="invitation-open-button"]')
      button?.click()
      button?.click()
    })
    await expect(card).toHaveAttribute('data-invitation-view', 'open', { timeout: 4_000 })

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.getByTestId('invitation-details-button').click()
      await expect(card).toHaveAttribute('data-invitation-view', 'details')

      const noteButton = page.getByTestId('invitation-cta-note')
      await noteButton.click()
      const note = page.getByTestId('invitation-note-dialog')
      await expect(note).toBeVisible()
      await page.getByRole('button', { name: 'Close note' }).click()
      await expect(note).not.toBeVisible()
      await expect(noteButton).toBeFocused()

      await page.getByTestId('invitation-back-button').click()
      await expect(card).toHaveAttribute('data-invitation-view', 'open')

      if (cycle < 2) {
        await page.getByTestId('invitation-replay-button').click()
        await expect(card).toHaveAttribute('data-invitation-view', 'opening', { timeout: 800 })
        await expect(card).toHaveAttribute('data-invitation-view', 'open', { timeout: 4_000 })
      }
    }

    await expectNoHorizontalOverflow(page)
    expect(errors).toEqual([])
  })

  test('calendar and venue actions remain real browser actions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(PREVIEW)
    await openToDetails(page)

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('invitation-cta-calendar').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('wewed-wedding.ics')

    const venue = page.getByTestId('invitation-cta-venue')
    await expect(venue).toHaveAttribute('href', /^https:\/\//)
    await expect(venue).toHaveAttribute('target', '_blank')
    await expect(venue).toHaveAttribute('rel', /noopener/)
  })

  test('canonical geometry survives portrait, compact and landscape resizing', async ({ page }) => {
    const viewports = [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 844, height: 390 },
    ]

    await page.goto(PREVIEW)
    const stage = page.getByTestId('invitation-trifold')

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await expect(stage).toBeVisible()
      const box = await stage.boundingBox()
      expect(box).not.toBeNull()
      expect(Math.abs((box!.width / box!.height) - (9 / 19.5))).toBeLessThan(0.01)
      expect(box!.width).toBeLessThanOrEqual(viewport.width)
      await expectNoHorizontalOverflow(page)
    }
  })
})
