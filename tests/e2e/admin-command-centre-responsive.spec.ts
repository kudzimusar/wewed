import { expect, expectNoDocumentOverflow, test } from './support/admin-browser'

const VIEWPORTS = [
  { name: 'small phone', width: 360, height: 800, mobile: true },
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'tablet portrait', width: 768, height: 1024, mobile: false },
  { name: 'tablet landscape', width: 1024, height: 768, mobile: false },
  { name: 'windows compact laptop', width: 1280, height: 720, mobile: false },
  { name: 'windows standard laptop', width: 1366, height: 768, mobile: false },
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
] as const

test('Admin command centre remains dense and horizontally contained across Windows, tablet, and phone widths', async ({ adminPage: page }) => {
  test.setTimeout(120_000)

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/admin')
    await expect(page.locator('[data-admin-command-centre="true"]')).toBeVisible()
    await expect(page.getByText('Accounts by category', { exact: true })).toBeVisible()

    const populationGrid = page
      .getByText('Accounts by category', { exact: true })
      .locator('xpath=../../following-sibling::div[1]')
    await expect(populationGrid).toBeVisible()

    const columns = await populationGrid.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
    )
    if (viewport.width < 640) {
      expect(columns, `${viewport.name} uses the planned 2-column population grid`).toBe(2)
    } else if (viewport.width < 1280) {
      expect(columns, `${viewport.name} uses the planned compact tablet grid`).toBe(3)
    } else {
      expect(columns, `${viewport.name} exposes the full account population row`).toBe(6)
    }

    await expectNoDocumentOverflow(page)

    if (viewport.mobile) {
      const mobileNav = page.getByRole('navigation', {
        name: 'Wewed administrator mobile navigation',
      })
      await expect(mobileNav).toBeVisible()
      await expect(
        page.getByRole('navigation', { name: 'Wewed administrator navigation' }),
      ).toBeHidden()
      await expect(mobileNav.getByRole('button', { name: 'More' })).toBeVisible()

      await mobileNav.getByRole('button', { name: 'More' }).click()
      const moreSheet = page.getByRole('dialog', { name: 'More Admin navigation' })
      await expect(moreSheet).toBeVisible()
      await expect(moreSheet.getByRole('link', { name: 'Planner profiles' })).toBeVisible()
      await moreSheet.getByRole('button', { name: 'Close Admin menu' }).click()
      await expect(moreSheet).toBeHidden()

      const identityTrigger = page.locator('[data-admin-identity-review-trigger="true"]')
      await expect(identityTrigger).toBeVisible()
      const geometry = await page.evaluate(() => {
        const identity = document.querySelector<HTMLElement>('[data-admin-identity-review-trigger="true"]')
        const nav = document.querySelector<HTMLElement>('nav[aria-label="Wewed administrator mobile navigation"]')
        if (!identity || !nav) return null
        const identityRect = identity.getBoundingClientRect()
        const navRect = nav.getBoundingClientRect()
        return {
          identityBottom: identityRect.bottom,
          navTop: navRect.top,
        }
      })
      expect(geometry, `${viewport.name} exposes both fixed controls`).not.toBeNull()
      expect(geometry!.identityBottom, `${viewport.name} identity control stays above mobile navigation`).toBeLessThanOrEqual(geometry!.navTop + 1)
    } else {
      await expect(
        page.getByRole('navigation', { name: 'Wewed administrator navigation' }),
      ).toBeVisible()
    }
  }
})

test('Business account registry switches away from mandatory horizontal scrolling below desktop width', async ({ adminPage: page }) => {
  test.setTimeout(90_000)
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/admin')
    const governedTable = page.locator('table[class*="min-w-[1050px]"]').first()
    await expect(governedTable).toBeVisible()
    const layout = await governedTable.evaluate((table) => ({
      display: getComputedStyle(table).display,
      minWidth: getComputedStyle(table).minWidth,
      width: table.getBoundingClientRect().width,
      viewport: window.innerWidth,
    }))
    expect(layout.display).toBe('block')
    expect(parseFloat(layout.minWidth) || 0).toBeLessThanOrEqual(layout.viewport)
    expect(layout.width).toBeLessThanOrEqual(layout.viewport + 1)
    await expectNoDocumentOverflow(page)
  }
})

test('Account 360 keeps classification separate from lifecycle, systems, and billing', async ({ adminPage: page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin')

  const commandCentre = page.locator('[data-admin-command-centre="true"]')
  await expect(commandCentre).toBeVisible()
  const commandNav = commandCentre.getByRole('navigation', {
    name: 'Command centre sections',
  })
  await commandNav.getByRole('button', { name: 'Accounts', exact: true }).click()
  await expect(
    commandCentre.getByPlaceholder('Search account, owner, service, subtype'),
  ).toBeVisible()

  const accountCard = commandCentre
    .getByText('Wewed', { exact: true })
    .locator('xpath=ancestor::button[1]')
  await expect(accountCard).toHaveCount(1)
  await expect(accountCard).toBeVisible()
  await expect(accountCard).toBeEnabled()
  await accountCard.scrollIntoViewIfNeeded()
  await accountCard.click()

  const drawer = page.getByRole('dialog', { name: /Wewed account overview/ })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('Account 360', { exact: true })).toBeVisible()
  await expect(drawer.getByText('Classification', { exact: true })).toBeVisible()
  await expect(drawer.getByText('Services & systems', { exact: true })).toBeVisible()
  await expect(drawer.getByText('Commercial', { exact: true })).toBeVisible()
  await expect(drawer.getByText('Internal', { exact: true })).toBeVisible()
  await expectNoDocumentOverflow(page)
})
