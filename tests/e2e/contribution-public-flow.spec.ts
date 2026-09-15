import { PrismaClient } from '@prisma/client'
import { E2E_WEDDINGS, expect, test } from './support/planner-browser'

const CASH_CAMPAIGN_ID = 'e2e-public-contribution-cash'
const DIRECT_CAMPAIGN_ID = 'e2e-public-contribution-direct'
const SECONDARY_CAMPAIGN_ID = 'e2e-public-contribution-secondary'
const CASH_BUDGET_ID = 'e2e-public-contribution-budget-cash'
const DIRECT_BUDGET_ID = 'e2e-public-contribution-budget-direct'
const ENGAGEMENT_ID = 'e2e-public-contribution-engagement'

async function seedPublicContributionFlow() {
  const prisma = new PrismaClient()
  try {
    await prisma.wedding.update({
      where: { id: E2E_WEDDINGS.primary.id },
      data: { privacy: 'link_only', invitationCardStyle: 'ivory-floral-gold' },
    })
    await prisma.budgetItem.createMany({
      data: [
        {
          id: CASH_BUDGET_ID,
          weddingId: E2E_WEDDINGS.primary.id,
          category: 'honeymoon',
          description: 'Guest-funded honeymoon UAT',
          estimatedCost: 1000,
          paidAmount: 0,
          currency: 'USD',
        },
        {
          id: DIRECT_BUDGET_ID,
          weddingId: E2E_WEDDINGS.primary.id,
          category: 'photo_video',
          description: 'Guest direct-vendor UAT',
          estimatedCost: 800,
          actualCost: 800,
          paidAmount: 0,
          currency: 'USD',
          vendorId: `${E2E_WEDDINGS.primary.id}-vendor`,
          vendorName: E2E_WEDDINGS.primary.seededVendor,
        },
      ],
    })
    await prisma.serviceEngagement.create({
      data: {
        id: ENGAGEMENT_ID,
        weddingId: E2E_WEDDINGS.primary.id,
        vendorId: `${E2E_WEDDINGS.primary.id}-vendor`,
        serviceCategory: 'Photography',
        serviceDescription: 'Contribution direct-payment E2E service',
        agreedAmount: 800,
        currency: 'USD',
        origin: 'e2e',
        recordMode: 'record_only',
        lifecycleStatus: 'planned',
      },
    })
    await prisma.budgetItem.update({ where: { id: DIRECT_BUDGET_ID }, data: { serviceEngagementId: ENGAGEMENT_ID } })

    await prisma.$executeRaw`
      INSERT INTO wewed_contributions.wedding_settings (wedding_id, accepting_contributions, disabled_message)
      VALUES (${E2E_WEDDINGS.primary.id}, TRUE, 'Your presence is enough.')
      ON CONFLICT (wedding_id) DO UPDATE SET accepting_contributions=TRUE, disabled_message=EXCLUDED.disabled_message, updated_at=NOW()
    `
    await prisma.$executeRaw`
      INSERT INTO wewed_contributions.wedding_settings (wedding_id, accepting_contributions)
      VALUES (${E2E_WEDDINGS.secondary.id}, TRUE)
      ON CONFLICT (wedding_id) DO UPDATE SET accepting_contributions=TRUE, updated_at=NOW()
    `
    await prisma.$executeRaw`
      INSERT INTO wewed_contributions.campaigns
        (id,wedding_id,type,title,description,target_amount,currency,published,show_target,show_raised,invitation_visible,show_contributor_recognition,enabled,sort_order,accepted_types,budget_item_id)
      VALUES
        (${CASH_CAMPAIGN_ID},${E2E_WEDDINGS.primary.id},'HONEYMOON','Guest honeymoon support','Optional honeymoon contribution.',1000,'USD',TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,0,'["CASH_TO_COUPLE","HONEYMOON_GIFT"]'::jsonb,${CASH_BUDGET_ID})
    `
    await prisma.$executeRaw`
      INSERT INTO wewed_contributions.campaigns
        (id,wedding_id,type,title,description,target_amount,currency,published,show_target,show_raised,invitation_visible,show_contributor_recognition,enabled,sort_order,accepted_types,budget_item_id,service_engagement_id)
      VALUES
        (${DIRECT_CAMPAIGN_ID},${E2E_WEDDINGS.primary.id},'WEDDING_SUPPORT','Photography direct support','Optional direct payment toward photography.',800,'USD',TRUE,TRUE,TRUE,TRUE,FALSE,TRUE,1,'["DIRECT_VENDOR_PAYMENT"]'::jsonb,${DIRECT_BUDGET_ID},${ENGAGEMENT_ID})
    `
    await prisma.$executeRaw`
      INSERT INTO wewed_contributions.campaigns
        (id,wedding_id,type,title,currency,published,enabled,sort_order,accepted_types,invitation_visible)
      VALUES
        (${SECONDARY_CAMPAIGN_ID},${E2E_WEDDINGS.secondary.id},'OTHER','Secondary wedding private campaign','USD',TRUE,TRUE,0,'["CASH_TO_COUPLE"]'::jsonb,TRUE)
    `
  } finally {
    await prisma.$disconnect()
  }
}

