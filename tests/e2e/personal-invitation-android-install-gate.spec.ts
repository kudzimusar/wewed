import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()
const BASE_URL = process.env.WEWED_UAT_BASE_URL ?? 'http://127.0.0.1:3000'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 16; Pixel 8 Build/BP2A.250705.008) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

interface Fixture {
  coupleId: string
  weddingId: string
  weddingSlug: string
  guestId: string
  rsvpId: string
  rsvpToken: string
  guestName: string
}

let fixture: Fixture | null = null

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16)
  const couple = await prisma.couple.create({
    data: {
      slug: `active-invite-couple-${suffix}`,
      partner1: 'Ivory',
      partner2: 'Guest',
    },
  })
  const wedding = await prisma.wedding.create({
    data: {
      slug: `active-invite-${suffix}`,
      title: 'Active Guest Invitation UAT',
      date: new Date('2030-06-20T10:00:00.000Z'),
      venue: 'Wewed UAT Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      privacy: 'link_only',
      invitationCardStyle: 'ivory-floral-gold',
      invitationCardMessage: 'We would be delighted to celebrate with you.',
      coupleId: couple.id,
    },
  })
  const guest = await prisma.guest.create({
    data: {
      name: 'Ivory Invitation Guest',
      email: `ivory-${suffix}@example.test`,
      weddingId: wedding.id,
    },
  })
  const rsvpToken = `active-${suffix}-${randomUUID().replaceAll('-', '')}`
  const rsvp = await prisma.rSVP.create({
    data: { token: rsvpToken, guestId: guest.id },
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

async function cleanupFixture(): Promise<void> {
  if (!fixture) return
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

test('Android personal invitation holds native install gate until explicit guest action', async ({ browser }) => {
  if (!fixture) throw new Error('Fixture was not created.')

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: ANDROID_UA,
    locale: 'en-ZW',
  })
  const page = await context.newPage()

  const sharedUrl =
    `${BASE_URL}/invite/${encodeURIComponent(fixture.weddingSlug)}?` +
    new URLSearchParams({
      rsvp: fixture.rsvpToken,
      card: 'midnight',
    }).toString()

  await page.goto(sharedUrl, { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('personal-invitation-android-gate')).toBeVisible()
  await expect(page.getByTestId('android-google-play-install')).toHaveAttribute(
    'href',
    `/invite/${fixture.weddingSlug}/install`,
  )
  await expect(page.getByText('You do not need a new invitation after installing.')).toBeVisible()
  await expect(page.getByTestId('android-continue-in-browser')).toBeVisible()

  // Exact production regression reported by real guests: the page used to render
  // "Preparing secure handoff…" and then automatically replace itself with /w/{slug}.
  // The Android adoption gate must remain stable until the Guest explicitly acts.
  expect(new URL(page.url()).pathname).toBe(`/invite/${fixture.weddingSlug}/open`)
  await page.waitForTimeout(2_500)
  await expect(page.getByTestId('personal-invitation-android-gate')).toBeVisible()
  expect(new URL(page.url()).pathname).toBe(`/invite/${fixture.weddingSlug}/open`)
  await expect(page.getByText('Preparing secure handoff…')).toHaveCount(0)

  // Browser fallback is still valid, but only after the Guest chooses it.
  await page.getByTestId('android-continue-in-browser').click()

  await expect.poll(
    () => {
      const url = new URL(page.url())
      return `${url.pathname}|${url.searchParams.get('invitation')}|${url.searchParams.get('card')}`
    },
    { timeout: 20_000 },
  ).toBe(`/w/${fixture.weddingSlug}|1|ivory-floral-gold`)

  const finalUrl = new URL(page.url())
  expect(finalUrl.searchParams.has('rsvp')).toBe(false)
  expect(finalUrl.searchParams.has('h')).toBe(false)
  expect(page.url()).not.toContain(fixture.rsvpToken)

  const experience = page.getByTestId('premium-invitation-experience')
  await expect(experience).toBeVisible()
  await expect(experience).toHaveAttribute('data-invitation-style', 'ivory-floral-gold')
  await expect(experience.getByTestId('invitation-guest-personalization')).toContainText(
    fixture.guestName,
  )

  await context.close()
})
