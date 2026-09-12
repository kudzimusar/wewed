import { PrismaClient } from '@prisma/client'
import { E2E_WEDDINGS, expect, test } from './support/planner-browser'

async function enablePersonalInvitationFixture() {
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

test('RSVP returns to the same token-free Couple Site with guest identity intact', async ({ plannerPage: page }) => {
  await enablePersonalInvitationFixture()
  await page.context().clearCookies()

  const token = `${E2E_WEDDINGS.primary.slug}-rsvp-token`
  await page.goto(
    `/invite/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`,
  )
  await expect(page).toHaveURL(
    new RegExp(`/invite/${E2E_WEDDINGS.primary.slug}/open`),
  )
  expect(page.url()).not.toContain(token)

  const browserLink = page.getByRole('link', {
    name: /^(Open wedding invitation|Continue to invitation in browser)$/,
  })
  await expect(browserLink).toBeVisible()
  await browserLink.click()

  const experience = page.getByTestId('premium-invitation-experience')
  const card = experience.getByTestId('invitation-trifold')
  await expect(experience).toHaveAttribute(
    'data-invitation-style',
    'ivory-floral-gold',
  )
  await expect(card).toHaveAttribute('data-artwork-ready', 'true', {
    timeout: 5_000,
  })
  await experience.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'open', {
    timeout: 4_000,
  })
  await experience.getByTestId('invitation-details-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'details')

  await experience.getByTestId('invitation-cta-rsvp').click()
  await expect(page.getByTestId('premium-invitation-rsvp-dialog')).toBeVisible()
  await page.getByLabel('Joyfully accept', { exact: true }).check()
  await page
    .getByLabel('Message to the couple', { exact: true })
    .fill('Same-wedding Couple Site continuation verified.')
  await page.getByRole('button', { name: 'Save RSVP', exact: true }).click()
  await expect(page.getByText('Your RSVP has been saved.')).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByTestId('premium-invitation-rsvp-dialog')).toBeHidden()

  await page.getByRole('button', { name: 'Back to Wewed Couple Site' }).click()
  await expect(page).toHaveURL(new RegExp(`/w/${E2E_WEDDINGS.primary.slug}$`))

  const returnedUrl = new URL(page.url())
  expect(returnedUrl.pathname).toBe(`/w/${E2E_WEDDINGS.primary.slug}`)
  expect(returnedUrl.search).toBe('')
  expect(page.url()).not.toContain(token)
  await expect(page.getByTestId('premium-invitation-experience')).toHaveCount(0)
  await expect(page.locator('main#main-content')).toBeVisible()

  const guestSession = await page.request.get(
    `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
  )
  expect(guestSession.status()).toBe(200)
  expect(await guestSession.json()).toMatchObject({
    guest: {
      id: `${E2E_WEDDINGS.primary.id}-guest`,
      name: E2E_WEDDINGS.primary.seededGuest,
    },
    rsvp: {
      attending: true,
      message: 'Same-wedding Couple Site continuation verified.',
    },
  })
})
