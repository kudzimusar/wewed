import { PrismaClient } from '@prisma/client'
import type { Page } from '@playwright/test'
import { E2E_WEDDINGS, expect, test } from './support/planner-browser'

async function configureInvitation(childrenPolicy: 'welcome' | 'adults_only') {
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.update({
      where: { id: E2E_WEDDINGS.primary.id },
      data: {
        privacy: 'link_only',
        invitationCardStyle: 'ivory-floral-gold',
      },
    })
    await prisma.weddingContent.upsert({
      where: {
        weddingId_section_field: {
          weddingId: E2E_WEDDINGS.primary.id,
          section: 'rsvp',
          field: 'childrenPolicy',
        },
      },
      update: { value: childrenPolicy },
      create: {
        weddingId: E2E_WEDDINGS.primary.id,
        section: 'rsvp',
        field: 'childrenPolicy',
        value: childrenPolicy,
        order: 0,
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}

async function openIvory(page: Page) {
  const token = `${E2E_WEDDINGS.primary.slug}-rsvp-token`
  await page.goto(
    `/invite/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`,
  )
  await page.getByRole('link', {
    name: /^(Open wedding invitation|Continue to invitation in browser)$/,
  }).click()
  const experience = page.getByTestId('premium-invitation-experience')
  const card = experience.getByTestId('invitation-trifold')
  await expect(card).toHaveAttribute('data-artwork-ready', 'true', { timeout: 5_000 })
  await experience.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'open', { timeout: 4_000 })
  return { experience, card }
}

test('Ivory final UAT refinements keep guest copy clear, actions centered, save feedback visible, and gifts actionable', async ({ plannerPage: page }) => {
  await configureInvitation('welcome')
  await page.context().clearCookies()
  await page.setViewportSize({ width: 390, height: 844 })

  const { experience, card } = await openIvory(page)
  const cardBox = await card.boundingBox()
  expect(cardBox).not.toBeNull()

  const guestCopy = experience.getByTestId('invitation-guest-personalization')
  await expect(guestCopy).toBeVisible()
  const guestBox = await guestCopy.boundingBox()
  expect(guestBox).not.toBeNull()
  expect((guestBox!.y - cardBox!.y) / cardBox!.height).toBeLessThan(0.86)

  await experience.getByTestId('invitation-details-button').click()
  const footer = experience.getByTestId('invitation-footer-actions')
  await expect(footer).toBeVisible()
  await expect(footer.getByRole('button', { name: 'View invitation', exact: true })).toBeVisible()
  await expect(footer.getByRole('button', { name: 'Visit Couple Website', exact: true })).toBeVisible()
  const footerBox = await footer.boundingBox()
  expect(footerBox).not.toBeNull()
  expect(
    Math.abs(
      footerBox!.x + footerBox!.width / 2 - (cardBox!.x + cardBox!.width / 2),
    ),
  ).toBeLessThan(2)

  await experience.getByTestId('invitation-cta-rsvp').click()
  const dialog = page.getByTestId('premium-invitation-rsvp-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('premium-rsvp-adults-only-note')).toHaveCount(0)

  const saveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes(`/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`),
  )
  await dialog.getByRole('button', { name: 'Save RSVP', exact: true }).click()
  expect((await saveResponse).status()).toBe(200)
  await expect(dialog.getByTestId('premium-rsvp-save-status')).toContainText(
    'Your RSVP has been saved.',
  )
  await expect(dialog.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close RSVP', exact: true }).click()

  await experience.getByTestId('invitation-cta-registry').click()
  await expect(page).toHaveURL(new RegExp(`/w/${E2E_WEDDINGS.primary.slug}#registry$`))
  await expect(page.getByTestId('premium-invitation-experience')).toHaveCount(0)
  await expect(page.locator('#registry')).toBeVisible()
})

test('adults-only RSVP policy is polite, authoritative, and preserves historical child data', async ({ plannerPage: page }) => {
  const prisma = new PrismaClient()
  try {
    await configureInvitation('adults_only')
    await prisma.rSVP.update({
      where: { id: `${E2E_WEDDINGS.primary.id}-rsvp` },
      data: { kidsAttending: true, kidsCount: 2 },
    })

    await page.context().clearCookies()
    await page.setViewportSize({ width: 390, height: 844 })

    const { experience } = await openIvory(page)
    await experience.getByTestId('invitation-details-button').click()
    await experience.getByTestId('invitation-cta-rsvp').click()

    const dialog = page.getByTestId('premium-invitation-rsvp-dialog')
    await expect(dialog.getByTestId('premium-rsvp-adults-only-note')).toContainText(
      'With love, we kindly ask that this be an adults-only celebration.',
    )
    await expect(dialog.getByLabel('Children are attending', { exact: true })).toHaveCount(0)

    const guestSession = await page.request.get(
      `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
    )
    expect(guestSession.status()).toBe(200)
    const payload = await guestSession.json()
    expect(payload).toMatchObject({
      wedding: { childrenPolicy: 'adults_only' },
      rsvp: { kidsAttending: false, kidsCount: 2 },
    })

    const rejected = await page.request.put(
      `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
      {
        data: {
          originGuestId: payload.guest.id,
          attending: true,
          kidsAttending: true,
          kidsCount: 2,
        },
      },
    )
    expect(rejected.status()).toBe(400)
    expect(await rejected.json()).toMatchObject({
      success: false,
      code: 'CHILDREN_NOT_ALLOWED',
    })

    const staleCachedClient = await page.request.put(
      `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
      {
        data: {
          originGuestId: payload.guest.id,
          attending: true,
          kidsAttending: false,
          kidsCount: 2,
        },
      },
    )
    expect(staleCachedClient.status()).toBe(200)
    expect(await staleCachedClient.json()).toMatchObject({
      success: true,
      rsvp: { kidsAttending: false, kidsCount: 2 },
    })

    const afterCachedSave = await prisma.rSVP.findUnique({
      where: { id: `${E2E_WEDDINGS.primary.id}-rsvp` },
      select: { kidsAttending: true, kidsCount: true },
    })
    expect(afterCachedSave).toEqual({ kidsAttending: false, kidsCount: 2 })

    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes(`/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`),
    )
    await dialog.getByRole('button', { name: 'Save RSVP', exact: true }).click()
    expect((await saveResponse).status()).toBe(200)
    await expect(dialog.getByTestId('premium-rsvp-save-status')).toBeVisible()

    await configureInvitation('welcome')
    const restored = await page.request.get(
      `/api/weddings/${E2E_WEDDINGS.primary.slug}/guest-session`,
    )
    expect(restored.status()).toBe(200)
    expect(await restored.json()).toMatchObject({
      wedding: { childrenPolicy: 'welcome' },
      rsvp: { kidsAttending: false, kidsCount: 2 },
    })
  } finally {
    await configureInvitation('welcome').catch(() => undefined)
    await prisma.$disconnect()
  }
})