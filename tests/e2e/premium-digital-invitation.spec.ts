import { PrismaClient } from '@prisma/client'
import {
  E2E_WEDDINGS,
  expect,
  expectNoDocumentOverflow,
  test,
} from './support/planner-browser'

const PHYSICAL_INVITATION_CODE = 'CARD100001'
const RSVP_DEADLINE = new Date('2027-03-01T12:00:00.000Z')

async function openInvitationInBrowser(page: import('@playwright/test').Page) {
  const browserLink = page.getByRole('link', {
    name: /^(Open wedding invitation|Continue to invitation in browser)$/,
  })
  await expect(browserLink).toBeVisible()
  await browserLink.click()
}

async function enablePersonalInvitationFixture() {
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.update({
      where: { id: E2E_WEDDINGS.primary.id },
      data: {
        privacy: 'link_only',
        invitationCardStyle: 'ivory-floral-gold',
        invitationCardMessage: 'Request the pleasure of your company as we celebrate our marriage.',
        rsvpDeadline: RSVP_DEADLINE,
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

async function enablePhysicalInvitationFixture() {
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.update({
      where: { id: E2E_WEDDINGS.primary.id },
      data: {
        privacy: 'link_only',
        invitationCardStyle: 'ivory-floral-gold',
      },
    })
    await prisma.qRDestination.create({
      data: {
        id: `print_${PHYSICAL_INVITATION_CODE}`,
        label: 'E2E physical invitation',
        url: `https://wewed.pro/w/${E2E_WEDDINGS.primary.slug}`,
        type: 'physical_invitation',
        weddingId: E2E_WEDDINGS.primary.id,
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

test('Planner Card Studio provides a compact premium library and one interactive preview', async ({ plannerPage: page }) => {
  const toolsDisclosure = page.locator('[data-planner-tools-disclosure]')
  await expect(toolsDisclosure).toBeVisible()
  await toolsDisclosure.click()
  await expect(toolsDisclosure).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Invitations & QR', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Invitations & secure QR' })).toBeVisible()

  const studioHeading = page.getByRole('heading', { name: 'Choose how your invitation comes to life' })
  await expect(studioHeading).toBeVisible()

  const themeButtons = page.locator('[data-testid^="invitation-style-"]')
  expect(await themeButtons.count()).toBeGreaterThanOrEqual(12)

  await page.getByTestId('invitation-style-ivory-floral-gold').click()
  const frame = page.getByTestId('invitation-preview-frame')
  await expect(frame).toHaveAttribute('data-preview-device', 'mobile')
  const experience = frame.getByTestId('premium-invitation-experience')
  await expect(experience).toHaveAttribute('data-invitation-style', 'ivory-floral-gold')
  await expect(experience.getByTestId('invitation-trifold')).toHaveAttribute('data-card-object', 'physical-stationery')
  await expect(experience.getByTestId('invitation-closed-cover')).toContainText('A special invitation awaits')
  expect(await experience.getByTestId('ivory-paper-grain').count()).toBeGreaterThan(0)
  await expect(experience.getByText('Our journey', { exact: true })).toHaveCount(0)
  await expect(experience.getByText('A brighter tomorrow', { exact: true })).toHaveCount(0)

  await experience.getByTestId('invitation-open-button').click()
  await expect(experience).toHaveAttribute('data-motion-state', 'open', { timeout: 4_000 })
  await expect(experience.getByTestId('invitation-panel-left')).toBeVisible()
  const centrePanel = experience.getByTestId('invitation-panel-centre')
  await expect(centrePanel).toBeVisible()
  await expect(centrePanel.getByText('Together with our families', { exact: true })).toBeVisible()
  await expect(experience.getByTestId('invitation-panel-right')).toBeVisible()

  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await expect(frame).toHaveAttribute('data-preview-device', 'desktop')
  await expectNoDocumentOverflow(page)
})

test('personal smart invitation reveals the exact guest without retaining the credential', async ({ plannerPage: page }) => {
  await enablePersonalInvitationFixture()
  await page.context().clearCookies()

  const token = `${E2E_WEDDINGS.primary.slug}-rsvp-token`
  await page.goto(`/invite/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`)
  await expect(page).toHaveURL(new RegExp(`/invite/${E2E_WEDDINGS.primary.slug}/open`))
  expect(page.url()).not.toContain(token)

  await openInvitationInBrowser(page)
  await expect(page).toHaveURL(new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?`))
  expect(page.url()).not.toContain(token)

  const experience = page.getByTestId('premium-invitation-experience')
  await expect(experience).toBeVisible()
  await expect(experience).toHaveAttribute('data-invitation-style', 'ivory-floral-gold')
  await expect(experience).toHaveAttribute('data-motion-state', 'closed')
  await expect(experience.getByTestId('invitation-closed-cover')).toContainText('A special invitation awaits')
  await expect(experience).toContainText('Aurora & Blake')
  await expect(experience).toContainText('Primary Test Estate')

  const guestSession = await page.request.get(`/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`)
  expect(guestSession.status()).toBe(200)
  const guestPayload = await guestSession.json()
  expect(guestPayload).toMatchObject({
    guest: { name: E2E_WEDDINGS.primary.seededGuest },
  })

  await expect(experience.getByTestId('invitation-rsvp-deadline')).toContainText('RSVP by')

  await experience.getByTestId('invitation-open-button').click()
  await expect(experience).toHaveAttribute('data-motion-state', 'open', { timeout: 4_000 })
  await expect(experience.getByTestId('invitation-panel-centre').getByText('Together with our families', { exact: true })).toBeVisible()
  const continueButton = experience.getByTestId('invitation-continue-button')
  await expect(continueButton).toBeFocused()
  await continueButton.click()
  await expect(page.locator('#wedding-details')).toBeInViewport()

  const invitationPalette = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    return {
      gold: styles.getPropertyValue('--color-gold').trim(),
      clay: styles.getPropertyValue('--color-clay').trim(),
      champagne: styles.getPropertyValue('--color-champagne').trim(),
    }
  })
  expect(invitationPalette).toEqual({
    gold: '#b3833f',
    clay: '#d6b77c',
    champagne: '#fbf5e9',
  })

  await page.locator('#rsvp').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Review my RSVP' }).click()
  await expect(page.getByTestId('premium-invitation-rsvp-dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your private RSVP' })).toBeVisible()
})

test('reduced-motion invitation opens from the keyboard without the 3D delay', async ({ plannerPage: page }) => {
  await enablePersonalInvitationFixture()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.context().clearCookies()

  const token = `${E2E_WEDDINGS.primary.slug}-rsvp-token`
  await page.goto(`/invite/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`)
  await openInvitationInBrowser(page)

  const experience = page.getByTestId('premium-invitation-experience')
  const openButton = experience.getByTestId('invitation-open-button')
  await openButton.focus()
  await expect(openButton).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(experience).toHaveAttribute('data-motion-state', 'open', { timeout: 500 })
  await expect(experience.getByTestId('invitation-continue-button')).toBeFocused()
  await expect(experience.getByText('Reduced motion preview · invitation opens without 3D movement')).toBeVisible()
})

test('physical invitation access remains shared and never becomes a personal guest session', async ({ plannerPage: page }) => {
  await enablePhysicalInvitationFixture()
  await page.context().clearCookies()

  await page.goto(`/i/${PHYSICAL_INVITATION_CODE}`)
  await expect(page).toHaveURL(new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?source=printed-invitation`))
  expect(new URL(page.url()).searchParams.has('rsvp')).toBe(false)
  await expect(page.getByTestId('premium-invitation-experience')).toHaveCount(0)

  const guestSession = await page.request.get(`/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`)
  expect(guestSession.status()).toBe(401)
  const guestPayload = await guestSession.json()
  expect(guestPayload).toMatchObject({
    success: false,
    authorized: false,
  })
})

test('premium invitation remains within a mobile viewport @mobile', async ({ plannerPage: page }) => {
  await enablePersonalInvitationFixture()
  await page.context().clearCookies()

  const token = `${E2E_WEDDINGS.primary.slug}-rsvp-token`
  await page.goto(`/invite/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`)
  await openInvitationInBrowser(page)

  const experience = page.getByTestId('premium-invitation-experience')
  await expect(experience).toBeVisible()
  await expectNoDocumentOverflow(page)
  await experience.getByTestId('invitation-open-button').click()
  await expect(experience).toHaveAttribute('data-motion-state', 'open', { timeout: 4_000 })
  await expectNoDocumentOverflow(page)
})
