import { PrismaClient } from '@prisma/client'
import { expect, test, type Page } from '@playwright/test'

const db = new PrismaClient()

const PROVIDER = {
  businessId: 'e2e-ai-marketplace-provider-business',
  profileId: 'e2e-ai-marketplace-provider-profile',
  offeringId: 'e2e-ai-marketplace-provider-offering',
  slug: 'e2e-ai-marketplace-provider',
  name: 'E2E Marketplace Events',
} as const

type FixtureOptions = {
  acceptingEnquiries?: boolean
  listingStatus?: 'claimed' | 'verified' | 'unclaimed'
}

async function resetProvider({
  acceptingEnquiries = true,
  listingStatus = 'claimed',
}: FixtureOptions = {}) {
  const claimable = listingStatus === 'unclaimed'
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `DELETE FROM wewed_admin."BusinessAccount" WHERE id='${PROVIDER.businessId}' OR slug='${PROVIDER.slug}'`,
    )
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_admin."BusinessAccount"
        (id,name,slug,type,status,"onboardingStatus","subscriptionPlan","subscriptionStatus",metadata,"createdAt","updatedAt")
       VALUES
        ('${PROVIDER.businessId}','${PROVIDER.name}','${PROVIDER.slug}','vendor','active','complete','free','active','{}'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    )
    // Some account lifecycle migrations may provision a profile automatically. Replace any such
    // row so this fixture remains deterministic across the complete migration history.
    await tx.$executeRawUnsafe(
      `DELETE FROM wewed_admin."ProviderProfile" WHERE "businessAccountId"='${PROVIDER.businessId}' OR slug='${PROVIDER.slug}'`,
    )
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_admin."ProviderProfile"
        (id,"businessAccountId",slug,"displayName",headline,description,country,city,"serviceAreas",languages,
         "verificationBadges",visibility,"completionScore","publishedAt","listingStatus","isClaimable",
         "acceptingEnquiries","ownerConfirmedAt","createdAt","updatedAt")
       VALUES
        ('${PROVIDER.profileId}','${PROVIDER.businessId}','${PROVIDER.slug}','${PROVIDER.name}',
         'Wedding decor and event rentals','Production-shaped provider fixture','Zimbabwe','Harare',
         '["Harare"]'::jsonb,'["English"]'::jsonb,'["Verified fixture"]'::jsonb,'published',90,CURRENT_TIMESTAMP,
         '${listingStatus}',${claimable ? 'true' : 'false'},${acceptingEnquiries ? 'true' : 'false'},
         ${claimable ? 'NULL' : 'CURRENT_TIMESTAMP'},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    )
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_admin."ProviderServiceOffering"
        (id,"businessAccountId",category,"displayName",description,status,"startingPriceCents","maximumPriceCents",
         currency,"pricingModel","pricingVisibility","serviceAreas",inclusions,details,"completionScore","publishedAt",
         "aiReadinessScore","aiReadinessStatus","createdAt","updatedAt")
       VALUES
        ('${PROVIDER.offeringId}','${PROVIDER.businessId}','decor','Event Decor & Styling',
         'Published quote-based decor service used to exercise the Marketplace Concierge.','published',12500,25000,
         'USD','package','quote_only','["Harare"]'::jsonb,'["Setup guidance"]'::jsonb,'{}'::jsonb,90,CURRENT_TIMESTAMP,
         80,'ready',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    )
  })
}

async function cleanupProvider() {
  await db.$executeRawUnsafe(
    `DELETE FROM wewed_admin."BusinessAccount" WHERE id='${PROVIDER.businessId}' OR slug='${PROVIDER.slug}'`,
  )
}

function mockConcierge(page: Page, observed: Array<Record<string, unknown>>) {
  return page.route('**/api/ai/marketplace', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    observed.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        result: {
          traceId: 'e2e-marketplace-trace',
          summary: 'These published services are quote based. Confirm the event scope before making an enquiry.',
          facts: [
            { label: 'Provider', value: PROVIDER.name, source: 'marketplace.public' },
            { label: 'Pricing', value: 'Quote requested', source: 'marketplace.public' },
          ],
          recommendations: [
            { title: 'Confirm quantities', rationale: 'The vendor should confirm stock and logistics before booking.' },
          ],
          missingInformation: [
            { id: 'event-date', question: 'What is your event date?', required: true },
          ],
          proposedActions: [],
          warnings: ['Nothing has been booked, priced or sent.'],
          provenance: {
            modelReleaseId: 'wewed-ai-e2e',
            promptReleaseId: 'marketplace-concierge-e2e',
            skillVersion: 'e2e',
            generatedAt: '2026-08-25T00:00:00.000Z',
          },
        },
      }),
    })
  })
}

test.afterAll(async () => {
  await cleanupProvider()
  await db.$disconnect()
})

