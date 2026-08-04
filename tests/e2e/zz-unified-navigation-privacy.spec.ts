import { createHmac } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { E2E_COUPLE } from './support/marketplace-fixture'
import { E2E_USER, E2E_WEDDINGS } from './support/planner-fixture'
import {
  E2E_GUEST_INVITATION,
  resetUnifiedNavigationFixture,
  rotateUnifiedGuestToken,
} from './support/unified-navigation-fixture'

const SECRET = process.env.WEWED_SESSION_SECRET ?? ''

function appToken(
  user: { id: string; authUserId: string; email: string },
  role: 'couple' | 'planner',
  weddingId: string,
) {
  const payload = {
    version: 2,
    userId: user.id,
    authUserId: user.authUserId,
    email: user.email,
    role,
    coupleId: role === 'couple' ? E2E_WEDDINGS.primary.coupleId : null,
    activeWeddingId: weddingId,
    expiresAt: Date.now() + 3_600_000,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${createHmac('sha256', SECRET).update(encoded).digest('base64url')}`
}

async function signIn(
  page: import('@playwright/test').Page,
  value: string,
) {
  await page.context().clearCookies()
  await page.context().addCookies([
    {
      name: 'wewed_admin_auth',
      value,
      url: 'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

function runtimeErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`)
  })
  return errors
}

test('public platform, invitation card exchange, API privacy and token rotation are connected', async ({ page }) => {
  await resetUnifiedNavigationFixture()
  const errors = runtimeErrors(page)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Plan the wedding/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Find a planner' }).first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Aurora & Blake')

  const denied = await page.request.get(
    `/api/wedding-content?slug=${E2E_WEDDINGS.primary.slug}`,
  )
  expect(denied.status()).toBe(401)
  expect(await denied.json()).toMatchObject({
    success: false,
    code: 'wedding_access_required',
  })

  await page.goto(`/w/${E2E_WEDDINGS.primary.slug}`)
  await expect(page.getByRole('heading', { name: 'Open your invitation' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(E2E_WEDDINGS.primary.title)

  await page.goto(
    `/w/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(E2E_GUEST_INVITATION.token)}&card=botanical`,
  )
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?invitation=1&card=botanical$`),
  )
  expect(page.url()).not.toContain(E2E_GUEST_INVITATION.token)
  await expect(page.getByRole('heading', { name: 'Your private invitation' })).toBeVisible()
  await expect(page.getByTestId('digital-invitation-card-botanical')).toBeVisible()
  await expect(page.getByTestId('digital-invitation-card-botanical')).toContainText('Aurora')

  const allowed = await page.request.get(
    `/api/wedding-content?slug=${E2E_WEDDINGS.primary.slug}`,
  )
  expect(allowed.status()).toBe(200)
  expect(await allowed.json()).toMatchObject({
    success: true,
    data: { wedding: { slug: E2E_WEDDINGS.primary.slug } },
  })

  const invitationDialog = page.getByRole('dialog', {
    name: 'Your private invitation',
  })
  await invitationDialog.getByRole('button', { name: 'RSVP now' }).click()
  await invitationDialog
    .locator('form')
    .getByRole('button', { name: 'Close', exact: true })
    .click()
  await expect(page.getByRole('link', { name: 'Find a planner' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Powered by Wewed' }).first()).toBeVisible()

  const rotated = await rotateUnifiedGuestToken()
  const revoked = await page.request.get(
    `/api/wedding-content?slug=${E2E_WEDDINGS.primary.slug}`,
  )
  expect(revoked.status()).toBe(401)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Open your invitation' })).toBeVisible()

  await page.goto(
    `/w/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(rotated)}`,
  )
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?invitation=1&card=botanical$`),
  )
  await expect(page.getByRole('heading', { name: 'Your private invitation' })).toBeVisible()
  expect(errors).toEqual([])
})

test('couple and planner accounts have visible single-source navigation', async ({ page }) => {
  await resetUnifiedNavigationFixture()
  const errors = runtimeErrors(page)

  await signIn(
    page,
    appToken(E2E_COUPLE, 'couple', E2E_WEDDINGS.primary.id),
  )
  await page.goto('/couple')
  await expect(page.getByRole('heading', { name: E2E_WEDDINGS.primary.title })).toBeVisible()
  await expect(page.getByRole('link', { name: /Find a planner/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Guests & invitations/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Privacy & access/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /View wedding site/ })).toBeVisible()

  await signIn(
    page,
    appToken(E2E_USER, 'planner', E2E_WEDDINGS.secondary.id),
  )
  await page.goto(`/w/${E2E_WEDDINGS.secondary.slug}`)
  await expect(page.getByRole('heading', { name: 'Open your invitation' })).toHaveCount(0)
  const selectedWedding = page.getByTestId('data-backed-wedding-experience')
  await expect(selectedWedding).toContainText(E2E_WEDDINGS.secondary.title)
  await expect(selectedWedding).toContainText('Secondary Test Gardens')
  await expect(selectedWedding).not.toContainText('Charity & Kudzie')
  await expect(selectedWedding).not.toContainText('Imba Manor')
  await expect(selectedWedding).not.toContainText('23 · 12 · 26')
  await expect(selectedWedding).not.toContainText('Musarurwa')

  await page.goto('/planner/tasks')
  const dock = page.getByRole('navigation', { name: 'Planner account navigation' })
  await expect(dock).toBeVisible()
  await expect(dock.getByRole('link', { name: 'Workspace' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(dock.getByRole('link', { name: 'Wewed' })).not.toHaveAttribute(
    'aria-current',
    'page',
  )
  await dock.getByRole('link', { name: 'Business' }).click()
  await expect(page.getByRole('heading', { name: 'Planner marketplace centre' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Planner workspace' })).toBeVisible()
  await expect(dock.getByRole('link', { name: 'Business' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(dock.getByRole('link', { name: 'Workspace' })).not.toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(errors).toEqual([])
})

test('public marketplace navigation remains visible on mobile @mobile', async ({ page }) => {
  await resetUnifiedNavigationFixture()
  const errors = runtimeErrors(page)

  await page.goto('/planners')
  await expect(page.getByRole('heading', { name: 'Find a wedding planner' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Wewed home' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Planner directory' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Couple dashboard' })).toBeVisible()
  expect(errors).toEqual([])
})
