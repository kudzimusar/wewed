import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()
const BASE_URL = process.env.WEWED_UAT_BASE_URL ?? 'http://127.0.0.1:3000'
const MOBILE_VIEWPORT = { width: 390, height: 844 }

const MOBILE_CLIENTS = [
  {
    name: 'WhatsApp-like Android Chromium',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 WhatsApp/2.26.17.76',
  },
  {
    name: 'Facebook-like Android Chromium',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/530.0.0.0.0;]',
  },
  {
    name: 'Chrome Android',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  },
]

const FIXTURES = new Set()

test.describe.configure({ mode: 'serial' })
test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' })

async function createFixture(label) {
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
      coupleId: couple.id,
    },
  })
  const guest = await prisma.guest.create({
    data: {
      name: `${label} Guest`,
      weddingId: wedding.id,
    },
  })
  const rsvpToken = `uat-${suffix}-${randomUUID().replaceAll('-', '')}`
  const rsvp = await prisma.rSVP.create({
    data: {
      token: rsvpToken,
      guestId: guest.id,
    },
  })

  const fixture = {
    coupleId: couple.id,
    weddingId: wedding.id,
    weddingSlug: wedding.slug,
    weddingTitle: wedding.title,
    guestId: guest.id,
    rsvpId: rsvp.id,
    rsvpToken,
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
  await prisma.rSVP.deleteMany({ where: { guestId: fixture.guestId } })
  await prisma.guest.deleteMany({ where: { id: fixture.guestId } })
  await prisma.wedding.deleteMany({ where: { id: fixture.weddingId } })
  await prisma.couple.deleteMany({ where: { id: fixture.coupleId } })
}

async function openInvitation(browser, fixture, userAgent, options = {}) {
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    userAgent,
    locale: 'en-ZW',
  })

  if (options.simulateInstalledApp) {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'getInstalledRelatedApps', {
        configurable: true,
        value: async () => [{ platform: 'play', id: 'pro.wewed.app' }],
      })
    })
  }

  const page = await context.newPage()
  const shareUrl = `${BASE_URL}/invite/${encodeURIComponent(fixture.weddingSlug)}?rsvp=${encodeURIComponent(fixture.rsvpToken)}&card=botanical`
  await page.goto(shareUrl, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(
    `${BASE_URL}/invite/${encodeURIComponent(fixture.weddingSlug)}/open`,
  )
  await expect(
    page.getByRole('heading', { name: 'Your invitation is ready' }),
  ).toBeVisible()
  expect(page.url()).not.toContain(fixture.rsvpToken)
  expect(page.url()).not.toContain('rsvp=')

  return { context, page, shareUrl }
}

function handoffFromPlayUrl(playStoreUrl) {
  const playUrl = new URL(playStoreUrl)
  expect(playUrl.origin).toBe('https://play.google.com')
  expect(playUrl.pathname).toBe('/store/apps/details')
  expect(playUrl.searchParams.get('id')).toBe('pro.wewed.app')
  expect([...playUrl.searchParams.keys()].sort()).toEqual(['id', 'referrer'])

  const referrer = playUrl.searchParams.get('referrer')
  expect(referrer).toBeTruthy()
  const referrerParams = new URLSearchParams(referrer)
  expect([...referrerParams.keys()]).toEqual(['handoff'])
  const handoff = referrerParams.get('handoff')
  expect(handoff).toMatch(/^[A-Za-z0-9_-]{43}$/)
  return handoff
}

function handoffFromResumePath(appResumePath) {
  const resume = new URL(appResumePath, 'https://wewed.pro')
  expect(resume.origin).toBe('https://wewed.pro')
  expect(resume.pathname).toBe('/invite/resume')
  expect([...resume.searchParams.keys()]).toEqual(['h'])
  const handoff = resume.searchParams.get('h')
  expect(handoff).toMatch(/^[A-Za-z0-9_-]{43}$/)
  return handoff
}

function createGate() {
  let release
  const promise = new Promise((resolve) => {
    release = resolve
  })
  return { promise, release }
}

async function requestHandoff(context, source) {
  const response = await context.request.post(
    `${BASE_URL}/api/invitations/install-handoff`,
    { data: { source } },
  )
  expect(response.status()).toBe(201)
  const payload = await response.json()
  expect(payload.playStoreUrl).toEqual(expect.any(String))
  expect(payload.appResumePath).toEqual(expect.any(String))
  expect(payload.expiresAt).toEqual(expect.any(String))
  const playHandoff = handoffFromPlayUrl(payload.playStoreUrl)
  const resumeHandoff = handoffFromResumePath(payload.appResumePath)
  expect(resumeHandoff).toBe(playHandoff)
  return { ...payload, handoff: playHandoff }
}

