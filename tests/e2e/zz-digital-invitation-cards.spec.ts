import { createHmac } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { E2E_COUPLE } from './support/marketplace-fixture'
import { E2E_WEDDINGS } from './support/planner-fixture'
import {
  E2E_GUEST_INVITATION,
  resetUnifiedNavigationFixture,
} from './support/unified-navigation-fixture'

const SECRET = process.env.WEWED_SESSION_SECRET ?? ''
const SAMPLE_DIR = 'artifacts/invitation-card-samples'
const SAMPLE_MESSAGE =
  'Join us for a joyful ceremony, dinner and dancing as we begin our next chapter.'

function coupleToken() {
  const payload = {
    version: 2,
    userId: E2E_COUPLE.id,
    authUserId: E2E_COUPLE.authUserId,
    email: E2E_COUPLE.email,
    role: 'couple',
    coupleId: E2E_WEDDINGS.primary.coupleId,
    activeWeddingId: E2E_WEDDINGS.primary.id,
    expiresAt: Date.now() + 3_600_000,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${createHmac('sha256', SECRET).update(encoded).digest('base64url')}`
}

async function signInCouple(page: import('@playwright/test').Page) {
  await page.context().clearCookies()
  await page.context().addCookies([
    {
      name: 'wewed_admin_auth',
      value: coupleToken(),
      url: 'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

async function removeSampleOverlays(page: import('@playwright/test').Page) {
  await page.getByText('Available offline', { exact: true }).evaluateAll((nodes) => {
    for (const node of nodes) {
      const target =
        node.closest('[role="status"], [data-sonner-toast], [data-radix-portal]') ??
        node.parentElement
      target?.remove()
    }
  })
}

function runtimeErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`)
  })
  return errors
}

