import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()
const BASE_URL = process.env.WEWED_UAT_BASE_URL ?? 'http://127.0.0.1:3000'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

async function createFixture() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  const couple = await prisma.couple.create({
    data: {
      slug: `switch-couple-${suffix}`,
      partner1: 'Switch',
      partner2: 'Test',
    },
  })
  const wedding = await prisma.wedding.create({
    data: {
      slug: `switch-wedding-${suffix}`,
      title: 'Android Guest Switch Regression',
      date: new Date('2030-06-20T10:00:00.000Z'),
      venue: 'Wewed UAT Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      privacy: 'link_only',
      invitationCardStyle: 'ivory-floral-gold',
      coupleId: couple.id,
    },
  })
  const guestA = await prisma.guest.create({
    data: {
      name: 'UAT Guest A',
      email: `guest-a-${suffix}@example.test`,
      weddingId: wedding.id,
    },
  })
  const guestB = await prisma.guest.create({
    data: {
      name: 'UAT Guest B',
      email: `guest-b-${suffix}@example.test`,
      weddingId: wedding.id,
    },
  })
  const tokenA = `switch-a-${suffix}-${randomUUID().replaceAll('-', '')}`
  const tokenB = `switch-b-${suffix}-${randomUUID().replaceAll('-', '')}`
  await prisma.rSVP.createMany({
    data: [
      { id: `${guestA.id}-rsvp`, token: tokenA, guestId: guestA.id },
      { id: `${guestB.id}-rsvp`, token: tokenB, guestId: guestB.id },
    ],
  })

  return {
    coupleId: couple.id,
    weddingId: wedding.id,
    weddingSlug: wedding.slug,
    guestAId: guestA.id,
    guestBId: guestB.id,
    tokenA,
    tokenB,
  }
}

async function cleanupFixture(fixture) {
  if (!fixture) return
  await prisma.auditEvent.deleteMany({ where: { weddingId: fixture.weddingId } })
  await prisma.$executeRawUnsafe(
    'DELETE FROM private."InvitationInstallHandoff" WHERE "weddingId" = $1',
    fixture.weddingId,
  )
  await prisma.rSVP.deleteMany({
    where: { guestId: { in: [fixture.guestAId, fixture.guestBId] } },
  })
  await prisma.guest.deleteMany({
    where: { id: { in: [fixture.guestAId, fixture.guestBId] } },
  })
  await prisma.wedding.deleteMany({ where: { id: fixture.weddingId } })
  await prisma.couple.deleteMany({ where: { id: fixture.coupleId } })
}

async function androidContext(browser, { standalone = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: ANDROID_UA,
  })
  if (standalone) {
    await context.addInitScript(() => {
      const original = window.matchMedia.bind(window)
      window.matchMedia = (query) => {
        if (query === '(display-mode: standalone)') {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() { return false },
          }
        }
        return original(query)
      }
    })
  }
  return context
}

async function prepareHandoff(browser, weddingSlug, token, label) {
  const context = await androidContext(browser)
  const page = await context.newPage()
  await page.goto(
    `${BASE_URL}/invite/${encodeURIComponent(weddingSlug)}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`,
    { waitUntil: 'domcontentloaded' },
  )
  await expect(page).toHaveURL(`${BASE_URL}/invite/${encodeURIComponent(weddingSlug)}/open`)

  const response = await context.request.post(`${BASE_URL}/api/invitations/install-handoff`, {
    data: { source: label },
  })
  expect(response.status()).toBe(201)
  const payload = await response.json()
  expect(payload.appResumePath).toMatch(/^\/invite\/resume\?h=[A-Za-z0-9_-]{43}$/)
  await context.close()
  return payload.appResumePath
}

async function openIvoryForGuest(page, guestName) {
  const experience = page.getByTestId('premium-invitation-experience')
  await expect(experience).toBeVisible()
  await expect(experience).toHaveAttribute('data-invitation-style', 'ivory-floral-gold')
  await expect(page.getByRole('heading', { name: 'Find my RSVP' })).toHaveCount(0)
  await expect(page.getByText('Your private invitation', { exact: true })).toHaveCount(0)

  const card = experience.getByTestId('invitation-trifold')
  await expect(card).toHaveAttribute('data-artwork-ready', 'true', { timeout: 10_000 })
  await experience.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'open', { timeout: 5_000 })
  await expect(experience.getByTestId('invitation-guest-personalization')).toContainText(guestName)
  return { experience, card }
}

