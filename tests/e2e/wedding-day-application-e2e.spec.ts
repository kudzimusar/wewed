import { createHmac, randomUUID, verify as verifySignature } from 'node:crypto'
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const databaseUrl = process.env.WEDDING_DAY_TEST_DATABASE_URL?.trim() || ''
if (!databaseUrl.includes('wewed_wedding_day_test')) {
  throw new Error('Wedding Day application E2E requires the isolated wewed_wedding_day_test database.')
}

const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const SESSION_SECRET = 'wewed-wedding-day-isolated-e2e-session-secret'
const TEST_WW2_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEp4MbWzKegTXHfeNY1mCOzI/VW5WE
9jkrhX0tCTeqcoP4+2Hniv8lNx4RsKsTogpBswQwOcc5LTHqKwogRmZ6Ow==
-----END PUBLIC KEY-----`
const TEST_ROOT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0A7E+RMF2KW2arpnSLMT0dzJSuTd
5dLjEp4M9s1dOnBJOr/QNJfnhurfUGtHUUIuXaTySklbFy1CYUJuUmICog==
-----END PUBLIC KEY-----`

interface SeedState {
  coupleId: string
  weddingId: string
  weddingSlug: string
  guestId: string
  rsvpToken: string
  plannerUserId: string
  plannerEmail: string
  plannerToken: string
  vendorUserId: string
  vendorEmail: string
  vendorToken: string
  vendor2UserId: string
  vendor2Email: string
  serviceEngagementId: string
  otherServiceEngagementId: string
  passToken: string
  passSerial: string
}

function appSessionToken(input: {
  userId: string
  email: string
  role: 'admin' | 'couple' | 'planner' | 'vendor'
  activeWeddingId: string
}) {
  const payload = {
    version: 2,
    userId: input.userId,
    authUserId: input.userId,
    email: input.email,
    role: input.role,
    coupleId: null,
    activeWeddingId: input.activeWeddingId,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function verifyP1363(payload: string, signatureHex: string, publicKey: string) {
  return verifySignature(
    'sha256',
    Buffer.from(payload, 'utf8'),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(signatureHex, 'hex'),
  )
}

async function openInvitation(page: Page, state: SeedState) {
  await page.goto(
    `/invite/${encodeURIComponent(state.weddingSlug)}?rsvp=${encodeURIComponent(state.rsvpToken)}&card=ivory-floral-gold`,
  )
  await expect(page.getByRole('heading', { name: 'Your invitation is ready' })).toBeVisible()
  await page.getByRole('link', { name: 'Open wedding invitation' }).click()
  await expect(page).toHaveURL(new RegExp(`/w/${state.weddingSlug}\\?`))
}

async function guestJson<T>(page: Page, path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ path: requestPath, init: requestInit }) => {
      const response = await fetch(requestPath, requestInit)
      return { status: response.status, body: (await response.json()) as T }
    },
    { path, init },
  )
}

async function authGet(request: APIRequestContext, path: string, token: string) {
  return request.get(path, { headers: { Authorization: `Bearer ${token}` } })
}

