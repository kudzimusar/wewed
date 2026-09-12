import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()
const BASE_URL = process.env.WEWED_UAT_BASE_URL ?? 'http://127.0.0.1:3000'
const MOBILE_VIEWPORT = { width: 390, height: 844 }
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

const MOBILE_CLIENTS = [
  {
    name: 'WhatsApp-like Android Chromium',
    userAgent: `${ANDROID_UA} WhatsApp/2.26.17.76`,
  },
  {
    name: 'Facebook-like Android Chromium',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/530.0.0.0.0;]',
  },
  { name: 'Chrome Android', userAgent: ANDROID_UA },
]

const FIXTURES = new Set()

test.describe.configure({ mode: 'serial' })
test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' })

test.setTimeout(120_000)

async function createFixture(label, { physical = false } = {}) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  const couple = await prisma.couple.create({
    data: {
      slug: `uat-couple-${suffix}`,
      partner1: 'Mobile',
      partner2: 'Guest',
    },
  })
  const wedding = await prisma.wedding.create({
    data: {
      slug: `uat-wedding-${suffix}`,
      title: `${label} Deferred Invitation UAT`,
      date: new Date('2030-06-20T10:00:00.000Z'),
      venue: 'Wewed UAT Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      privacy: 'link_only',
      invitationCardStyle: 'ivory-floral-gold',
      coupleId: couple.id,
    },
  })
  const email = `guest-${suffix}@example.test`
  const guest = await prisma.guest.create({
    data: {
      name: `${label} Guest`,
      email,
      weddingId: wedding.id,
    },
  })
  const rsvpToken = `uat-${suffix}-${randomUUID().replaceAll('-', '')}`
  const rsvp = await prisma.rSVP.create({
    data: { token: rsvpToken, guestId: guest.id },
  })

  let physicalCode = null
  let destinationId = null
  if (physical) {
    physicalCode = `PX${suffix.slice(0, 8)}`.toUpperCase()
    destinationId = `print_${physicalCode}`
    await prisma.qRDestination.create({
      data: {
        id: destinationId,
        label: `${label} physical invitation`,
        url: `/w/${wedding.slug}`,
        type: 'physical_invitation',
        weddingId: wedding.id,
        isActive: true,
      },
    })
  }

  const fixture = {
    coupleId: couple.id,
    weddingId: wedding.id,
    weddingSlug: wedding.slug,
    weddingTitle: wedding.title,
    guestId: guest.id,
    guestName: guest.name,
    guestEmail: email,
    rsvpId: rsvp.id,
    rsvpToken,
    physicalCode,
    destinationId,
  }
  FIXTURES.add(fixture)
  return fixture
}

async function cleanupFixture(fixture) {
  if (!fixture || !FIXTURES.has(fixture)) return
  FIXTURES.delete(fixture)
  await prisma.auditEvent.deleteMany({ where: { weddingId: fixture.weddingId } })
  await prisma.$executeRawUnsafe(
    'DELETE FROM private."InvitationInstallHandoff" WHERE "weddingId" = $1',
    fixture.weddingId,
  )
  if (fixture.destinationId) {
    await prisma.qRDestination.deleteMany({ where: { id: fixture.destinationId } })
  }
  await prisma.rSVP.deleteMany({ where: { guestId: fixture.guestId } })
  await prisma.guest.deleteMany({ where: { id: fixture.guestId } })
  await prisma.wedding.deleteMany({ where: { id: fixture.weddingId } })
  await prisma.couple.deleteMany({ where: { id: fixture.coupleId } })
}

async function androidContext(browser, userAgent, { standalone = false, installed = false } = {}) {
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    userAgent,
    locale: 'en-ZW',
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
  if (installed) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'getInstalledRelatedApps', {
        configurable: true,
        value: async () => [{ platform: 'play', id: 'pro.wewed.app' }],
      })
    })
  }
  return context
}

function personalHandoffFromPlayUrl(playStoreUrl) {
  const playUrl = new URL(playStoreUrl)
  expect(playUrl.origin).toBe('https://play.google.com')
  expect(playUrl.pathname).toBe('/store/apps/details')
  expect(playUrl.searchParams.get('id')).toBe('pro.wewed.app')
  const referrer = playUrl.searchParams.get('referrer')
  expect(referrer).toBeTruthy()
  const params = new URLSearchParams(referrer)
  expect([...params.keys()]).toEqual(['handoff'])
  const handoff = params.get('handoff')
  expect(handoff).toMatch(/^[A-Za-z0-9_-]{43}$/)
  return handoff
}

