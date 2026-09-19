import { expect, test } from '@playwright/test'

const MOBILE_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
] as const

const IVORY_ROUTES = [
  '/preview/invitation/ivory-floral-gold',
  '/uat/invitation/ivory-floral-gold',
] as const

for (const route of IVORY_ROUTES) {
  test(`Ivory invitation stays width-driven on mobile: ${route} @mobile`, async ({ page }) => {
    for (const viewport of MOBILE_VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.goto(route)

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
}
