import { PrismaClient } from '@prisma/client'
import {
  E2E_WEDDINGS,
  expect,
  test,
} from './support/planner-browser'

const PRIMARY_GUEST_ID = `${E2E_WEDDINGS.primary.id}-guest`
const PRIMARY_TOKEN = `${E2E_WEDDINGS.primary.slug}-rsvp-token`
const SECONDARY_GUEST_ID = `${E2E_WEDDINGS.secondary.id}-guest`
const SECONDARY_TOKEN = `${E2E_WEDDINGS.secondary.slug}-rsvp-token`

async function prepareGuestWeddings() {
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.updateMany({
      where: {
        id: { in: [E2E_WEDDINGS.primary.id, E2E_WEDDINGS.secondary.id] },
      },
      data: {
        privacy: 'link_only',
        invitationCardStyle: 'ivory-floral-gold',
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

async function enterInvitation(
  page: import('@playwright/test').Page,
  wedding: (typeof E2E_WEDDINGS)[keyof typeof E2E_WEDDINGS],
  token: string,
) {
  await page.goto(
    `/invite/${wedding.slug}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`,
  )
  await expect(page).toHaveURL(new RegExp(`/invite/${wedding.slug}/open`))
  expect(page.url()).not.toContain(token)

  const browserLink = page.getByRole('link', {
    name: /^(Open wedding invitation|Continue to invitation in browser)$/,
  })
  await expect(browserLink).toBeVisible()
  await browserLink.click()
  await expect(page).toHaveURL(new RegExp(`/w/${wedding.slug}\\?`))
  expect(page.url()).not.toContain(token)
}

async function guestSession(
  page: import('@playwright/test').Page,
  slug: string,
) {
  const response = await page.request.get(`/api/weddings/${slug}/guest-session`)
  return { response, payload: await response.json() }
}

async function portfolio(page: import('@playwright/test').Page) {
  const response = await page.request.get('/api/guest-weddings')
  expect(response.status()).toBe(200)
  return response.json() as Promise<{
    activeWeddingId: string | null
    weddings: Array<{
      weddingId: string
      slug: string
      coupleNames: string
      date: string
      monogram: string | null
    }>
  }>
}

test('multi-wedding guest portfolio preserves isolation, cold launch, leave-one semantics, and product-role precedence', async ({ plannerPage: page }) => {
  await prepareGuestWeddings()

  const plannerCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'wewed_admin_auth',
  )
  expect(plannerCookie).toBeTruthy()
  await page.context().clearCookies()

  await enterInvitation(page, E2E_WEDDINGS.primary, PRIMARY_TOKEN)
  let current = await guestSession(page, E2E_WEDDINGS.primary.slug)
  expect(current.response.status()).toBe(200)
  expect(current.payload).toMatchObject({ guest: { id: PRIMARY_GUEST_ID } })

  await enterInvitation(page, E2E_WEDDINGS.secondary, SECONDARY_TOKEN)
  current = await guestSession(page, E2E_WEDDINGS.secondary.slug)
  expect(current.response.status()).toBe(200)
  expect(current.payload).toMatchObject({ guest: { id: SECONDARY_GUEST_ID } })

  let saved = await portfolio(page)
  expect(saved.activeWeddingId).toBe(E2E_WEDDINGS.secondary.id)
  expect(saved.weddings.map((item) => item.weddingId)).toEqual(
    expect.arrayContaining([E2E_WEDDINGS.primary.id, E2E_WEDDINGS.secondary.id]),
  )
  expect(JSON.stringify(saved)).not.toContain('rsvpToken')
  expect(JSON.stringify(saved)).not.toContain(PRIMARY_TOKEN)
  expect(JSON.stringify(saved)).not.toContain(SECONDARY_TOKEN)
  expect(JSON.stringify(saved)).not.toContain('guestName')

  await page.goto('/app?source=android-uat')
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.secondary.slug}\\?invitation=1`),
  )
  current = await guestSession(page, E2E_WEDDINGS.secondary.slug)
  expect(current.payload).toMatchObject({ guest: { id: SECONDARY_GUEST_ID } })

  const switchToPrimary = await page.request.post('/api/guest-weddings', {
    data: { weddingId: E2E_WEDDINGS.primary.id },
  })
  expect(switchToPrimary.status()).toBe(200)
  const primarySwitchPayload = await switchToPrimary.json() as { destination: string }
  expect(primarySwitchPayload.destination).toMatch(
    new RegExp(`^/w/${E2E_WEDDINGS.primary.slug}\\?invitation=1`),
  )
  expect(primarySwitchPayload.destination).not.toContain(PRIMARY_TOKEN)
  expect(primarySwitchPayload.destination).not.toContain('guest=')
  await page.goto(primarySwitchPayload.destination)

  current = await guestSession(page, E2E_WEDDINGS.primary.slug)
  expect(current.response.status()).toBe(200)
  expect(current.payload).toMatchObject({ guest: { id: PRIMARY_GUEST_ID } })

  const wrongWedding = await guestSession(page, E2E_WEDDINGS.secondary.slug)
  expect(wrongWedding.response.status()).toBe(401)
  expect(wrongWedding.payload).toMatchObject({
    success: false,
    authorized: false,
  })

  const switchToSecondary = await page.request.post('/api/guest-weddings', {
    data: { weddingId: E2E_WEDDINGS.secondary.id },
  })
  expect(switchToSecondary.status()).toBe(200)
  const secondarySwitchPayload = await switchToSecondary.json() as { destination: string }
  await page.goto(secondarySwitchPayload.destination)
  current = await guestSession(page, E2E_WEDDINGS.secondary.slug)
  expect(current.payload).toMatchObject({ guest: { id: SECONDARY_GUEST_ID } })

  const leaveSecondary = await page.request.delete(
    `/api/weddings/${E2E_WEDDINGS.secondary.slug}/guest-session`,
  )
  expect(leaveSecondary.status()).toBe(200)
  expect(await leaveSecondary.json()).toMatchObject({ success: true, next: '/app' })

  saved = await portfolio(page)
  expect(saved.activeWeddingId).toBe(E2E_WEDDINGS.primary.id)
  expect(saved.weddings.map((item) => item.weddingId)).toEqual([
    E2E_WEDDINGS.primary.id,
  ])

  await page.goto('/app?source=android-uat')
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?invitation=1`),
  )
  current = await guestSession(page, E2E_WEDDINGS.primary.slug)
  expect(current.payload).toMatchObject({ guest: { id: PRIMARY_GUEST_ID } })

  await page.context().addCookies([plannerCookie!])
  await page.goto('/app?source=android-uat')
  await expect(page).toHaveURL(/\/planner(?:\/|$)/)
})
