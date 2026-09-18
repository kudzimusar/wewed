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

async function androidContext(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: ANDROID_UA,
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'getInstalledRelatedApps', {
      configurable: true,
      value: async () => [{ platform: 'play', id: 'pro.wewed.app' }],
    })
  })
  return context
}

async function makeStandalone(page) {
  await page.addInitScript(() => {
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

function handoffFromIntent(intentUrl) {
  expect(intentUrl).toMatch(/^intent:\/\/invite\/resume#Intent;/)
  expect(intentUrl).toContain('scheme=wewed')
  expect(intentUrl).toContain('package=pro.wewed.app')
  expect(intentUrl).not.toContain('rsvp=')
  expect(intentUrl).not.toContain('guest=')
  expect(intentUrl).not.toContain('email=')

  const match = intentUrl.match(/(?:^|;)S\.wewed_handoff=([^;]+);/)
  expect(match).not.toBeNull()
  const handoff = decodeURIComponent(match[1])
  expect(handoff).toMatch(/^[A-Za-z0-9_-]{43}$/)
  return handoff
}

async function prepareFromActualGate(page, fixture, token, expectedPostCount) {
  await page.goto(
    `${BASE_URL}/invite/${encodeURIComponent(fixture.weddingSlug)}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`,
    { waitUntil: 'domcontentloaded' },
  )
  await expect(page).toHaveURL(
    `${BASE_URL}/invite/${encodeURIComponent(fixture.weddingSlug)}/open`,
  )

  const open = page.getByTestId('android-open-installed-wewed')
  await expect(open).toBeVisible()
  const href = await open.getAttribute('href')
  expect(href).toBeTruthy()

  // The final user click must already have the intent URL. No async fetch is
  // permitted between user activation and the Android external-app launch.
  await page.evaluate(() => {
    document
      .querySelector('[data-testid="android-open-installed-wewed"]')
      ?.addEventListener('click', (event) => event.preventDefault(), { once: true })
  })
  await open.click()
  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(
    `/invite/${fixture.weddingSlug}/open`,
  )

  expect(expectedPostCount()).toBeGreaterThan(0)
  return handoffFromIntent(href)
}

async function expectActiveGuest(context, fixture, expected) {
  const response = await context.request.get(
    `${BASE_URL}/api/weddings/${encodeURIComponent(fixture.weddingSlug)}/guest-session`,
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({
    success: true,
    guest: {
      id: expected.id,
      name: expected.name,
    },
  })
  console.log(`checkpoint=active_guest=${expected.label}`)
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

async function openRsvp(page, experience, card, guestName) {
  await experience.getByTestId('invitation-details-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'details')
  await experience.getByTestId('invitation-cta-rsvp').click()
  const dialog = page.getByTestId('premium-invitation-rsvp-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(guestName, { exact: true })).toBeVisible()
  return dialog
}

test('same Chrome profile switches A→B→A atomically with a pre-created Android intent', async ({ browser }) => {
  test.setTimeout(90_000)
  const fixture = await createFixture()
  const context = await androidContext(browser)
  let handoffPosts = 0

  try {
    const browserPage = await context.newPage()
    browserPage.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/invitations/install-handoff'
      ) {
        handoffPosts += 1
        console.log('checkpoint=handoff_created')
      }
    })

    const appPage = await context.newPage()
    await makeStandalone(appPage)

    const handoffA = await prepareFromActualGate(
      browserPage,
      fixture,
      fixture.tokenA,
      () => handoffPosts,
    )
    expect(handoffPosts).toBe(1)

    console.log('checkpoint=resume_requested guest=A')
    await appPage.goto(
      `${BASE_URL}/invite/resume?h=${encodeURIComponent(handoffA)}`,
      { waitUntil: 'domcontentloaded' },
    )
    console.log('checkpoint=handoff_redeemed guest=A')

    const firstUrl = new URL(appPage.url())
    expect(firstUrl.pathname).toBe(`/w/${fixture.weddingSlug}`)
    expect(firstUrl.searchParams.get('source')).toBe('android-app')
    expect(firstUrl.searchParams.get('entry')).toMatch(/^[0-9a-f-]{36}$/i)
    expect(firstUrl.searchParams.has('h')).toBe(false)
    expect(firstUrl.searchParams.has('rsvp')).toBe(false)

    const first = await openIvoryForGuest(appPage, 'UAT Guest A')
    await openRsvp(appPage, first.experience, first.card, 'UAT Guest A')
    await expectActiveGuest(context, fixture, {
      id: fixture.guestAId,
      name: 'UAT Guest A',
      label: 'A',
    })

    const handoffB = await prepareFromActualGate(
      browserPage,
      fixture,
      fixture.tokenB,
      () => handoffPosts,
    )
    expect(handoffPosts).toBe(2)

    // Merely opening B must not destroy the active A session. Replacement is
    // committed only after B successfully redeems its one-time handoff.
    await expectActiveGuest(context, fixture, {
      id: fixture.guestAId,
      name: 'UAT Guest A',
      label: 'A-before-B-resume',
    })

    console.log('checkpoint=resume_requested guest=B')
    await appPage.goto(
      `${BASE_URL}/invite/resume?h=${encodeURIComponent(handoffB)}`,
      { waitUntil: 'domcontentloaded' },
    )
    console.log('checkpoint=handoff_redeemed guest=B')

    await expect(appPage.getByTestId('premium-invitation-rsvp-dialog')).toHaveCount(0)
    const second = await openIvoryForGuest(appPage, 'UAT Guest B')
    await openRsvp(appPage, second.experience, second.card, 'UAT Guest B')
    await expectActiveGuest(context, fixture, {
      id: fixture.guestBId,
      name: 'UAT Guest B',
      label: 'B',
    })

    const staleGuestA = await context.request.put(
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

    // Replaying the already-consumed B handoff must be harmless. In particular
    // it must not clear the valid B session established by the first redemption.
    const duplicateB = await context.request.get(
      `${BASE_URL}/invite/resume?h=${encodeURIComponent(handoffB)}`,
      { maxRedirects: 0 },
    )
    expect(duplicateB.status()).toBe(303)
    await expectActiveGuest(context, fixture, {
      id: fixture.guestBId,
      name: 'UAT Guest B',
      label: 'B-after-duplicate-resume',
    })

    const handoffA2 = await prepareFromActualGate(
      browserPage,
      fixture,
      fixture.tokenA,
      () => handoffPosts,
    )
    expect(handoffPosts).toBe(3)

    await expectActiveGuest(context, fixture, {
      id: fixture.guestBId,
      name: 'UAT Guest B',
      label: 'B-before-A-resume',
    })

    console.log('checkpoint=resume_requested guest=A2')
    await appPage.goto(
      `${BASE_URL}/invite/resume?h=${encodeURIComponent(handoffA2)}`,
      { waitUntil: 'domcontentloaded' },
    )
    console.log('checkpoint=handoff_redeemed guest=A2')

    await expect(appPage.getByTestId('premium-invitation-rsvp-dialog')).toHaveCount(0)
    const third = await openIvoryForGuest(appPage, 'UAT Guest A')
    await openRsvp(appPage, third.experience, third.card, 'UAT Guest A')
    await expectActiveGuest(context, fixture, {
      id: fixture.guestAId,
      name: 'UAT Guest A',
      label: 'A-restored',
    })

    const staleGuestB = await context.request.put(
      `${BASE_URL}/api/weddings/${encodeURIComponent(fixture.weddingSlug)}/guest-session`,
      {
        data: {
          originGuestId: fixture.guestBId,
          attending: true,
          message: 'Guest B stale form must never save after Guest A takes over.',
        },
      },
    )
    expect(staleGuestB.status()).toBe(409)
    expect(await staleGuestB.json()).toMatchObject({
      success: false,
      code: 'STALE_GUEST_CONTEXT',
    })

    await context.close()
  } finally {
    await cleanupFixture(fixture)
  }
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