test('Android Guest B handoff replaces Guest A even while Guest A RSVP is open', async ({ browser }) => {
  const fixture = await createFixture()
  try {
    const handoffA = await prepareHandoff(
      browser,
      fixture.weddingSlug,
      fixture.tokenA,
      'guest-switch-regression-a',
    )

    const appContext = await androidContext(browser, { standalone: true })
    const appPage = await appContext.newPage()
    await appPage.goto(`${BASE_URL}${handoffA}`, { waitUntil: 'domcontentloaded' })

    const firstUrl = new URL(appPage.url())
    expect(firstUrl.pathname).toBe(`/w/${fixture.weddingSlug}`)
    expect(firstUrl.searchParams.get('source')).toBe('android-app')
    expect(firstUrl.searchParams.get('entry')).toMatch(/^[0-9a-f-]{36}$/i)
    expect(firstUrl.searchParams.has('h')).toBe(false)
    expect(firstUrl.searchParams.has('rsvp')).toBe(false)

    const first = await openIvoryForGuest(appPage, 'UAT Guest A')
    await first.experience.getByTestId('invitation-details-button').click()
    await expect(first.card).toHaveAttribute('data-invitation-view', 'details')
    await first.experience.getByTestId('invitation-cta-rsvp').click()
    const guestARsvp = appPage.getByTestId('premium-invitation-rsvp-dialog')
    await expect(guestARsvp).toBeVisible()
    await expect(guestARsvp.getByText('UAT Guest A', { exact: true })).toBeVisible()

    const handoffB = await prepareHandoff(
      browser,
      fixture.weddingSlug,
      fixture.tokenB,
      'guest-switch-regression-b',
    )
    await appPage.goto(`${BASE_URL}${handoffB}`, { waitUntil: 'domcontentloaded' })

    const secondUrl = new URL(appPage.url())
    expect(secondUrl.pathname).toBe(`/w/${fixture.weddingSlug}`)
    expect(secondUrl.searchParams.get('source')).toBe('android-app')
    expect(secondUrl.searchParams.get('entry')).toMatch(/^[0-9a-f-]{36}$/i)
    expect(secondUrl.searchParams.get('entry')).not.toBe(firstUrl.searchParams.get('entry'))
    expect(secondUrl.searchParams.has('h')).toBe(false)
    expect(secondUrl.searchParams.has('rsvp')).toBe(false)

    await expect(appPage.getByTestId('premium-invitation-rsvp-dialog')).toHaveCount(0)
    const second = await openIvoryForGuest(appPage, 'UAT Guest B')
    await second.experience.getByTestId('invitation-details-button').click()
    await expect(second.card).toHaveAttribute('data-invitation-view', 'details')
    await second.experience.getByTestId('invitation-cta-rsvp').click()
    const guestBRsvp = appPage.getByTestId('premium-invitation-rsvp-dialog')
    await expect(guestBRsvp).toBeVisible()
    await expect(guestBRsvp.getByText('UAT Guest B', { exact: true })).toBeVisible()

    const activeSession = await appContext.request.get(
      `${BASE_URL}/api/weddings/${encodeURIComponent(fixture.weddingSlug)}/guest-session`,
    )
    expect(activeSession.status()).toBe(200)
    expect(await activeSession.json()).toMatchObject({
      success: true,
      guest: { id: fixture.guestBId, name: 'UAT Guest B' },
    })

    const staleGuestA = await appContext.request.put(
      `${BASE_URL}/api/weddings/${encodeURIComponent(fixture.weddingSlug)}/guest-session`,
      {
        data: {
          originGuestId: fixture.guestAId,
          attending: true,
          message: 'Guest A stale form must never save after Guest B takes over.',
        },
      },
    )
    expect(staleGuestA.status()).toBe(409)
    expect(await staleGuestA.json()).toMatchObject({
      success: false,
      code: 'STALE_GUEST_CONTEXT',
    })

    await appContext.close()
  } finally {
    await cleanupFixture(fixture)
  }
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
