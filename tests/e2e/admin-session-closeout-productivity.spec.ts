import { expect, expectNoDocumentOverflow, test } from './support/admin-browser'

const VIEWPORTS = [
  { name: 'small phone', width: 360, height: 800 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'tablet landscape', width: 1024, height: 768 },
  { name: 'windows compact laptop', width: 1280, height: 720 },
  { name: 'windows standard laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const

test('Admin productivity controls remain horizontally contained across target widths', async ({ adminPage: page }) => {
  test.setTimeout(120_000)

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/admin')

    const productivity = page.locator('[data-admin-productivity-console="true"]')
    await expect(productivity).toBeVisible()
    await expect(
      productivity.getByRole('button', { name: 'Open Admin command palette' }),
    ).toBeVisible()
    await expect(productivity.getByText('Export', { exact: true })).toBeVisible()
    await expectNoDocumentOverflow(page)
  }
})

test('Command palette and keyboard navigation operate through the existing Command Centre', async ({ adminPage: page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/admin')

  await page.getByRole('button', { name: 'Open Admin command palette' }).click()
  const palette = page.getByRole('dialog', { name: 'Admin command palette' })
  await expect(palette).toBeVisible()
  const commandInput = palette.getByPlaceholder(
    'Search accounts, providers, people, views, or Admin destinations',
  )
  await commandInput.fill('Accounts')
  await expect(palette.getByText('Account registry and Account 360', { exact: true })).toBeVisible()
  await palette.getByText('Accounts', { exact: true }).first().click()
  await expect(
    page.getByPlaceholder('Search account, owner, service, subtype'),
  ).toBeVisible()

  await page.keyboard.press('Control+K')
  await expect(palette).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()

  await page.keyboard.press('g')
  await page.keyboard.press('p')
  await expect(page.getByText('People & Organisation', { exact: true })).toBeVisible()

  await page.keyboard.press('g')
  await page.keyboard.press('c')
  await expect(
    page.getByText(/Pricing remains segmented by account type/),
  ).toBeVisible()

  await page.keyboard.press('/')
  const accountSearch = page.getByPlaceholder('Search account, owner, service, subtype')
  await expect(accountSearch).toBeVisible()
  await expect(accountSearch).toBeFocused()
  await expectNoDocumentOverflow(page)
})

test('Super Admin can inspect pricing governance and create a new immutable offer row', async ({ adminPage: page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/admin')

  await page.getByRole('button', { name: 'Pricing governance' }).click()
  const dialog = page.getByRole('dialog', { name: 'Pricing governance' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Versioned pricing offers', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'New offer' })).toBeVisible()

  await dialog.getByPlaceholder('offer_code').fill('e2e_closeout_offer')
  await dialog.getByPlaceholder('Offer name').fill('E2E Closeout Offer')
  await dialog.locator('select').nth(1).selectOption('contract')
  await dialog.locator('select').nth(2).selectOption('enterprise')
  await dialog.getByPlaceholder('Commercial description').fill(
    'E2E governed pricing offer used only in the ephemeral browser database.',
  )
  await dialog.getByPlaceholder('Governance reason').fill('E2E closeout pricing regression')
  await dialog.getByRole('button', { name: 'Create offer' }).click()

  await expect(dialog.getByText(/e2e_closeout_offer · v1/)).toBeVisible()
  await expect(page.getByText(/Saved e2e_closeout_offer/)).toBeVisible()
  await expectNoDocumentOverflow(page)
})

test('Scoped CSV export is generated without navigating away from Admin', async ({ adminPage: page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/admin')

  const exportSummary = page.getByText('Export', { exact: true })
  await exportSummary.click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Accounts CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^wewed-admin-accounts-\d{4}-\d{2}-\d{2}\.csv$/)
  await expect(page.locator('[data-admin-command-centre="true"]')).toBeVisible()
})
