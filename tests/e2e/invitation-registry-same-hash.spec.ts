import { PrismaClient } from '@prisma/client'
import { E2E_WEDDINGS, expect, test } from './support/planner-browser'

async function enableIvoryGuestFixture() {
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.update({
      where: { id: E2E_WEDDINGS.primary.id },
      data: {
        privacy: 'link_only',
        invitationCardStyle: 'ivory-floral-gold',
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

test('Gift / Contributions still opens the Couple Website when #registry is already in the address bar', async ({ plannerPage: page }) => {
  await enableIvoryGuestFixture()
  await page.context().clearCookies()
  await page.setViewportSize({ width: 390, height: 844 })

  const token = `${E2E_WEDDINGS.primary.slug}-rsvp-token`
  await page.goto(
    `/invite/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`,
  )
  await expect(page).toHaveURL(
    new RegExp(`/invite/${E2E_WEDDINGS.primary.slug}/open`),
  )

  const browserLink = page.getByRole('link', {
    name: /^(Open wedding invitation|Continue to invitation in browser)$/,
  })
  await expect(browserLink).toBeVisible()
  await browserLink.click()

  const experience = page.getByTestId('premium-invitation-experience')
  const card = experience.getByTestId('invitation-trifold')
  await expect(experience).toBeVisible()
  await expect(card).toHaveAttribute('data-artwork-ready', 'true', {
    timeout: 5_000,
  })

  // Reproduce the manual UAT failure precisely: the browser is already on the
  // token-free wedding URL with #registry, but Ivory is still the active view.
  await page.evaluate((slug) => {
    window.history.replaceState(
      window.history.state,
      '',
      `/w/${encodeURIComponent(slug)}#registry`,
    )
  }, E2E_WEDDINGS.primary.slug)
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}#registry$`),
  )
  await expect(experience).toBeVisible()

  await experience.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'open', {
    timeout: 4_000,
  })
  await experience.getByTestId('invitation-details-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'details')

  await experience.getByTestId('invitation-cta-registry').click()

  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}#registry$`),
  )
  expect(new URL(page.url()).search).toBe('')
  expect(page.url()).not.toContain(token)
  await expect(page.getByTestId('premium-invitation-experience')).toHaveCount(0)
  await expect(page.locator('main#main-content')).toBeVisible()
  await expect(page.locator('#registry')).toBeVisible()
  await expect(page.locator('#registry')).toBeInViewport()

  const guestSession = await page.request.get(
    `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
  )
  expect(guestSession.status()).toBe(200)
  expect(await guestSession.json()).toMatchObject({
    guest: {
      id: `${E2E_WEDDINGS.primary.id}-guest`,
      name: E2E_WEDDINGS.primary.seededGuest,
    },
  })
})
