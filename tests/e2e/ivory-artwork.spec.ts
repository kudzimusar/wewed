import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
for (const [width, height] of [
  [320, 568],
  [390, 844],
  [412, 915],
  [430, 932],
]) {
  test(`approved artwork journey ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/uat/invitation/ivory-floral-gold')
    const card = page.getByTestId('invitation-trifold')
    await expect(card).toHaveAttribute('data-invitation-view', 'closed')
    await page.evaluate(() => document.fonts.ready)
    const initial = await card.boundingBox()
    expect(initial).not.toBeNull()
    expect(initial!.width / initial!.height).toBeCloseTo(9 / 19.5, 3)
    const capture = async (state: string) => {
      await info.attach(state, {
        body: await card.screenshot(),
        contentType: 'image/png',
      })
    }
    await capture('closed')
    const button = page.getByRole('button', {
      name: 'Tap to open',
      exact: true,
    })
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(card).toHaveAttribute('data-invitation-view', 'opening')
    for (const side of ['left', 'right'])
      await expect(card.getByTestId('invitation-panel-' + side).locator('img')).toHaveAttribute(
        'src',
        new RegExp(side + '-door.webp'),
      )
    await expect(card).toHaveAttribute('data-invitation-view', 'open', {
      timeout: 3000,
    })
    await expect(card.getByTestId('invitation-panel-left')).toHaveCount(0)
    await capture('open')
    await card.getByRole('button', { name: 'Wedding details', exact: true }).click()
    await expect(card).toHaveAttribute('data-invitation-view', 'details')
    await capture('details')
    const current = await card.boundingBox()
    expect(current!.width).toEqual(initial!.width)
    expect(current!.height).toEqual(initial!.height)
    await card.getByRole('button', { name: 'RSVP', exact: true }).click()
    await expect(page.getByTestId('uat-rsvp-preview')).toBeVisible()
    await page.getByRole('button', { name: 'Close RSVP preview' }).click()
    const download = page.waitForEvent('download')
    await card.getByRole('button', { name: 'Add to Calendar' }).click()
    const file = await download
    const text = await readFile((await file.path())!, 'utf8')
    expect(text).toContain('DTSTART;VALUE=DATE:20261223')
    expect(text).not.toContain('DTSTART:')
    await expect(card.getByRole('link', { name: 'Venue Location' })).toHaveAttribute(
      'href',
      /Imba%20Manor/,
    )
    await card.getByRole('button', { name: 'A Note from Us' }).click()
    await expect(page.getByRole('dialog', { name: 'A note from us' })).toBeVisible()
    await page.keyboard.press('Escape')
    await card.getByRole('button', { name: 'Gift / Contributions' }).click()
    await expect(page.getByTestId('uat-registry-preview')).toBeInViewport()
    await page.locator('#registry').evaluate((el) => (el.id = 'registry-unconfigured'))
    await expect(card.getByRole('button', { name: 'Gift / Contributions' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Freeze / midpoint' }).click()
    await expect(card).toHaveAttribute('data-frozen', 'true')
    await capture('opening-midpoint')
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    expect(errors).toEqual([])
  })
}
test('reduced motion bypasses opening', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/uat/invitation/ivory-floral-gold')
  await page.getByRole('button', { name: 'Tap to open' }).click()
  await expect(page.getByTestId('invitation-trifold')).toHaveAttribute(
    'data-invitation-view',
    'open',
    { timeout: 500 },
  )
})