test('couples design, save, export and deliver guest-specific digital invitation cards', async ({ page }) => {
  mkdirSync(SAMPLE_DIR, { recursive: true })
  await resetUnifiedNavigationFixture()
  const errors = runtimeErrors(page)
  await signInCouple(page)

  await page.goto('/couple/invitations')
  await expect(page.getByRole('heading', { name: 'Private invitation access' })).toBeVisible()
  await page.getByLabel('Invitation message').fill(SAMPLE_MESSAGE)
  await page.getByLabel('RSVP deadline').fill('2027-05-20')

  for (const style of ['botanical', 'editorial', 'midnight'] as const) {
    const selector = page.getByTestId(`invitation-style-${style}`)
    await expect(selector).toBeVisible()
    await selector.click()
    await expect(selector).toHaveAttribute('aria-pressed', 'true')
    await removeSampleOverlays(page)
    await page.getByTestId(`digital-invitation-card-${style}`).screenshot({
      path: `${SAMPLE_DIR}/${style}.png`,
      animations: 'disabled',
    })
  }

  await page.getByTestId('invitation-style-editorial').click()
  await page.getByRole('button', { name: 'Save card design' }).click()
  await expect(page.getByText('Digital invitation design saved.')).toBeVisible()

  const invitations = await page.request.get('/api/planner/guests/invitations')
  expect(invitations.status()).toBe(200)
  const invitationPayload = await invitations.json()
  expect(invitationPayload.wedding).toMatchObject({
    invitationCardStyle: 'editorial',
    invitationCardMessage: SAMPLE_MESSAGE,
  })
  const guestInvitation = invitationPayload.data.find(
    (row: { id: string }) => row.id === E2E_GUEST_INVITATION.guestId,
  )
  expect(guestInvitation.invitationUrl).toContain('card=editorial')
  expect(guestInvitation.qrValue).toBe(guestInvitation.invitationUrl)
  expect(guestInvitation.shareMessage).toContain('private digital wedding card')
  expect(guestInvitation.shareMessage).toContain(guestInvitation.invitationUrl)

  const csv = await page.request.get('/api/planner/guests/invitations?format=csv')
  expect(csv.status()).toBe(200)
  const csvText = await csv.text()
  expect(csvText).toContain('Card Style,Digital Invitation URL,Share Message')
  expect(csvText).toContain('editorial')

  const reminder = await page.request.post('/api/planner/reminders', {
    data: {
      name: 'Digital invitation delivery',
      subject: 'Your invitation to {{wedding_title}}',
      body: 'Dear {{guest_name}}, open your card and RSVP: {{digital_invitation_url}}',
      audience: 'all',
      status: 'draft',
    },
  })
  expect(reminder.status()).toBe(201)
  const reminderPayload = await reminder.json()
  const delivery = await page.request.post('/api/planner/reminders/send', {
    data: { id: reminderPayload.data.id, dryRun: true },
  })
  expect(delivery.status()).toBe(200)
  const deliveryPayload = await delivery.json()
  const deliveredPreview = deliveryPayload.recipients.find(
    (row: { guestId: string }) => row.guestId === E2E_GUEST_INVITATION.guestId,
  )
  expect(deliveredPreview.invitationUrl).toContain(
    `/w/${E2E_WEDDINGS.primary.slug}?`,
  )
  expect(deliveredPreview.invitationUrl).toContain('card=editorial')
  expect(deliveredPreview.body).toContain(deliveredPreview.invitationUrl)
  expect(deliveredPreview.html).toContain('Open card &amp; RSVP')
  expect(deliveredPreview.html).toContain(deliveredPreview.invitationUrl.replaceAll('&', '&amp;'))

  await page.context().clearCookies()
  await page.goto(guestInvitation.invitationUrl)
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?invitation=1&card=editorial$`),
  )
  expect(page.url()).not.toContain(E2E_GUEST_INVITATION.token)
  const deliveredCard = page.getByTestId('digital-invitation-card-editorial')
  await expect(deliveredCard).toBeVisible()
  await expect(deliveredCard).toContainText(E2E_WEDDINGS.primary.title)
  await expect(deliveredCard).toContainText(E2E_WEDDINGS.primary.seededGuest)
  await expect(deliveredCard).toContainText('Primary Test Estate')
  await removeSampleOverlays(page)
  await deliveredCard.screenshot({
    path: `${SAMPLE_DIR}/delivered-editorial-guest-card.png`,
    animations: 'disabled',
  })

  await page.getByRole('button', { name: 'RSVP now' }).click()
  await expect(page.getByRole('heading', { name: `Reply for ${E2E_WEDDINGS.primary.seededGuest}` })).toBeVisible()
  await page.getByLabel('Regretfully decline').click()
  await page.getByLabel('Message to the couple').fill('Thank you for including me in your celebration.')
  await page.getByRole('button', { name: 'Save RSVP' }).click()
  await expect(page.getByText('Your RSVP has been saved.')).toBeVisible()

  const guestSession = await page.request.get(
    new URL(`/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`, page.url()).toString(),
  )
  expect(guestSession.status()).toBe(200)
  expect(await guestSession.json()).toMatchObject({
    wedding: { invitationCardStyle: 'editorial' },
    guest: { id: E2E_GUEST_INVITATION.guestId },
    rsvp: { attending: false },
  })
  expect(errors).toEqual([])
})

test('QR card and RSVP remain contained on mobile @mobile', async ({ page }) => {
  await resetUnifiedNavigationFixture()
  const errors = runtimeErrors(page)

  await page.goto(
    `/w/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(E2E_GUEST_INVITATION.token)}&card=midnight`,
  )
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?invitation=1&card=midnight$`),
  )
  await expect(page.getByTestId('digital-invitation-card-midnight')).toBeVisible()
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(overflow.width).toBeLessThanOrEqual(overflow.viewport + 1)
  await page.getByRole('button', { name: 'RSVP now' }).click()
  await expect(page.getByRole('heading', { name: /Reply for/ })).toBeVisible()
  expect(errors).toEqual([])
})