async function authPost(
  request: APIRequestContext,
  path: string,
  token: string,
  data: Record<string, unknown>,
) {
  return request.post(path, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
}

test.describe.serial('Wedding Day real isolated Wewed application', () => {
  const state = {} as SeedState

  test.beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8)
    state.weddingSlug = `wedding-day-e2e-${suffix}`
    state.rsvpToken = `wd-rsvp-${suffix}-${randomUUID()}`
    state.plannerEmail = `planner-${suffix}@wewed.test`
    state.vendorEmail = `vendor-${suffix}@wewed.test`
    state.vendor2Email = `vendor2-${suffix}@wewed.test`

    const couple = await db.couple.create({
      data: {
        slug: `wd-couple-${suffix}`,
        partner1: 'Jane',
        partner2: 'Michael',
        surname: 'Doe',
      },
    })
    state.coupleId = couple.id

    const wedding = await db.wedding.create({
      data: {
        slug: state.weddingSlug,
        title: 'Jane & Michael Doe',
        monogram: 'J&M',
        tagline: 'Our Wedding Day',
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        venue: 'Wewed Test Estate',
        venueCity: 'Harare',
        venueCountry: 'Zimbabwe',
        invitationCardStyle: 'ivory-floral-gold',
        invitationCardMessage: 'Together with our families, we invite you to celebrate with us.',
        privacy: 'link_only',
        coupleId: couple.id,
      },
    })
    state.weddingId = wedding.id

    const guest = await db.guest.create({
      data: {
        name: 'Jane Doe Household',
        email: `guest-${suffix}@wewed.test`,
        tableNumber: 9,
        weddingId: wedding.id,
      },
    })
    state.guestId = guest.id
    await db.rSVP.create({
      data: {
        token: state.rsvpToken,
        guestId: guest.id,
        attending: null,
      },
    })

    await db.programmeItem.createMany({
      data: [
        {
          weddingId: wedding.id,
          time: '15:00',
          title: 'Wedding Ceremony',
          location: 'Garden Chapel',
          order: 1,
        },
        {
          weddingId: wedding.id,
          time: '18:00',
          title: 'Reception',
          location: 'Grand Ballroom',
          order: 2,
        },
      ],
    })

    const planner = await db.user.create({
      data: {
        email: state.plannerEmail,
        name: 'Wedding Day Planner',
        role: 'planner',
        currentWeddingId: wedding.id,
      },
    })
    state.plannerUserId = planner.id
    await db.weddingMembership.create({
      data: {
        userId: planner.id,
        weddingId: wedding.id,
        role: 'planner',
        status: 'active',
        acceptedAt: new Date(),
      },
    })
    state.plannerToken = appSessionToken({
      userId: planner.id,
      email: planner.email,
      role: 'planner',
      activeWeddingId: wedding.id,
    })

    await db.plannerTask.create({
      data: {
        weddingId: wedding.id,
        title: 'Confirm florist arrival',
        category: 'vendors',
        status: 'in_progress',
        priority: 'high',
        order: 1,
      },
    })

    const vendor = await db.vendor.create({
      data: {
        weddingId: wedding.id,
        name: 'Tariro Florals',
        category: 'florist',
        email: state.vendorEmail,
      },
    })
    const service = await db.serviceEngagement.create({
      data: {
        weddingId: wedding.id,
        vendorId: vendor.id,
        serviceCategory: 'FLORAL_DECOR',
        serviceDescription: 'Ceremony and reception flowers',
      },
    })
    state.serviceEngagementId = service.id

    const vendorUser = await db.user.create({
      data: {
        email: state.vendorEmail,
        name: 'Tariro Florals',
        role: 'vendor',
        currentWeddingId: wedding.id,
      },
    })
    state.vendorUserId = vendorUser.id
    await db.weddingMembership.create({
      data: {
        userId: vendorUser.id,
        weddingId: wedding.id,
        role: 'vendor',
        status: 'active',
        acceptedAt: new Date(),
      },
    })
    state.vendorToken = appSessionToken({
      userId: vendorUser.id,
      email: vendorUser.email,
      role: 'vendor',
      activeWeddingId: wedding.id,
    })

    const vendor2 = await db.vendor.create({
      data: {
        weddingId: wedding.id,
        name: 'Moyo Catering',
        category: 'catering',
        email: state.vendor2Email,
      },
    })
    const service2 = await db.serviceEngagement.create({
      data: {
        weddingId: wedding.id,
        vendorId: vendor2.id,
        serviceCategory: 'CATERING',
        serviceDescription: 'Wedding reception catering',
      },
    })
    state.otherServiceEngagementId = service2.id

    const vendor2User = await db.user.create({
      data: {
        email: state.vendor2Email,
        name: 'Moyo Catering',
        role: 'vendor',
        currentWeddingId: wedding.id,
      },
    })
    state.vendor2UserId = vendor2User.id
    await db.weddingMembership.create({
      data: {
        userId: vendor2User.id,
        weddingId: wedding.id,
        role: 'vendor',
        status: 'active',
        acceptedAt: new Date(),
      },
    })
  })

  test.afterAll(async () => {
    if (!state.weddingId) return
    await db.$executeRawUnsafe('DELETE FROM public."WeddingCheckIn" WHERE "weddingId" = $1', state.weddingId)
    await db.$executeRawUnsafe('DELETE FROM public."WeddingAnnouncement" WHERE "weddingId" = $1', state.weddingId)
    await db.$executeRawUnsafe('DELETE FROM public."WeddingServicePresence" WHERE "weddingId" = $1', state.weddingId)
    await db.$executeRawUnsafe('DELETE FROM public."WeddingPassCredential" WHERE "weddingId" = $1', state.weddingId)
    await db.$executeRawUnsafe('DELETE FROM public."WeddingPassKey" WHERE "weddingId" = $1', state.weddingId)
    await db.weddingMembership.deleteMany({ where: { weddingId: state.weddingId } })
    await db.plannerTask.deleteMany({ where: { weddingId: state.weddingId } })
    await db.programmeItem.deleteMany({ where: { weddingId: state.weddingId } })
    await db.serviceEngagement.deleteMany({ where: { weddingId: state.weddingId } })
    await db.vendor.deleteMany({ where: { weddingId: state.weddingId } })
    await db.rSVP.deleteMany({ where: { guest: { weddingId: state.weddingId } } })
    await db.guest.deleteMany({ where: { weddingId: state.weddingId } })
    await db.user.deleteMany({ where: { id: { in: [state.plannerUserId, state.vendorUserId, state.vendor2UserId] } } })
    await db.wedding.delete({ where: { id: state.weddingId } })
    await db.couple.delete({ where: { id: state.coupleId } })
    await db.$disconnect()
  })

  test('Ivory invitation persists RSVP and provisions the same signed WW2 pass across browser sessions', async ({ page, browser }) => {
    await openInvitation(page, state)
    const experience = page.getByTestId('premium-invitation-experience')
    await expect(experience).toBeVisible()
    await expect(experience).toHaveAttribute('data-motion-state', 'closed')
    await experience.getByRole('button', { name: 'Open invitation' }).click()
    await expect(experience).toHaveAttribute('data-motion-state', 'open', { timeout: 5_000 })
    await page.locator('#rsvp').scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'Review my RSVP' }).click()
    const dialog = page.getByTestId('premium-invitation-rsvp-dialog')
    await expect(dialog).toBeVisible()
    await page.getByLabel('Joyfully accept').click()
    await page.getByLabel('I am bringing a plus-one').click()
    await page.locator('input[name="plusOneName"]').fill('Michael Doe')
    await page.getByLabel('Children are attending').click()
    await page.locator('input[name="kidsCount"]').fill('2')
    await page.getByRole('button', { name: 'Save RSVP' }).click()
    await expect(page.getByTestId('premium-rsvp-saved')).toBeVisible()

    await page.getByTestId('open-wedding-pass').click()
    await expect(page.getByTestId('wedding-pass')).toBeVisible()
    await expect(page.getByTestId('wedding-pass-qr')).toBeVisible()
    await expect(page.getByTestId('wedding-pass-table')).toHaveText('9')
    await expect(page.getByTestId('wedding-pass-programme')).toContainText('Wedding Ceremony')
    await expect(page.getByTestId('wedding-pass-household')).toContainText('Michael Doe')

    const passResponse = await guestJson<{
      success: boolean
      data: { token: string; passSerial: string }
    }>(page, '/api/wedding-day/pass')
    expect(passResponse.status).toBe(200)
    expect(passResponse.body.success).toBe(true)
    state.passToken = passResponse.body.data.token
    state.passSerial = passResponse.body.data.passSerial

    const parts = state.passToken.split('.')
    expect(parts).toHaveLength(6)
    expect(parts[0]).toBe('WW2')
    expect(verifyP1363(parts.slice(0, 5).join('.'), parts[5], TEST_WW2_PUBLIC_KEY)).toBe(true)

    const secondContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3107' })
    const secondPage = await secondContext.newPage()
    await openInvitation(secondPage, state)
    const guestResponse = await guestJson<{
      success: boolean
      data: { guest: { attending: boolean; household: unknown[] } }
    }>(secondPage, '/api/wedding-day/guest')
    expect(guestResponse.status).toBe(200)
    expect(guestResponse.body.data.guest.attending).toBe(true)
    expect(guestResponse.body.data.guest.household).toHaveLength(4)
    const secondPass = await guestJson<{
      success: boolean
      data: { token: string; passSerial: string }
    }>(secondPage, '/api/wedding-day/pass')
    expect(secondPass.body.data.passSerial).toBe(state.passSerial)
    expect(secondPass.body.data.token).toBe(state.passToken)
    await secondContext.close()
  })

  test('household check-in is partial, idempotent, duplicate-safe, and reflected in Planner Wedding Day', async ({ request }) => {
    const firstAdmission = await authPost(request, '/api/wedding-day/check-in', state.plannerToken, {
      token: state.passToken,
      attendeeKeys: ['primary', 'plus-one'],
      source: 'qr',
      gateId: 'gate-a',
    })
    expect(firstAdmission.status()).toBe(200)
    const firstBody = await firstAdmission.json()
    expect(firstBody.data.checkedInPeople).toBe(2)
    expect(firstBody.data.expectedPeople).toBe(4)
    expect(firstBody.data.householdComplete).toBe(false)
    expect(firstBody.data.results.map((item: { result: string }) => item.result)).toEqual(['ADMITTED', 'ADMITTED'])

    const plannerAtTwo = await authGet(request, '/api/wedding-day/planner', state.plannerToken)
    expect(plannerAtTwo.status()).toBe(200)
    const plannerAtTwoBody = await plannerAtTwo.json()
    expect(plannerAtTwoBody.data.attendance).toEqual({
      expectedPeople: 4,
      checkedInPeople: 2,
      remainingPeople: 2,
    })

    const duplicate = await authPost(request, '/api/wedding-day/check-in', state.plannerToken, {
      token: state.passToken,
      attendeeKeys: ['primary', 'plus-one'],
      source: 'qr',
      gateId: 'gate-b',
    })
    expect(duplicate.status()).toBe(200)
    const duplicateBody = await duplicate.json()
    expect(duplicateBody.data.checkedInPeople).toBe(2)
    expect(duplicateBody.data.results.map((item: { result: string }) => item.result)).toEqual([
      'ALREADY_CHECKED_IN',
      'ALREADY_CHECKED_IN',
    ])

    const laterArrival = await authPost(request, '/api/wedding-day/check-in', state.plannerToken, {
      token: state.passToken,
      attendeeKeys: ['child-1', 'child-2'],
      source: 'qr',
      gateId: 'gate-a',
    })
    expect(laterArrival.status()).toBe(200)
    const laterBody = await laterArrival.json()
    expect(laterBody.data.checkedInPeople).toBe(4)
    expect(laterBody.data.householdComplete).toBe(true)

    const finalPlanner = await authGet(request, '/api/wedding-day/planner', state.plannerToken)
    const finalPlannerBody = await finalPlanner.json()
    expect(finalPlannerBody.data.attendance).toEqual({
      expectedPeople: 4,
      checkedInPeople: 4,
      remainingPeople: 0,
    })
    const legacyRsvp = await db.rSVP.findUniqueOrThrow({ where: { guestId: state.guestId } })
    expect(legacyRsvp.checkedIn).toBe(true)
  })

  test('vendor presence is service-scoped and changes Planner vendor state', async ({ request }) => {
    const enRoute = await authPost(request, '/api/wedding-day/vendors/presence', state.vendorToken, {
      serviceEngagementId: state.serviceEngagementId,
      state: 'EN_ROUTE',
    })
    expect(enRoute.status()).toBe(200)

    const arrived = await authPost(request, '/api/wedding-day/vendors/presence', state.vendorToken, {
      serviceEngagementId: state.serviceEngagementId,
      state: 'ARRIVED_ON_SITE',
    })
    expect(arrived.status()).toBe(200)

    const planner = await authGet(request, '/api/wedding-day/planner', state.plannerToken)
    const plannerBody = await planner.json()
    expect(plannerBody.data.vendors.expected).toBe(2)
    expect(plannerBody.data.vendors.onsite).toBe(1)
    expect(plannerBody.data.vendors.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceEngagementId: state.serviceEngagementId,
          state: 'ARRIVED_ON_SITE',
        }),
      ]),
    )

    const forbiddenOtherVendor = await authPost(
      request,
      '/api/wedding-day/vendors/presence',
      state.vendorToken,
      {
        serviceEngagementId: state.otherServiceEngagementId,
        state: 'EN_ROUTE',
      },
    )
    expect(forbiddenOtherVendor.status()).toBe(403)
  })

  test('Planner announcement is persisted once and read from the same guest Wedding Day domain', async ({ page, request }) => {
    const publish = await authPost(request, '/api/wedding-day/announcements', state.plannerToken, {
      audience: 'guest',
      title: 'Reception update',
      body: 'Please move to the Grand Ballroom for the reception.',
    })
    expect(publish.status()).toBe(201)

    await openInvitation(page, state)
    const guestAnnouncements = await guestJson<{
      success: boolean
      data: Array<{ title: string; body: string }>
    }>(page, '/api/wedding-day/announcements')
    expect(guestAnnouncements.status).toBe(200)
    expect(guestAnnouncements.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Reception update',
          body: 'Please move to the Grand Ballroom for the reception.',
        }),
      ]),
    )

    await page.goto(`/w/${state.weddingSlug}/pass`)
    await expect(page.getByTestId('wedding-pass-announcements')).toContainText('Reception update')
  })

  test('server-side RBAC blocks guest admission/planner access and vendor cross-service mutation', async ({ page, request }) => {
    await openInvitation(page, state)
    const guestPlanner = await guestJson<{ success: boolean }>(page, '/api/wedding-day/planner')
    expect(guestPlanner.status).toBe(403)

    const guestCheckIn = await guestJson<{ success: boolean }>(page, '/api/wedding-day/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: state.passToken, attendeeKeys: ['primary'], source: 'qr' }),
    })
    expect(guestCheckIn.status).toBe(403)

    const legacySelfCheckIn = await guestJson<{ success: boolean }>(
      page,
      `/api/weddings/${state.weddingSlug}/guest-session`,
      { method: 'PATCH' },
    )
    expect(legacySelfCheckIn.status).toBe(403)

    const vendorPlanner = await authGet(request, '/api/wedding-day/planner', state.vendorToken)
    expect(vendorPlanner.status()).toBe(403)
  })

  test('WW2 tampering is rejected and the offline manifest is root-signed', async ({ request }) => {
    const parts = state.passToken.split('.')
    const tamperedMask = [...parts]
    tamperedMask[3] = parts[3] === '0e' ? '0f' : '0e'
    const tamperedResponse = await authPost(request, '/api/wedding-day/check-in', state.plannerToken, {
      token: tamperedMask.join('.'),
      attendeeKeys: ['primary'],
      source: 'qr',
    })
    expect(tamperedResponse.status()).toBe(400)

    const manifestResponse = await authGet(request, '/api/wedding-day/manifest', state.plannerToken)
    expect(manifestResponse.status()).toBe(200)
    const manifest = await manifestResponse.json()
    expect(manifest.data.payload.weddingId).toBe(state.weddingId)
    expect(manifest.data.payload.tokenVersion).toBe('WW2')
    expect(manifest.data.payload.credentials).toEqual(
      expect.arrayContaining([expect.objectContaining({ passSerial: state.passSerial })]),
    )
    expect(
      verifyP1363(
        manifest.data.canonicalPayload,
        manifest.data.signatureHex,
        TEST_ROOT_PUBLIC_KEY,
      ),
    ).toBe(true)
    expect(
      verifyP1363(
        `${manifest.data.canonicalPayload}tampered`,
        manifest.data.signatureHex,
        TEST_ROOT_PUBLIC_KEY,
      ),
    ).toBe(false)
  })
})