function physicalHandoffFromPlayUrl(playStoreUrl) {
  const playUrl = new URL(playStoreUrl)
  expect(playUrl.origin).toBe('https://play.google.com')
  expect(playUrl.pathname).toBe('/store/apps/details')
  expect(playUrl.searchParams.get('id')).toBe('pro.wewed.app')
  const referrer = playUrl.searchParams.get('referrer')
  expect(referrer).toBeTruthy()
  const params = new URLSearchParams(referrer)
  expect([...params.keys()]).toEqual(['physical_handoff'])
  const handoff = params.get('physical_handoff')
  expect(handoff).toMatch(/^p1\.[A-Za-z0-9_-]{80,512}$/)
  return handoff
}

async function capturePlayNavigation(page, buttonName) {
  let playStoreUrl = null
  await page.route('https://play.google.com/**', async (route) => {
    playStoreUrl = route.request().url()
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Intercepted Google Play for Wewed UAT</title>',
    })
  })
  const button = page.getByRole('button', { name: buttonName })
  await expect(button).toBeVisible()
  await expect(button).toBeEnabled()
  const box = await button.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(48)
  expect(box?.width).toBeGreaterThanOrEqual(48)
  await button.click()
  await expect.poll(() => playStoreUrl, { timeout: 10_000 }).not.toBeNull()
  return playStoreUrl
}

async function expectIvoryRevealed(page) {
  const experience = page.getByTestId('premium-invitation-experience')
  await expect(experience).toBeVisible()
  await expect(experience).toHaveAttribute('data-invitation-style', 'ivory-floral-gold')
  const card = experience.getByTestId('invitation-trifold')
  await expect(card).toHaveAttribute('data-artwork-engine', 'approved-pixels')
  await expect(card).toHaveAttribute('data-artwork-ready', 'true', { timeout: 10_000 })
  return { experience, card }
}

async function openIvoryDetails(experience, card) {
  await experience.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'opening', { timeout: 1_000 })
  await expect(card).toHaveAttribute('data-invitation-view', 'open', { timeout: 5_000 })
  await experience.getByTestId('invitation-details-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'details')
}

test.afterEach(async () => {
  for (const fixture of [...FIXTURES]) await cleanupFixture(fixture)
})

test.afterAll(async () => { await prisma.$disconnect() })

for (const client of MOBILE_CLIENTS) {
  test(`${client.name}: personal invitation stays locked until Wewed resumes it`, async ({ browser }) => {
    const fixture = await createFixture(client.name)
    const context = await androidContext(browser, client.userAgent)
    const page = await context.newPage()
    const shareUrl = `${BASE_URL}/invite/${encodeURIComponent(fixture.weddingSlug)}?rsvp=${encodeURIComponent(fixture.rsvpToken)}&card=ivory-floral-gold`
    await page.goto(shareUrl, { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(`${BASE_URL}/invite/${encodeURIComponent(fixture.weddingSlug)}/open`)
    await expect(page.getByRole('heading', { name: 'Your invitation is waiting in Wewed' })).toBeVisible()
    await expect(page.getByTestId('premium-invitation-experience')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /continue to invitation in browser/i })).toHaveCount(0)
    expect(page.url()).not.toContain(fixture.rsvpToken)

    const playStoreUrl = await capturePlayNavigation(
      page,
      'Install Wewed & reveal my invitation',
    )
    const handoff = personalHandoffFromPlayUrl(playStoreUrl)
    expect(decodeURIComponent(playStoreUrl)).not.toContain(fixture.rsvpToken)
    expect(decodeURIComponent(playStoreUrl)).not.toContain(fixture.guestEmail)
    expect(decodeURIComponent(playStoreUrl)).not.toContain(fixture.weddingSlug)
    await context.close()

    const appContext = await androidContext(browser, client.userAgent, { standalone: true })
    const appPage = await appContext.newPage()
    await appPage.goto(`${BASE_URL}/invite/resume?h=${handoff}`, { waitUntil: 'domcontentloaded' })
    const finalUrl = new URL(appPage.url())
    expect(finalUrl.pathname).toBe(`/w/${fixture.weddingSlug}`)
    expect(finalUrl.searchParams.get('invitation')).toBe('1')
    expect(finalUrl.searchParams.get('card')).toBe('ivory-floral-gold')
    expect(finalUrl.searchParams.has('h')).toBe(false)
    expect(finalUrl.searchParams.has('rsvp')).toBe(false)
    await expectIvoryRevealed(appPage)
    await appContext.close()
  })
}

