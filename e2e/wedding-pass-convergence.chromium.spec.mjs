import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()
const BASE_URL = process.env.WEWED_UAT_BASE_URL ?? 'http://127.0.0.1:3000'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 16; Pixel 8 Build/BP2A.250705.008) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

let fixture = null

async function createFixture() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  const couple = await prisma.couple.create({
    data: {
      slug: `ww2-pass-couple-${suffix}`,
      partner1: 'Pass',
      partner2: 'Guest',
    },
  })
  const wedding = await prisma.wedding.create({
    data: {
      slug: `ww2-pass-${suffix}`,
      title: 'Pass & Guest',
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      venue: 'Wewed Qualification Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      privacy: 'link_only',
      invitationCardStyle: 'ivory-floral-gold',
      invitationCardMessage: 'Your private invitation and Wedding Pass share one guest authority.',
      coupleId: couple.id,
    },
  })
  const guest = await prisma.guest.create({
    data: {
      name: 'WW2 Invitation Guest',
      email: `ww2-${suffix}@example.test`,
      weddingId: wedding.id,
    },
  })
  const rsvpToken = `ww2-pass-${suffix}-${randomUUID().replaceAll('-', '')}`
  const rsvp = await prisma.rSVP.create({
    data: {
      token: rsvpToken,
      guestId: guest.id,
      attending: true,
      plusOne: true,
      plusOneName: 'WW2 Plus One',
    },
  })
  return {
    coupleId: couple.id,
    weddingId: wedding.id,
    weddingSlug: wedding.slug,
    guestId: guest.id,
    rsvpId: rsvp.id,
    rsvpToken,
    guestName: guest.name,
  }
}

async function cleanupFixture() {
  if (!fixture) return
  await prisma.$executeRawUnsafe(
    'DELETE FROM public."WeddingCheckIn" WHERE "weddingId" = $1',
    fixture.weddingId,
  )
  await prisma.$executeRawUnsafe(
    'DELETE FROM public."WeddingPassCredential" WHERE "weddingId" = $1',
    fixture.weddingId,
  )
  await prisma.$executeRawUnsafe(
    'DELETE FROM public."WeddingPassKey" WHERE "weddingId" = $1',
    fixture.weddingId,
  )
  await prisma.rSVP.deleteMany({ where: { guestId: fixture.guestId } })
  await prisma.guest.deleteMany({ where: { id: fixture.guestId } })
  await prisma.wedding.deleteMany({ where: { id: fixture.weddingId } })
  await prisma.couple.deleteMany({ where: { id: fixture.coupleId } })
  fixture = null
}

test.describe.configure({ mode: 'serial' })
test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' })
test.setTimeout(90_000)

test.beforeEach(async () => {
  fixture = await createFixture()
})

test.afterEach(async () => {
  await cleanupFixture()
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('Ivory Guest Pass displays the real signed WW2 credential rather than the legacy session summary', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: ANDROID_UA,
    locale: 'en-ZW',
  })
  const page = await context.newPage()

  await page.goto(
    `${BASE_URL}/invite/${encodeURIComponent(fixture.weddingSlug)}?` +
      new URLSearchParams({
        rsvp: fixture.rsvpToken,
        card: 'ivory-floral-gold',
      }).toString(),
    { waitUntil: 'domcontentloaded' },
  )

  await expect.poll(
    () => {
      const url = new URL(page.url())
      return `${url.pathname}|${url.searchParams.get('invitation')}`
    },
    { timeout: 20_000 },
  ).toBe(`/w/${fixture.weddingSlug}|1`)

  expect(page.url()).not.toContain(fixture.rsvpToken)

  const experience = page.getByTestId('premium-invitation-experience')
  const card = experience.getByTestId('invitation-trifold')
  await expect(card).toHaveAttribute('data-artwork-ready', 'true', { timeout: 10_000 })

  await experience.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'open', { timeout: 5_000 })
  await experience.getByTestId('invitation-details-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'details')

  const passResponsePromise = page.waitForResponse((response) => {
    try {
      return new URL(response.url()).pathname === '/api/wedding-day/pass'
    } catch {
      return false
    }
  })
  await experience.getByTestId('invitation-cta-pass').click()
  const passResponse = await passResponsePromise
  expect(passResponse.status()).toBe(200)

  const payload = await passResponse.json()
  expect(payload.success).toBe(true)
  expect(payload.data.guestId).toBe(fixture.guestId)
  expect(payload.data.guestName).toBe(fixture.guestName)
  expect(payload.data.token.startsWith('WW2.')).toBe(true)
  expect(payload.data.tokenVersion).toBe('WW2')
  expect(payload.data.publicKeyDerBase64).toBeTruthy()

  const dialog = page.getByTestId('wedding-guest-pass-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-pass-authority', 'ww2')
  await expect(dialog.getByTestId('wedding-pass-guest-name')).toHaveText(fixture.guestName)
  await expect(dialog.getByTestId('wedding-pass-serial')).toHaveText(payload.data.passSerial)
  await expect(dialog.getByTestId('wedding-pass-version')).toHaveText('WW2')
  await expect(dialog.getByTestId('wedding-pass-ww2-qr').locator('img')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/,
  )

  await expect(dialog).not.toContainText('RSVP pending')
  await expect(dialog).not.toContainText(fixture.rsvpToken)

  await context.close()
})