test('Marketplace Concierge keeps public pricing private and hands commitment to the governed enquiry UI', async ({ page }) => {
  await resetProvider()

  const publicProfileResponse = await page.request.get(`/api/providers/${PROVIDER.slug}`)
  expect(publicProfileResponse.status()).toBe(200)
  const publicProfile = await publicProfileResponse.json() as {
    provider: { offerings: Array<{ startingPriceCents: number | null; maximumPriceCents: number | null; pricingVisibility: string }> }
  }
  expect(publicProfile.provider.offerings[0]).toMatchObject({
    pricingVisibility: 'quote_only',
    startingPriceCents: null,
    maximumPriceCents: null,
  })

  const observedAiRequests: Array<Record<string, unknown>> = []
  await mockConcierge(page, observedAiRequests)

  const transactionalWrites: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'GET') return
    const pathname = new URL(request.url()).pathname
    if (pathname === '/api/providers/enquiries' || pathname.startsWith('/api/bookings')) {
      transactionalWrites.push(`${request.method()} ${pathname}`)
    }
  })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto(`/vendors/${PROVIDER.slug}`)
  await expect(page.getByRole('heading', { name: PROVIDER.name, level: 1 })).toBeVisible()
  await expect(page.getByText('Quote based').first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('$125')
  await expect(page.locator('body')).not.toContainText('$250')

  await page.getByRole('button', { name: 'Ask Wewed', exact: true }).click()
  const aiDialog = page.getByRole('dialog', { name: `Ask Wewed about ${PROVIDER.name}` })
  await expect(aiDialog).toBeVisible()
  await expect(aiDialog.getByText('Nothing is booked or sent by asking.')).toBeVisible()
  await expect(aiDialog.getByRole('button', { name: 'Prepare an enquiry' })).toBeVisible()

  await aiDialog.getByRole('button', { name: 'Compare services' }).click()
  await expect(aiDialog.getByText('These published services are quote based. Confirm the event scope before making an enquiry.')).toBeVisible()
  expect(observedAiRequests).toHaveLength(1)
  expect(observedAiRequests[0]).toMatchObject({
    providerSlug: PROVIDER.slug,
    outcome: 'compare_options',
  })

  await aiDialog.getByRole('button', { name: /Continue to enquiry/ }).click()
  await expect(aiDialog).toBeHidden()
  await expect(page.getByRole('dialog', { name: `Ask ${PROVIDER.name}` })).toBeVisible()
  await expect(page.getByText('Private Wewed enquiry')).toBeVisible()
  expect(transactionalWrites).toEqual([])
  expect(pageErrors).toEqual([])
})

test('Marketplace Concierge fails closed when enquiries are paused', async ({ page }) => {
  await resetProvider({ acceptingEnquiries: false })

  const blockedPrepare = await page.request.post('/api/ai/marketplace', {
    data: {
      providerSlug: PROVIDER.slug,
      input: 'Prepare an enquiry for this provider.',
      outcome: 'prepare_enquiry',
    },
  })
  expect(blockedPrepare.status()).toBe(409)

  const observedAiRequests: Array<Record<string, unknown>> = []
  await mockConcierge(page, observedAiRequests)
  await page.goto(`/vendors/${PROVIDER.slug}`)
  await page.getByRole('button', { name: 'Ask Wewed', exact: true }).click()

  const aiDialog = page.getByRole('dialog', { name: `Ask Wewed about ${PROVIDER.name}` })
  await expect(aiDialog).toBeVisible()
  await expect(aiDialog.getByRole('button', { name: 'Prepare an enquiry' })).toHaveCount(0)
  await expect(aiDialog.getByText(/not currently accepting enquiries/i)).toBeVisible()
  await aiDialog.getByRole('button', { name: 'Compare services' }).click()
  await expect(aiDialog.getByRole('button', { name: /Continue to enquiry/ })).toHaveCount(0)
  expect(observedAiRequests).toHaveLength(1)
  expect(observedAiRequests[0]).toMatchObject({ outcome: 'compare_options' })
})

test('provisional listings stay browseable but cannot mount or invoke Marketplace AI', async ({ page }) => {
  await resetProvider({ acceptingEnquiries: false, listingStatus: 'unclaimed' })

  const blockedAi = await page.request.post('/api/ai/marketplace', {
    data: {
      providerSlug: PROVIDER.slug,
      input: 'Compare this provider services.',
      outcome: 'compare_options',
    },
  })
  expect(blockedAi.status()).toBe(404)

  await page.goto(`/vendors/${PROVIDER.slug}`)
  await expect(page.getByRole('heading', { name: PROVIDER.name, level: 1 })).toBeVisible()
  await expect(page.getByText('Unclaimed listing')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask Wewed', exact: true })).toHaveCount(0)
})

test('Marketplace Concierge modal remains contained and dismissible on mobile @mobile', async ({ page }) => {
  await resetProvider()
  await page.goto(`/vendors/${PROVIDER.slug}`)
  await page.getByRole('button', { name: 'Ask Wewed', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: `Ask Wewed about ${PROVIDER.name}` })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Nothing is booked or sent by asking.')).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth + 1))

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