test('Chrome Android: installed Wewed is offered directly and Ivory remains hidden in browser', async ({ browser }) => {
  const fixture = await createFixture('Installed Wewed')
  const context = await androidContext(browser, ANDROID_UA, { installed: true })
  const page = await context.newPage()
  await page.goto(`${BASE_URL}/invite/${fixture.weddingSlug}?rsvp=${fixture.rsvpToken}&card=ivory-floral-gold`)
  await expect(page.getByRole('button', { name: 'Open invitation in Wewed' })).toBeVisible()
  await expect(page.getByTestId('premium-invitation-experience')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /install wewed/i })).toHaveCount(0)
  await context.close()
})

test('Chrome Android: printed QR installs Wewed, restores shared invitation, claims guest, RSVPs, and reaches same Couple Site', async ({ browser }) => {
  const fixture = await createFixture('Physical Android', { physical: true })

  const browserContext = await androidContext(browser, ANDROID_UA)
  const browserPage = await browserContext.newPage()
  await browserPage.goto(`${BASE_URL}/i/${fixture.physicalCode}`, { waitUntil: 'domcontentloaded' })

  await expect(browserPage.getByRole('heading', { name: 'Your invitation is waiting in Wewed' })).toBeVisible()
  await expect(browserPage.getByTestId('physical-invitation-android-gate')).toBeVisible()
  await expect(browserPage.getByTestId('premium-invitation-experience')).toHaveCount(0)
  await expect(browserPage.getByRole('heading', { name: 'Find my RSVP' })).toHaveCount(0)
  const browserCookies = await browserContext.cookies(BASE_URL)
  expect(browserCookies.some((cookie) => cookie.name === 'wewed_wedding_shared_invitation')).toBe(true)
  expect(browserCookies.some((cookie) => cookie.name === 'wewed_wedding_guest')).toBe(false)

  const playStoreUrl = await capturePlayNavigation(
    browserPage,
    'Install Wewed & reveal my invitation',
  )
  const physicalHandoff = physicalHandoffFromPlayUrl(playStoreUrl)
  const visiblePlayUrl = decodeURIComponent(playStoreUrl)
  expect(visiblePlayUrl).not.toContain(fixture.weddingId)
  expect(visiblePlayUrl).not.toContain(fixture.weddingSlug)
  expect(visiblePlayUrl).not.toContain(fixture.destinationId)
  expect(visiblePlayUrl).not.toContain(fixture.guestId)
  expect(visiblePlayUrl).not.toContain(fixture.guestEmail)
  expect(visiblePlayUrl).not.toContain(fixture.rsvpToken)
  await browserContext.close()

  const appContext = await androidContext(browser, ANDROID_UA, { standalone: true })
  const appPage = await appContext.newPage()
  await appPage.goto(`${BASE_URL}/invite/physical-resume?h=${encodeURIComponent(physicalHandoff)}`, {
    waitUntil: 'domcontentloaded',
  })

  const resumedUrl = new URL(appPage.url())
  expect(resumedUrl.pathname).toBe(`/w/${fixture.weddingSlug}`)
  expect(resumedUrl.searchParams.get('source')).toBe('printed-invitation')
  expect(resumedUrl.searchParams.get('card')).toBe('ivory-floral-gold')
  expect(resumedUrl.searchParams.has('h')).toBe(false)

  const cookiesBeforeClaim = await appContext.cookies(BASE_URL)
  expect(cookiesBeforeClaim.some((cookie) => cookie.name === 'wewed_wedding_shared_invitation')).toBe(true)
  expect(cookiesBeforeClaim.some((cookie) => cookie.name === 'wewed_wedding_guest')).toBe(false)

  const { experience, card } = await expectIvoryRevealed(appPage)
  await expect(appPage.getByRole('heading', { name: 'Find my RSVP' })).toBeVisible()
  await openIvoryDetails(experience, card)
  await experience.getByTestId('invitation-cta-rsvp').click()
  await appPage.getByLabel('Full name').fill(fixture.guestName)
  await appPage.getByLabel(/^Email or phone/).fill(fixture.guestEmail)

  const claimPath = `/api/weddings/${fixture.weddingSlug}/physical-invitation/claim`
  const claimResponsePromise = appPage.waitForResponse((response) => {
    try {
      return (
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === claimPath
      )
    } catch {
      return false
    }
  })
  await appPage.getByRole('button', { name: 'Continue to my digital invitation' }).click()
  const claimResponse = await claimResponsePromise
  expect(claimResponse.status()).toBe(200)
  const claimPayload = await claimResponse.json()
  expect(claimPayload.success).toBe(true)
  expect(typeof claimPayload.redirect).toBe('string')
  const claimRedirect = new URL(claimPayload.redirect, BASE_URL)
  expect(claimRedirect.pathname).toBe(`/w/${fixture.weddingSlug}`)
  expect(claimRedirect.searchParams.get('invitation')).toBe('1')
  expect(claimRedirect.searchParams.get('card')).toBe('ivory-floral-gold')
  expect(claimRedirect.searchParams.get('source')).toBe('printed-invitation')
  expect(claimRedirect.searchParams.has('rsvp')).toBe(false)
  expect(claimRedirect.searchParams.has('h')).toBe(false)

  await expect.poll(
    () => new URL(appPage.url()).searchParams.get('invitation'),
    { timeout: 10_000 },
  ).toBe('1')
  const claimedUrl = new URL(appPage.url())
  expect(claimedUrl.pathname).toBe(`/w/${fixture.weddingSlug}`)
  expect(claimedUrl.searchParams.get('card')).toBe('ivory-floral-gold')
  expect(claimedUrl.searchParams.get('source')).toBe('printed-invitation')
  const cookiesAfterClaim = await appContext.cookies(BASE_URL)
  expect(cookiesAfterClaim.some((cookie) => cookie.name === 'wewed_wedding_shared_invitation')).toBe(false)
  expect(cookiesAfterClaim.some((cookie) => cookie.name === 'wewed_wedding_guest')).toBe(true)

  const personal = await expectIvoryRevealed(appPage)
  await openIvoryDetails(personal.experience, personal.card)
  await personal.experience.getByTestId('invitation-cta-rsvp').click()
  await expect(appPage.getByTestId('premium-invitation-rsvp-dialog')).toBeVisible()
  await appPage.getByLabel('Joyfully accept', { exact: true }).check()
  await appPage.getByLabel('Message to the couple', { exact: true }).fill('Android install journey qualified.')
  await appPage.getByRole('button', { name: 'Save RSVP', exact: true }).click()
  await expect(appPage.getByText('Your RSVP has been saved.')).toBeVisible()

  const saved = await prisma.rSVP.findUnique({ where: { id: fixture.rsvpId } })
  expect(saved?.attending).toBe(true)
  expect(saved?.message).toBe('Android install journey qualified.')

  await appPage.getByRole('button', { name: 'Close', exact: true }).click()
  await appPage.getByRole('button', { name: 'Back to Wewed Couple Site', exact: true }).click()
  await expect(appPage).toHaveURL(`${BASE_URL}/w/${fixture.weddingSlug}`)
  await expect(appPage.getByTestId('premium-invitation-experience')).toHaveCount(0)

  const preservedSession = await appContext.request.get(
    `${BASE_URL}/api/weddings/${fixture.weddingSlug}/guest-session`,
  )
  expect(preservedSession.status()).toBe(200)
  const preservedPayload = await preservedSession.json()
  expect(preservedPayload.guest.name).toBe(fixture.guestName)
  expect(preservedPayload.rsvp.attending).toBe(true)
  await appContext.close()
})