test('Planner governance controls acceptance, creation, publication and deterministic ordering', async ({ plannerPage: page }) => {
  await page.goto('/planner/contributions/settings')
  const panel = page.getByTestId('contribution-governance-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Accept Contributions: ON' })).toBeVisible()

  await panel.getByLabel('Disabled contributions message').fill('We are not accepting guest contributions right now.')
  await panel.getByRole('button', { name: 'Accept Contributions: ON' }).click()
  await expect(panel.getByRole('button', { name: 'Accept Contributions: OFF' })).toBeVisible()

  const settingsOff = await page.request.get('/api/planner/contribution-governance')
  expect(settingsOff.status()).toBe(200)
  expect(await settingsOff.json()).toMatchObject({
    settings: {
      acceptingContributions: false,
      disabledMessage: 'We are not accepting guest contributions right now.',
    },
  })

  await panel.getByRole('button', { name: 'Accept Contributions: OFF' }).click()
  await expect(panel.getByRole('button', { name: 'Accept Contributions: ON' })).toBeVisible()

  await panel.getByLabel('Contribution choice type').selectOption('HOME')
  await panel.getByLabel('Contribution choice title').fill('Future home essentials')
  await panel.getByLabel('Contribution choice description').fill('Optional support for our future home.')
  await panel.getByLabel('Contribution choice target').fill('500')
  await panel.getByLabel('Budget item').selectOption(`${E2E_WEDDINGS.primary.id}-budget`)
  await panel.getByRole('button', { name: 'Create private choice' }).click()
  const homeCard = panel.locator('[data-testid^="governance-campaign-"]').filter({ hasText: 'Future home essentials' })
  await expect(homeCard).toContainText('Private')

  await panel.getByLabel('Contribution choice type').selectOption('HONEYMOON')
  await panel.getByLabel('Contribution choice title').fill('Later honeymoon choice')
  await panel.getByLabel('Contribution choice description').fill('Second governed choice for ordering.')
  await panel.getByRole('button', { name: 'Create private choice' }).click()
  const honeymoonCard = panel.locator('[data-testid^="governance-campaign-"]').filter({ hasText: 'Later honeymoon choice' })
  await expect(honeymoonCard).toBeVisible()

  await honeymoonCard.getByRole('button', { name: 'Move Later honeymoon choice up' }).click()
  const ordered = await page.request.get('/api/planner/contribution-governance')
  const orderedBody = await ordered.json() as { campaigns: Array<{ title: string; sortOrder: number }> }
  expect(orderedBody.campaigns.map((campaign) => campaign.title)).toEqual([
    'Later honeymoon choice',
    'Future home essentials',
  ])
  expect(orderedBody.campaigns.map((campaign) => campaign.sortOrder)).toEqual([0, 1])

  const reorderedHome = panel.locator('[data-testid^="governance-campaign-"]').filter({ hasText: 'Future home essentials' })
  await reorderedHome.getByRole('button', { name: 'Publish' }).click()
  await expect(reorderedHome).toContainText('Published')
  await reorderedHome.getByRole('button', { name: 'Disable' }).click()
  await expect(reorderedHome).toContainText('Disabled')
  await reorderedHome.getByRole('button', { name: 'Enable' }).click()
  await expect(reorderedHome).toContainText('Enabled')
})

