import { PrismaClient } from '@prisma/client'
import {
  E2E_WEDDINGS,
  expect,
  test,
} from './support/planner-browser'

const PHYSICAL_INVITATION_CODE = 'CARD200002'

async function enablePhysicalClaimFixture() {
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.update({
      where: { id: E2E_WEDDINGS.primary.id },
      data: {
        privacy: 'link_only',
        invitationCardStyle: 'ivory-floral-gold',
      },
    })
    await prisma.qRDestination.upsert({
      where: { id: `print_${PHYSICAL_INVITATION_CODE}` },
      update: {
        label: 'Physical claim browser test',
        url: `https://wewed.pro/w/${E2E_WEDDINGS.primary.slug}`,
        type: 'physical_invitation',
        weddingId: E2E_WEDDINGS.primary.id,
        isActive: true,
      },
      create: {
        id: `print_${PHYSICAL_INVITATION_CODE}`,
        label: 'Physical claim browser test',
        url: `https://wewed.pro/w/${E2E_WEDDINGS.primary.slug}`,
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

test('printed invitation must claim a guest before RSVP, then continues through the personal digital invitation', async ({ plannerPage: page }) => {
  await enablePhysicalClaimFixture()
  await page.context().clearCookies()

  await page.goto(`/i/${PHYSICAL_INVITATION_CODE}`)
  await expect(page).toHaveURL(
    new RegExp(`/w/${E2E_WEDDINGS.primary.slug}\\?source=printed-invitation`),
  )
  await expect(page.getByTestId('physical-invitation-claim')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Find my RSVP' })).toBeVisible()
  await expect(page.getByTestId('premium-invitation-experience')).toHaveCount(0)

  let current = await guestSession(page)
  expect(current.response.status()).toBe(401)
  expect(current.payload).toMatchObject({ success: false, authorized: false })

  const anonymousRsvp = await page.request.post('/api/rsvp', {
    data: { slug: E2E_WEDDINGS.primary.slug, attendance: 'accept' },
  })
  expect(anonymousRsvp.status()).toBe(403)
  expect(await anonymousRsvp.json()).toMatchObject({
    success: false,
    code: 'guest_invitation_required',
  })

  await page.getByLabel('Full name').fill(E2E_WEDDINGS.primary.seededGuest)
  await page.getByLabel('Email or phone').fill('wrong-contact@example.test')
  await page.getByRole('button', { name: 'Continue to my digital invitation' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'We could not match those details to this invitation.',
  )
  current = await guestSession(page)
  expect(current.response.status()).toBe(401)

  await page.getByLabel('Email or phone').fill('primary.guest@example.test')
  await page.getByRole('button', { name: 'Continue to my digital invitation' }).click()
  await expect(page).toHaveURL(
    new RegExp(
      `/w/${E2E_WEDDINGS.primary.slug}\\?.*invitation=1.*source=printed-invitation`,
    ),
  )
  expect(page.url()).not.toContain(`${E2E_WEDDINGS.primary.slug}-rsvp-token`)

  const experience = page.getByTestId('premium-invitation-experience')
  const card = experience.getByTestId('invitation-trifold')
  await expect(experience).toBeVisible()
  await expect(experience).toHaveAttribute(
    'data-invitation-style',
    'ivory-floral-gold',
  )

  current = await guestSession(page)
  expect(current.response.status()).toBe(200)
  expect(current.payload).toMatchObject({
    guest: {
      id: `${E2E_WEDDINGS.primary.id}-guest`,
      name: E2E_WEDDINGS.primary.seededGuest,
    },
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
    .fill('Claimed from the printed invitation and saved securely.')
  await page.getByRole('button', { name: 'Save RSVP', exact: true }).click()
  await expect(page.getByText('Your RSVP has been saved.')).toBeVisible()

  current = await guestSession(page)
  expect(current.payload).toMatchObject({
    guest: { name: E2E_WEDDINGS.primary.seededGuest },
    rsvp: {
      attending: true,
      message: 'Claimed from the printed invitation and saved securely.',
    },
  })

  await page.goto(`/i/${PHYSICAL_INVITATION_CODE}`)
  await expect(page.getByTestId('physical-invitation-claim')).toBeVisible()
  current = await guestSession(page)
  expect(current.response.status()).toBe(401)
  expect(current.payload).toMatchObject({ success: false, authorized: false })
})