async function assertResumeToExactInvitation(browser, fixture, userAgent, handoff) {
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    userAgent,
    locale: 'en-ZW',
  })
  const page = await context.newPage()
  const resumeUrl = `${BASE_URL}/invite/resume?h=${handoff}`

  const resumeResponsePromise = page.waitForResponse((response) => {
    try {
      return new URL(response.url()).pathname === '/invite/resume'
    } catch {
      return false
    }
  })

  await page.goto(resumeUrl, { waitUntil: 'domcontentloaded' })
  const resumeResponse = await resumeResponsePromise
  expect(resumeResponse.status()).toBe(303)
  const headers = await resumeResponse.allHeaders()
  expect(headers['cache-control']).toContain('no-store')
  expect(headers.pragma).toBe('no-cache')
  expect(headers['referrer-policy']).toBe('no-referrer')
  expect(headers['x-robots-tag']).toContain('noindex')

  const finalUrl = new URL(page.url())
  expect(finalUrl.pathname).toBe(`/w/${fixture.weddingSlug}`)
  expect(finalUrl.searchParams.get('invitation')).toBe('1')
  expect(finalUrl.searchParams.get('card')).toBe('botanical')
  expect(finalUrl.searchParams.has('h')).toBe(false)
  expect(finalUrl.searchParams.has('rsvp')).toBe(false)
  expect(page.url()).not.toContain(handoff)
  expect(page.url()).not.toContain(fixture.rsvpToken)

  const cookies = await context.cookies(BASE_URL)
  const guestSession = cookies.find(
    (cookie) => cookie.name === 'wewed_wedding_guest',
  )
  expect(guestSession).toBeTruthy()
  expect(guestSession.httpOnly).toBe(true)
  expect(guestSession.sameSite).toBe('Lax')
  expect(
    cookies.some((cookie) => cookie.name === 'wewed_pending_invitation'),
  ).toBe(false)

  return { context, page }
}

async function expectSafeRecovery(browser, userAgent, handoff) {
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    userAgent,
    locale: 'en-ZW',
  })
  const page = await context.newPage()
  await page.goto(`${BASE_URL}/invite/resume?h=${handoff}`, {
    waitUntil: 'domcontentloaded',
  })

  const finalUrl = new URL(page.url())
  expect(finalUrl.pathname).toBe('/guest-access-help')
  expect(finalUrl.searchParams.get('reason')).toBe('invitation-resume')
  expect(page.url()).not.toContain(handoff)

  const cookies = await context.cookies(BASE_URL)
  expect(
    cookies.some((cookie) => cookie.name === 'wewed_wedding_guest'),
  ).toBe(false)
  await context.close()
}

test.afterEach(async () => {
  for (const fixture of [...FIXTURES]) {
    await cleanupFixture(fixture)
  }
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

for (const client of MOBILE_CLIENTS) {
  test(`${client.name}: fresh install resumes the exact invitation without shared cookies`, async ({
    browser,
    request,
  }) => {
    const fixture = await createFixture(client.name)
    const shareUrl = `${BASE_URL}/invite/${encodeURIComponent(fixture.weddingSlug)}?rsvp=${encodeURIComponent(fixture.rsvpToken)}&card=botanical`

    const entryResponse = await request.get(shareUrl, { maxRedirects: 0 })
    expect(entryResponse.status()).toBe(303)
    const entryHeaders = entryResponse.headers()
    expect(entryHeaders.location).toBe(
      `/invite/${encodeURIComponent(fixture.weddingSlug)}/open`,
    )
    expect(entryHeaders.location).not.toContain(fixture.rsvpToken)
    expect(entryHeaders['cache-control']).toContain('no-store')
    expect(entryHeaders.pragma).toBe('no-cache')
    expect(entryHeaders['referrer-policy']).toBe('no-referrer')
    expect(entryHeaders['x-robots-tag']).toContain('noindex')

    const { context, page } = await openInvitation(
      browser,
      fixture,
      client.userAgent,
    )

    let handoffRequests = 0
    let playStoreUrl = null

    const handoffRequestGate = createGate()
    await page.route('**/api/invitations/install-handoff', async (route) => {
      handoffRequests += 1
      await handoffRequestGate.promise
      await route.continue()
    })
    await page.route('https://play.google.com/**', async (route) => {
      playStoreUrl = route.request().url()
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>Intercepted Google Play for Wewed UAT</title>',
      })
    })

    const installButton = page.getByRole('button', {
      name: 'Install Wewed & open my invitation',
    })
    await expect(installButton).toBeVisible()
    await expect(installButton).toBeEnabled()
    const buttonBox = await installButton.boundingBox()
    expect(buttonBox).toBeTruthy()
    expect(buttonBox.height).toBeGreaterThanOrEqual(48)
    expect(buttonBox.width).toBeGreaterThanOrEqual(48)
    await expect(
      page.getByRole('link', { name: 'Continue to invitation in browser' }),
    ).toBeVisible()

    await installButton.evaluate((element) => element.click())
    const busyInstallButton = page.locator('button[aria-busy="true"]')
    await expect(busyInstallButton).toBeVisible()
    await busyInstallButton.evaluate((element) => element.click())
    handoffRequestGate.release()

    await expect.poll(() => handoffRequests, { timeout: 5_000 }).toBe(1)
    await expect.poll(() => playStoreUrl, { timeout: 10_000 }).not.toBeNull()

    const handoff = handoffFromPlayUrl(playStoreUrl)
    expect(playStoreUrl).not.toContain(fixture.rsvpToken)
    expect(playStoreUrl).not.toContain(fixture.weddingSlug)
    expect(playStoreUrl).not.toContain('guest=')
    expect(playStoreUrl).not.toContain('email=')
    expect(playStoreUrl).not.toContain('phone=')

    await context.close()

    const resumed = await assertResumeToExactInvitation(
      browser,
      fixture,
      client.userAgent,
      handoff,
    )
    await resumed.context.close()

    await expectSafeRecovery(browser, client.userAgent, handoff)
  })
}

