import { PrismaClient } from '@prisma/client'
import {
  E2E_WEDDINGS,
  expect,
  test,
} from './support/planner-browser'

const PHYSICAL_INVITATION_CODE = 'CARD200003'
const IVORY_STYLE = 'ivory-floral-gold'

async function enablePhysicalCoupleSiteFixture() {
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.update({
      where: { id: E2E_WEDDINGS.primary.id },
      data: {
        privacy: 'link_only',
        invitationCardStyle: IVORY_STYLE,
      },
    })
    await prisma.qRDestination.upsert({
      where: { id: `print_${PHYSICAL_INVITATION_CODE}` },
      update: {
        label: 'Physical Couple Site round-trip test',
        url: `https://wewed.pro/w/${E2E_WEDDINGS.primary.slug}?card=${IVORY_STYLE}`,
        type: 'physical_invitation',
        weddingId: E2E_WEDDINGS.primary.id,
        isActive: true,
      },
      create: {
        id: `print_${PHYSICAL_INVITATION_CODE}`,
        label: 'Physical Couple Site round-trip test',
        url: `https://wewed.pro/w/${E2E_WEDDINGS.primary.slug}?card=${IVORY_STYLE}`,
        type: 'physical_invitation',
        weddingId: E2E_WEDDINGS.primary.id,
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

async function guestSession(page: import('@playwright/test').Page) {
  const response = await page.request.get(
    `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
  )
  return { response, payload: await response.json() }
}

test('physical invitation can reach Couple Site before RSVP claim and My Wedding returns to Ivory', async ({ plannerPage: page }) => {
  await enablePhysicalCoupleSiteFixture()
  await page.context().clearCookies()

  await page.goto(`/i/${PHYSICAL_INVITATION_CODE}`)
  await expect(page.getByTestId('physical-invitation-claim')).toBeVisible()

  const experience = page.getByTestId('premium-invitation-experience')
  const card = experience.getByTestId('invitation-trifold')
  await expect(experience).toHaveAttribute('data-invitation-style', IVORY_STYLE)
  await expect(card).toHaveAttribute('data-artwork-ready', 'true', { timeout: 5_000 })

  await experience.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'open', {
    timeout: 4_000,
  })
  await experience.getByTestId('invitation-details-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'details')

  await page.getByRole('button', { name: 'Back to Wewed Couple Site' }).click()

  await expect(page.getByTestId('physical-invitation-claim')).toHaveCount(0)
  await expect(page.locator('#main-content')).toBeVisible()
  const myWedding = page.getByTestId('my-wedding-nav-cta')
  await expect(myWedding).toBeVisible({ timeout: 5_000 })
  await expect(myWedding).toHaveAttribute(
    'href',
    `/w/${E2E_WEDDINGS.primary.slug}`,
  )
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}$`),
  )

  // Couple Site access from a printed card remains anonymous/read-only. It must
  // not manufacture a guest RSVP identity just because the site is visible.
  const anonymous = await guestSession(page)
  expect(anonymous.response.status()).toBe(401)
  expect(anonymous.payload).toMatchObject({ success: false, authorized: false })

  const shared = await page.request.get(
    `/api/weddings/${E2E_WEDDINGS.primary.slug}/shared-invitation-session`,
  )
  expect(shared.status()).toBe(200)
  expect(await shared.json()).toMatchObject({ success: true, authorized: true })

  await myWedding.click()
  await expect(page.getByTestId('physical-invitation-claim')).toBeVisible()
  await expect(page.getByTestId('premium-invitation-experience')).toHaveAttribute(
    'data-invitation-style',
    IVORY_STYLE,
  )

  const stillAnonymous = await guestSession(page)
  expect(stillAnonymous.response.status()).toBe(401)
  expect(stillAnonymous.payload).toMatchObject({ success: false, authorized: false })
})
