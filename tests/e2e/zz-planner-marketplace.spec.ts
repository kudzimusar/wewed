import { createHmac } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { E2E_USER, E2E_WEDDINGS } from './support/planner-fixture'
import { E2E_COUPLE, E2E_MARKETPLACE, marketplaceMembershipStatus, resetMarketplaceE2EFixture } from './support/marketplace-fixture'

const SECRET = process.env.WEWED_SESSION_SECRET ?? ''
function token(user: { id: string; authUserId: string; email: string }, role: 'couple' | 'planner', weddingId: string) {
  const payload = { version: 2, userId: user.id, authUserId: user.authUserId, email: user.email, role, coupleId: role === 'couple' ? E2E_WEDDINGS.primary.coupleId : null, activeWeddingId: weddingId, expiresAt: Date.now() + 3600000 }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${createHmac('sha256', SECRET).update(encoded).digest('base64url')}`
}
async function signIn(page: import('@playwright/test').Page, value: string) {
  await page.context().clearCookies(); await page.context().addCookies([{ name: 'wewed_admin_auth', value, url: 'http://127.0.0.1:3000', httpOnly: true, sameSite: 'Lax' }])
}

test('planner discovery, enquiry, appointment, authority and revocation are secure in Chromium', async ({ page }) => {
  await resetMarketplaceE2EFixture()
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('response', (response) => { if (response.status() >= 500) runtimeErrors.push(`${response.status()} ${response.url()}`) })

  await page.goto('/planners')
  await expect(page.getByRole('heading', { name: 'Find a wedding planner' })).toBeVisible()
  await expect(page.getByText('Planner E2E Studio', { exact: true })).toBeVisible()
  await expect(page.getByText(E2E_WEDDINGS.primary.seededTask)).toHaveCount(0)

  await signIn(page, token(E2E_COUPLE, 'couple', E2E_WEDDINGS.primary.id))
  await page.goto(`/couple/planners?planner=${E2E_MARKETPLACE.profileId}`)
  await expect(page.getByRole('heading', { name: 'Your planner centre' })).toBeVisible()
  await page.getByRole('button', { name: 'Send enquiry' }).click()
  await expect(page.getByText('Your enquiry was sent without granting wedding access.')).toBeVisible()
  expect(await marketplaceMembershipStatus()).toBeNull()

  await signIn(page, token({ ...E2E_USER, authUserId: E2E_USER.authUserId }, 'planner', E2E_WEDDINGS.secondary.id))
  await page.goto('/planner/marketplace')
  await expect(page.getByRole('heading', { name: 'Planner marketplace centre' })).toBeVisible()
  await page.getByPlaceholder('Reply to the couple').fill('Available and happy to discuss the wedding.')
  await page.getByRole('button', { name: 'Accept interest' }).click()
  await expect(page.getByText('Interest accepted. The couple may now request an appointment.')).toBeVisible()

  await signIn(page, token(E2E_COUPLE, 'couple', E2E_WEDDINGS.primary.id))
  await page.goto('/couple/planners')
  await page.getByRole('button', { name: 'Request appointment' }).click()
  await expect(page.getByText('Appointment request sent to the planner.')).toBeVisible()

  await signIn(page, token({ ...E2E_USER, authUserId: E2E_USER.authUserId }, 'planner', E2E_WEDDINGS.secondary.id))
  await page.goto('/planner/marketplace')
  await page.getByRole('button', { name: 'Accept appointment' }).click()
  await expect(page.getByText('Appointment accepted. Waiting for the couple to grant authority.')).toBeVisible()
  expect(await marketplaceMembershipStatus()).toBeNull()

  await signIn(page, token(E2E_COUPLE, 'couple', E2E_WEDDINGS.primary.id))
  await page.goto('/couple/planners')
  await page.getByRole('button', { name: /Full coordination/ }).click()
  await expect(page.getByText('Full coordination authority is active.')).toBeVisible()
  expect(await marketplaceMembershipStatus()).toBe('active')
  await page.getByRole('button', { name: 'Revoke authority' }).click()
  await expect(page.getByText('Planner authority is revoked.')).toBeVisible()
  expect(await marketplaceMembershipStatus()).toBe('revoked')

  await page.goto(`/w/${E2E_WEDDINGS.primary.slug}`)
  await expect(page.locator('body')).toContainText('Aurora')
  expect(runtimeErrors).toEqual([])
})