test('Chrome Android: tampered physical handoff fails closed without revealing Ivory', async ({ browser }) => {
  const fixture = await createFixture('Physical tamper', { physical: true })
  const browserContext = await androidContext(browser, ANDROID_UA)
  const page = await browserContext.newPage()
  await page.goto(`${BASE_URL}/i/${fixture.physicalCode}`)
  const response = await browserContext.request.post(`${BASE_URL}/api/invitations/physical-install-handoff`)
  expect(response.status()).toBe(201)
  const payload = await response.json()
  const handoff = physicalHandoffFromPlayUrl(payload.playStoreUrl)
  await browserContext.close()

  const last = handoff.at(-1)
  const tampered = `${handoff.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`
  const appContext = await androidContext(browser, ANDROID_UA, { standalone: true })
  const appPage = await appContext.newPage()
  await appPage.goto(`${BASE_URL}/invite/physical-resume?h=${encodeURIComponent(tampered)}`)
  const finalUrl = new URL(appPage.url())
  expect(finalUrl.pathname).toBe('/guest-access-help')
  expect(finalUrl.searchParams.get('reason')).toBe('invitation-resume')
  await expect(appPage.getByTestId('premium-invitation-experience')).toHaveCount(0)
  const cookies = await appContext.cookies(BASE_URL)
  expect(cookies.some((cookie) => cookie.name === 'wewed_wedding_shared_invitation')).toBe(false)
  expect(cookies.some((cookie) => cookie.name === 'wewed_wedding_guest')).toBe(false)
  await appContext.close()
})