test('Guest pledge reaches Planner and Budget/vendor accounting without fabricating couple-paid money', async ({ plannerPage: page }) => {
  await seedPublicContributionFlow()
  const plannerCookies = await page.context().cookies()
  await page.context().clearCookies()

  const token = `${E2E_WEDDINGS.primary.slug}-rsvp-token`
  await page.goto(`/invite/${E2E_WEDDINGS.primary.slug}?rsvp=${encodeURIComponent(token)}&card=ivory-floral-gold`)
  await expect(page).toHaveURL(new RegExp(`/invite/${E2E_WEDDINGS.primary.slug}/open`))
  const browserLink = page.getByRole('link', { name: /^(Open wedding invitation|Continue to invitation in browser)$/ })
  await browserLink.click()

  const experience = page.getByTestId('premium-invitation-experience')
  const card = experience.getByTestId('invitation-trifold')
  await experience.getByTestId('invitation-open-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'open', { timeout: 4_000 })
  await experience.getByTestId('invitation-details-button').click()
  await expect(card).toHaveAttribute('data-invitation-view', 'details')
  await experience.getByTestId('invitation-cta-registry').click()
  await expect(page).toHaveURL(new RegExp(`/w/${E2E_WEDDINGS.primary.slug}#registry$`))

  const cashCard = page.getByTestId(`contribution-campaign-${CASH_CAMPAIGN_ID}`)
  await expect(cashCard).toContainText('Guest honeymoon support')
  await cashCard.getByRole('button', { name: 'Contribute through Wewed' }).click()
  const form = page.getByTestId(`contribution-pledge-form-${CASH_CAMPAIGN_ID}`)
  await expect(form).toBeVisible()
  await form.getByLabel('How would you like to contribute?').selectOption('CASH_TO_COUPLE')
  await form.getByLabel('Amount (USD)').fill('125')
  await form.getByLabel('Your name').fill('Primary Test Guest')
  await form.getByLabel('Email').fill('primary.guest@example.test')
  await form.getByLabel('Public thanks').check()
  await form.getByLabel('Note to the couple or planner').fill('Guest pledge E2E')
  await form.getByRole('button', { name: 'Record my contribution' }).click()
  await expect(page.getByTestId(`contribution-pledge-success-${CASH_CAMPAIGN_ID}`)).toBeVisible()

  const prisma = new PrismaClient()
  try {
    const cashRows = await prisma.$queryRaw<Array<{
      id: string
      contributorId: string
      type: string
      amount: string
      route: string
      commitmentState: string
      fulfillmentState: string
      publicRecognition: boolean
      anonymousPublic: boolean
    }>>`
      SELECT c.id,c.contributor_id AS "contributorId",c.type,c.amount::text AS amount,c.route,
             c.commitment_state AS "commitmentState",c.fulfillment_state AS "fulfillmentState",
             p.public_recognition AS "publicRecognition",p.anonymous_public AS "anonymousPublic"
        FROM wewed_contributions.wedding_contributions c
        JOIN wewed_contributions.contributors p ON p.id=c.contributor_id
       WHERE c.wedding_id=${E2E_WEDDINGS.primary.id} AND c.campaign_id=${CASH_CAMPAIGN_ID}
    `
    expect(cashRows).toHaveLength(1)
    expect(cashRows[0]).toMatchObject({
      type: 'CASH_TO_COUPLE',
      amount: '125.00',
      route: 'TO_COUPLE',
      commitmentState: 'PLEDGED',
      fulfillmentState: 'PENDING',
      publicRecognition: true,
      anonymousPublic: false,
    })

    const cashAllocations = await prisma.$queryRaw<Array<{ budgetItemId: string; amount: string; allocationKind: string }>>`
      SELECT budget_item_id AS "budgetItemId",amount::text AS amount,allocation_kind AS "allocationKind"
        FROM wewed_contributions.contribution_allocations
       WHERE contribution_id=${cashRows[0].id}
    `
    expect(cashAllocations).toEqual([{ budgetItemId: CASH_BUDGET_ID, amount: '125.00', allocationKind: 'CASH' }])
    expect(await prisma.budgetItem.findUnique({ where: { id: CASH_BUDGET_ID }, select: { paidAmount: true } })).toEqual({ paidAmount: 0 })
    const cashFunding = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM wewed_contributions.payment_funding_allocations WHERE contribution_id=${cashRows[0].id}`
    expect(Number(cashFunding[0].count)).toBe(0)
  } finally {
    await prisma.$disconnect()
  }

  const directResponse = await page.request.post(`/api/contribution-campaigns/${DIRECT_CAMPAIGN_ID}/pledge`, {
    data: {
      weddingSlug: E2E_WEDDINGS.primary.slug,
      type: 'DIRECT_VENDOR_PAYMENT',
      amount: 75,
      displayName: 'Primary Test Guest',
      recognition: 'private',
      note: 'Direct vendor E2E pledge',
    },
  })
  expect(directResponse.status()).toBe(201)
  const directBody = await directResponse.json() as { data: { id: string } }

  const securityResponse = await page.request.post(`/api/contribution-campaigns/${SECONDARY_CAMPAIGN_ID}/pledge`, {
    data: {
      weddingSlug: E2E_WEDDINGS.secondary.slug,
      type: 'CASH_TO_COUPLE',
      amount: 10,
      displayName: 'Primary Test Guest',
    },
  })
  expect(securityResponse.status()).toBe(404)

  const verify = new PrismaClient()
  try {
    const directRows = await verify.$queryRaw<Array<{ vendorId: string | null; serviceEngagementId: string | null; route: string; type: string }>>`
      SELECT vendor_id AS "vendorId",service_engagement_id AS "serviceEngagementId",route,type
        FROM wewed_contributions.wedding_contributions WHERE id=${directBody.data.id}
    `
    expect(directRows).toEqual([{
      vendorId: `${E2E_WEDDINGS.primary.id}-vendor`,
      serviceEngagementId: ENGAGEMENT_ID,
      route: 'DIRECT_TO_VENDOR',
      type: 'DIRECT_VENDOR_PAYMENT',
    }])
    const directAllocation = await verify.$queryRaw<Array<{ budgetItemId: string; allocationKind: string }>>`
      SELECT budget_item_id AS "budgetItemId",allocation_kind AS "allocationKind"
        FROM wewed_contributions.contribution_allocations WHERE contribution_id=${directBody.data.id}
    `
    expect(directAllocation).toEqual([{ budgetItemId: DIRECT_BUDGET_ID, allocationKind: 'DIRECT_PAYMENT' }])
    expect(await verify.budgetItem.findUnique({ where: { id: DIRECT_BUDGET_ID }, select: { paidAmount: true } })).toEqual({ paidAmount: 0 })
    expect(await verify.engagementPayment.count({ where: { serviceEngagementId: ENGAGEMENT_ID } })).toBe(0)
  } finally {
    await verify.$disconnect()
  }

  await page.context().clearCookies()
  await page.context().addCookies(plannerCookies)
  await page.goto('/planner/contributions#planner-workspace')
  const workspace = page.getByTestId('planner-contributions-workspace')
  await expect(workspace).toContainText('Guest honeymoon support')
  await expect(workspace).toContainText('Photography direct support')

  const disable = await page.request.patch('/api/planner/contribution-governance', {
    data: { scope: 'settings', acceptingContributions: false, disabledMessage: 'Contributions are closed for this wedding.' },
  })
  expect(disable.status()).toBe(200)
  await page.goto(`/w/${E2E_WEDDINGS.primary.slug}?site=1#registry`)
  await expect(page.getByTestId('contributions-disabled-state')).toContainText('Contributions are closed for this wedding.')

  const retained = new PrismaClient()
  try {
    const retainedRows = await retained.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM wewed_contributions.wedding_contributions
       WHERE wedding_id=${E2E_WEDDINGS.primary.id} AND campaign_id IN (${CASH_CAMPAIGN_ID},${DIRECT_CAMPAIGN_ID})
    `
    expect(Number(retainedRows[0].count)).toBe(2)
  } finally {
    await retained.$disconnect()
  }
})
