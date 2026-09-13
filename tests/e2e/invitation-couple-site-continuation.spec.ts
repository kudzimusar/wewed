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

test('RSVP returns to the same Couple Site, My Wedding reopens Ivory, and re-entry welcomes the guest again', async ({ plannerPage: page }) => {
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
  await expect(page.getByTestId('invitation-countdown')).toBeVisible()
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
  const rsvpDialog = page.getByTestId('premium-invitation-rsvp-dialog')
  await expect(rsvpDialog).toBeVisible()
  await page.getByLabel('Joyfully accept', { exact: true }).check()
  await page
    .getByLabel('Message to the couple', { exact: true })
    .fill('My Wedding continuation verified.')
  await page.getByRole('button', { name: 'Save RSVP', exact: true }).click()
  await expect(page.getByText('Your RSVP has been saved.')).toBeVisible()
  await rsvpDialog.getByRole('button', { name: 'Close RSVP', exact: true }).click()
  await expect(rsvpDialog).toBeHidden()

  await page.getByRole('button', { name: 'Back to Wewed Couple Site' }).click()
  await expect(page).toHaveURL(new RegExp(`/w/${E2E_WEDDINGS.primary.slug}$`))

  const returnedUrl = new URL(page.url())
  expect(returnedUrl.pathname).toBe(`/w/${E2E_WEDDINGS.primary.slug}`)
  expect(returnedUrl.search).toBe('')
  expect(page.url()).not.toContain(token)
  await expect(page.getByTestId('premium-invitation-experience')).toHaveCount(0)
  await expect(page.locator('main#main-content')).toBeVisible()

  const myWedding = page.getByTestId('my-wedding-nav-cta')
  await expect(myWedding).toBeVisible()
  await expect(myWedding).toHaveText('My Wedding')
  await expect(myWedding).toHaveAttribute(
    'href',
    `/w/${E2E_WEDDINGS.primary.slug}?invitation=1&card=ivory-floral-gold`,
  )
  await myWedding.click()

  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?invitation=1&card=ivory-floral-gold$`),
  )
  await expect(page.getByTestId('premium-invitation-experience')).toBeVisible()
  await expect(page.getByTestId('premium-invitation-experience')).toHaveAttribute(
    'data-invitation-style',
    'ivory-floral-gold',
  )
  await expect(page.getByTestId('invitation-countdown')).toBeVisible()
  expect(page.url()).not.toContain(token)

  // A fresh wedding entry (reload/app relaunch/browser return) welcomes the same
  // authorized guest with the invitation again without restoring any raw token.
  await page.goto(`/w/${E2E_WEDDINGS.primary.slug}`)
  await expect(page.getByTestId('premium-invitation-experience')).toBeVisible()
  await expect(page.getByTestId('premium-invitation-experience')).toHaveAttribute(
    'data-invitation-style',
    'ivory-floral-gold',
  )
  await expect(page.getByTestId('invitation-countdown')).toBeVisible()
  expect(page.url()).not.toContain(token)

  const guestSession = await page.request.get(
    `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
  )
  expect(guestSession.status()).toBe(200)
  expect(await guestSession.json()).toMatchObject({
    wedding: {
      slug: E2E_WEDDINGS.primary.slug,
      invitationCardStyle: 'ivory-floral-gold',
    },
    guest: {
      id: `${E2E_WEDDINGS.primary.id}-guest`,
      name: E2E_WEDDINGS.primary.seededGuest,
    },
    rsvp: {
      attending: true,
      message: 'My Wedding continuation verified.',
    },
  })
})
