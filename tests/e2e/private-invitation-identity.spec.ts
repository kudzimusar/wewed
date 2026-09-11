import { PrismaClient } from '@prisma/client'
import {
  E2E_WEDDINGS,
  expect,
  test,
} from './support/planner-browser'

const PHYSICAL_INVITATION_CODE = 'CARD100001'
const GUEST_A_ID = `${E2E_WEDDINGS.primary.id}-guest`
const GUEST_A_TOKEN = `${E2E_WEDDINGS.primary.slug}-rsvp-token`
const GUEST_B_ID = `${E2E_WEDDINGS.primary.id}-guest-b`
const GUEST_B_TOKEN = `${E2E_WEDDINGS.primary.slug}-rsvp-token-b`

async function prepareIdentityFixture() {
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.update({
      where: { id: E2E_WEDDINGS.primary.id },
      data: {
        privacy: 'link_only',
        invitationCardStyle: 'ivory-floral-gold',
      },
    })
    await prisma.guest.create({
      data: {
        id: GUEST_B_ID,
        name: 'Second Test Guest',
        email: 'second.guest@example.test',
        phone: '+263000001002',
        role: 'guest',
        side: 'partner2',
        weddingId: E2E_WEDDINGS.primary.id,
      },
    })
    await prisma.rSVP.create({
      data: {
        id: `${E2E_WEDDINGS.primary.id}-rsvp-b`,
        token: GUEST_B_TOKEN,
        attending: false,
        plusOne: false,
        kidsAttending: false,
        kidsCount: 0,
        checkedIn: false,
        guestId: GUEST_B_ID,
      },
    })
    await prisma.qRDestination.create({
      data: {
        id: `print_${PHYSICAL_INVITATION_CODE}`,
        label: 'Identity isolation physical invitation',
        url: `https://wewed.pro/w/${E2E_WEDDINGS.primary.slug}`,
        type: 'physical_invitation',
        weddingId: E2E_WEDDINGS.primary.id,
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

async function enterPrivateInvitation(
  page: import('@playwright/test').Page,
  token: string,
) {
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
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?`),
  )
  expect(page.url()).not.toContain(token)
}

async function guestSession(page: import('@playwright/test').Page) {
  const response = await page.request.get(
    `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
  )
  return { response, payload: await response.json() }
}

test('same browser cannot carry Guest A identity into Guest B, stale RSVP, invalid invite, or physical QR', async ({ plannerPage: page }) => {
  await prepareIdentityFixture()
  await page.context().clearCookies()

  await enterPrivateInvitation(page, GUEST_A_TOKEN)
  let current = await guestSession(page)
  expect(current.response.status()).toBe(200)
  expect(current.payload).toMatchObject({ guest: { id: GUEST_A_ID } })

  await enterPrivateInvitation(page, GUEST_B_TOKEN)
  current = await guestSession(page)
  expect(current.response.status()).toBe(200)
  expect(current.payload).toMatchObject({
    guest: { id: GUEST_B_ID, name: 'Second Test Guest' },
  })

  const staleForm = await page.request.put(
    `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
    {
      data: {
        originGuestId: GUEST_A_ID,
        attending: true,
        message: 'This stale Guest A form must not be saved.',
      },
    },
  )
  expect(staleForm.status()).toBe(409)
  expect(await staleForm.json()).toMatchObject({
    success: false,
    code: 'STALE_GUEST_CONTEXT',
  })

  current = await guestSession(page)
  expect(current.payload).toMatchObject({
    guest: { id: GUEST_B_ID },
    rsvp: { attending: false },
  })

  const currentForm = await page.request.put(
    `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
    {
      data: {
        originGuestId: GUEST_B_ID,
        attending: true,
        message: 'Fresh Guest B response.',
      },
    },
  )
  expect(currentForm.status()).toBe(200)
  expect(await currentForm.json()).toMatchObject({
    success: true,
    rsvp: { attending: true, message: 'Fresh Guest B response.' },
  })

  await page.goto(
    `/invite/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent('invalid-personal-token')}`,
  )
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?accessError=invalid`),
  )
  current = await guestSession(page)
  expect(current.response.status()).toBe(401)

  await enterPrivateInvitation(page, GUEST_B_TOKEN)
  current = await guestSession(page)
  expect(current.payload).toMatchObject({ guest: { id: GUEST_B_ID } })

  await page.goto(`/i/${PHYSICAL_INVITATION_CODE}`)
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?source=printed-invitation`),
  )
  current = await guestSession(page)
  expect(current.response.status()).toBe(401)
  expect(current.payload).toMatchObject({
    success: false,
    authorized: false,
  })
})

test('Ivory waits for approved artwork readiness before starting the 1.8 second opening', async ({ plannerPage: page }) => {
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

  await page.context().clearCookies()
  await page.route('**/invitation-art/ivory/*.webp', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.continue()
  })

  await page.goto(
    `/invite/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(GUEST_A_TOKEN)}&card=ivory-floral-gold`,
  )
  const browserLink = page.getByRole('link', {
    name: /^(Open wedding invitation|Continue to invitation in browser)$/,
  })
  await browserLink.click()

  const experience = page.getByTestId('premium-invitation-experience')
  const card = experience.getByTestId('invitation-trifold')
  await expect(card).toHaveAttribute('data-artwork-ready', 'false')
  await expect(card.locator('.ivory-object')).toHaveCSS('opacity', '0')
  await expect(card).toHaveAttribute('data-invitation-view', 'closed')

  await expect(card).toHaveAttribute('data-artwork-ready', 'true', { timeout: 5_000 })
  await expect(card.locator('.ivory-object')).toHaveCSS('opacity', '1')
  await experience.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'opening', { timeout: 800 })
  await expect(card).toHaveAttribute('data-invitation-view', 'open', { timeout: 3_000 })
})
