import { expect, test } from '@playwright/test'

const MOBILE_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
] as const

test('Ivory invitation uses the mobile width without distorting its canonical artboard @mobile', async ({ page }) => {
  for (const viewport of MOBILE_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto('/preview/invitation/ivory-floral-gold')

    const card = page.getByTestId('invitation-trifold')
    await expect(card).toBeVisible()

    const box = await card.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 34)
    expect(Math.abs(box!.width / box!.height - 9 / 19.5)).toBeLessThan(0.01)

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(hasHorizontalOverflow).toBe(false)
  }
})

test('Ivory interactive details retain full-width stationery presentation and centred note @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/preview/invitation/ivory-floral-gold')

  const card = page.getByTestId('invitation-trifold')
  await page.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'open')
  await page.getByTestId('invitation-details-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'details')

  const detailsBox = await card.boundingBox()
  expect(detailsBox).not.toBeNull()
  expect(detailsBox!.width).toBeGreaterThanOrEqual(356)

  await page.getByTestId('invitation-cta-note').click()
  const note = page.getByTestId('invitation-note-dialog')
  await expect(note).toBeVisible()

  const noteBox = await note.boundingBox()
  expect(noteBox).not.toBeNull()
  expect(noteBox!.x).toBeGreaterThanOrEqual(0)
  expect(noteBox!.y).toBeGreaterThanOrEqual(0)
  expect(noteBox!.x + noteBox!.width).toBeLessThanOrEqual(390)
  expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(844)

  await note.getByRole('button', { name: 'Close note' }).click()
  await expect(note).not.toBeVisible()
  await expect(page.getByTestId('invitation-back-button')).toHaveText('Back to invitation')
})
