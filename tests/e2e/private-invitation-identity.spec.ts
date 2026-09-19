import { PrismaClient } from '@prisma/client'
import {
  E2E_WEDDINGS,
  expect,
  test,
} from './support/planner-browser'

const GUEST_A_ID = `${E2E_WEDDINGS.primary.id}-guest`
const GUEST_A_TOKEN = `${E2E_WEDDINGS.primary.slug}-rsvp-token`
const INVITATION_COOKIE_NAMES = new Set([
  'wewed_pending_invitation',
  'wewed_wedding_guest',
  'wewed_wedding_shared_invitation',
])

type IdentityFixture = {
  guestBId: string
  guestBToken: string
  physicalInvitationCode: string
}

function identityFixtureForProject(projectName: string): IdentityFixture {
  const suffix = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default'
  let hash = 0
  for (const character of projectName) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  const physicalInvitationCode = `CARD${String(hash % 1_000_000).padStart(6, '0')}`

  return {
    guestBId: `${E2E_WEDDINGS.primary.id}-guest-b-${suffix}`,
    guestBToken: `${E2E_WEDDINGS.primary.slug}-rsvp-token-b-${suffix}`,
    physicalInvitationCode,
  }
}

async function prepareIdentityFixture(fixture: IdentityFixture) {
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.update({
      where: { id: E2E_WEDDINGS.primary.id },
      data: {
        privacy: 'link_only',
        invitationCardStyle: 'ivory-floral-gold',
      },
    })
    await prisma.guest.upsert({
      where: { id: fixture.guestBId },
      update: {
        name: 'Second Test Guest',
        email: `second.guest.${fixture.physicalInvitationCode.toLowerCase()}@example.test`,
        phone: null,
        role: 'guest',
        side: 'partner2',
        weddingId: E2E_WEDDINGS.primary.id,
      },
      create: {
        id: fixture.guestBId,
        name: 'Second Test Guest',
        email: `second.guest.${fixture.physicalInvitationCode.toLowerCase()}@example.test`,
        phone: null,
        role: 'guest',
        side: 'partner2',
        weddingId: E2E_WEDDINGS.primary.id,
      },
    })
    await prisma.rSVP.upsert({
      where: { id: `${fixture.guestBId}-rsvp` },
      update: {
        token: fixture.guestBToken,
        attending: false,
        plusOne: false,
        kidsAttending: false,
        kidsCount: 0,
        checkedIn: false,
        message: null,
        guestId: fixture.guestBId,
      },
      create: {
        id: `${fixture.guestBId}-rsvp`,
        token: fixture.guestBToken,
        attending: false,
        plusOne: false,
        kidsAttending: false,
        kidsCount: 0,
        checkedIn: false,
        guestId: fixture.guestBId,
      },
    })
    await prisma.qRDestination.upsert({
      where: { id: `print_${fixture.physicalInvitationCode}` },
      update: {
        label: 'Identity isolation physical invitation',
        url: `https://wewed.pro/w/${E2E_WEDDINGS.primary.slug}`,
        type: 'physical_invitation',
        weddingId: E2E_WEDDINGS.primary.id,
        isActive: true,
      },
      create: {
        id: `print_${fixture.physicalInvitationCode}`,
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

async function invitationCookieNames(
  page: import('@playwright/test').Page,
): Promise<Set<string>> {
  const cookies = await page.context().cookies()
  return new Set(
    cookies
      .map((cookie) => cookie.name)
      .filter((name) => INVITATION_COOKIE_NAMES.has(name)),
  )
}

test('same browser cannot carry Guest A identity into Guest B, stale RSVP, invalid invite, or physical QR', async ({ plannerPage: page }, testInfo) => {
  const fixture = identityFixtureForProject(testInfo.project.name)
  await prepareIdentityFixture(fixture)
  await page.context().clearCookies()

  await enterPrivateInvitation(page, GUEST_A_TOKEN)
  let current = await guestSession(page)
  expect(current.response.status()).toBe(200)
  expect(current.payload).toMatchObject({ guest: { id: GUEST_A_ID } })

  await enterPrivateInvitation(page, fixture.guestBToken)
  current = await guestSession(page)
  expect(current.response.status()).toBe(200)
  expect(current.payload).toMatchObject({
    guest: { id: fixture.guestBId, name: 'Second Test Guest' },
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
    guest: { id: fixture.guestBId },
    rsvp: { attending: false },
  })

  const currentForm = await page.request.put(
    `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
    {
      data: {
        originGuestId: fixture.guestBId,
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

  await enterPrivateInvitation(page, fixture.guestBToken)
  current = await guestSession(page)
  expect(current.payload).toMatchObject({ guest: { id: fixture.guestBId } })

  await page.goto(`/i/${fixture.physicalInvitationCode}`)
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

test('failed private, physical, and deferred transitions clear every invitation identity family', async ({ plannerPage: page }, testInfo) => {
  const fixture = identityFixtureForProject(`fail-closed-${testInfo.project.name}`)
  await prepareIdentityFixture(fixture)
  await page.context().clearCookies()

  await page.goto(`/i/${fixture.physicalInvitationCode}`)
  let cookies = await invitationCookieNames(page)
  expect(cookies.has('wewed_wedding_shared_invitation')).toBe(true)
  expect(cookies.has('wewed_wedding_guest')).toBe(false)

  await page.goto('/i/NOTAREALCARD')
  await expect(page).toHaveURL(/\/guest-access-help\?reason=invalid-invitation/)
  cookies = await invitationCookieNames(page)
  expect(cookies.size).toBe(0)

  await page.goto(`/i/${fixture.physicalInvitationCode}`)
  cookies = await invitationCookieNames(page)
  expect(cookies.has('wewed_wedding_shared_invitation')).toBe(true)

  await page.goto(
    `/invite/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent('invalid-personal-token')}`,
  )
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?accessError=invalid`),
  )
  cookies = await invitationCookieNames(page)
  expect(cookies.size).toBe(0)

  await page.goto(`/i/${fixture.physicalInvitationCode}`)
  cookies = await invitationCookieNames(page)
  expect(cookies.has('wewed_wedding_shared_invitation')).toBe(true)

  await page.goto('/invite/resume?h=not-a-valid-handoff-secret')
  await expect(page).toHaveURL(/\/guest-access-help\?reason=invitation-resume/)
  cookies = await invitationCookieNames(page)
  expect(cookies.size).toBe(0)
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