test('Chromium mobile: expired and revoked handoffs fail closed in the HTTP flow', async ({
  browser,
}) => {
  const userAgent = MOBILE_CLIENTS[2].userAgent

  const expiredFixture = await createFixture('Expired')
  const expiredOrigin = await openInvitation(browser, expiredFixture, userAgent)
  const expired = await requestHandoff(
    expiredOrigin.context,
    'playwright-expiry-uat',
  )
  await expiredOrigin.context.close()

  const expiredRows = await prisma.$queryRawUnsafe(
    'SELECT "id" FROM private."InvitationInstallHandoff" WHERE "weddingId" = $1 ORDER BY "createdAt" DESC LIMIT 1',
    expiredFixture.weddingId,
  )
  expect(expiredRows).toHaveLength(1)
  await prisma.$executeRawUnsafe(
    'UPDATE private."InvitationInstallHandoff" SET "expiresAt" = NOW() - INTERVAL \'1 minute\' WHERE "id" = $1',
    expiredRows[0].id,
  )
  await expectSafeRecovery(browser, userAgent, expired.handoff)

  const revokedFixture = await createFixture('Revoked')
  const revokedOrigin = await openInvitation(browser, revokedFixture, userAgent)
  const revoked = await requestHandoff(
    revokedOrigin.context,
    'playwright-revocation-uat',
  )
  await revokedOrigin.context.close()

  await prisma.rSVP.update({
    where: { id: revokedFixture.rsvpId },
    data: { token: `rotated-${randomUUID()}` },
  })
  await expectSafeRecovery(browser, userAgent, revoked.handoff)
})

test('Chromium mobile: isolated-browser installed-app recovery creates only an opaque app handoff', async ({
  browser,
}) => {
  const fixture = await createFixture('Installed fallback')
  const { context, page } = await openInvitation(
    browser,
    fixture,
    MOBILE_CLIENTS[0].userAgent,
    { simulateInstalledApp: true },
  )

  const openButton = page.getByRole('button', {
    name: 'Open invitation in Wewed',
  })
  await expect(openButton).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Install Wewed & open my invitation' }),
  ).toHaveCount(0)

  let apiPayload = null
  let handoffRequests = 0
  const handoffRequestGate = createGate()
  await page.route('**/api/invitations/install-handoff', async (route) => {
    handoffRequests += 1
    await handoffRequestGate.promise
    const response = await route.fetch()
    apiPayload = await response.json()
    await route.fulfill({ response })
  })

  await openButton.evaluate((element) => element.click())
  const busyOpenButton = page.locator('button[aria-busy="true"]')
  await expect(busyOpenButton).toBeVisible()
  await busyOpenButton.evaluate((element) => element.click())
  handoffRequestGate.release()
  await expect.poll(() => handoffRequests, { timeout: 5_000 }).toBe(1)
  await expect.poll(() => apiPayload, { timeout: 5_000 }).not.toBeNull()

  const appHandoff = handoffFromResumePath(apiPayload.appResumePath)
  const playHandoff = handoffFromPlayUrl(apiPayload.playStoreUrl)
  expect(appHandoff).toBe(playHandoff)
  expect(apiPayload.appResumePath).not.toContain(fixture.rsvpToken)
  expect(apiPayload.appResumePath).not.toContain(fixture.weddingSlug)
  expect(apiPayload.playStoreUrl).not.toContain(fixture.rsvpToken)
  expect(apiPayload.playStoreUrl).not.toContain(fixture.weddingSlug)

  await context.close()
})
