import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { contributionAvailableAmount, summarizeContributions } from '@/lib/contributions'

type SqlClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>

function asNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function iso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null
}

export function contributionId(): string {
  return `wwc_${randomUUID()}`
}

export interface ContributorRow {
  id: string
  weddingId: string
  displayName: string
  legalName: string | null
  kind: string
  relationship: string | null
  email: string | null
  phone: string | null
  address: string | null
  preferredContactMethod: string | null
  notes: string | null
  publicRecognition: boolean
  anonymousPublic: boolean
  guestId: string | null
  createdAt: Date
  updatedAt: Date
}

interface ContributionDbRow {
  id: string
  weddingId: string
  contributorId: string
  campaignId: string | null
  vendorId: string | null
  serviceEngagementId: string | null
  type: string
  title: string
  description: string | null
  amount: string | null
  currency: string
  estimatedValue: string | null
  estimatedValueCurrency: string | null
  quantity: string | null
  unit: string | null
  route: string
  commitmentState: string
  fulfillmentState: string
  verificationState: string
  thankYouState: string
  pledgedAt: Date | null
  expectedAt: Date | null
  fulfilledAt: Date | null
  notes: string | null
  source: string
  createdAt: Date
  updatedAt: Date
  contributorName: string
  contributorEmail: string | null
  contributorRelationship: string | null
  campaignTitle: string | null
  vendorName: string | null
  engagementCategory: string | null
  engagementDescription: string | null
}

interface AllocationDbRow {
  id: string
  contributionId: string
  budgetItemId: string
  amount: string
  currency: string
  allocationKind: string
  note: string | null
  budgetDescription: string
  budgetCategory: string
}

interface FundingDbRow {
  id: string
  contributionId: string | null
  budgetItemId: string | null
  paymentId: string | null
  sourceKind: string
  amount: string
  currency: string
  reconciledAt: Date | null
  paymentReference: string | null
  paymentPaidAt: Date | null
}

interface TaskLinkDbRow {
  contributionId: string
  plannerTaskId: string
  linkRole: string
  title: string
  status: string
  dueDate: Date | null
}

export interface CampaignDbRow {
  id: string
  weddingId: string
  type: string
  title: string
  description: string | null
  targetAmount: string | null
  currency: string
  published: boolean
  showTarget: boolean
  showRaised: boolean
  externalUrl: string | null
  ctaLabel: string | null
  invitationVisible: boolean
  showContributorRecognition: boolean
  publicNote: string | null
  publishFrom: Date | null
  publishUntil: Date | null
  createdAt: Date
  updatedAt: Date
}

export async function listContributors(weddingId: string, client: SqlClient = db): Promise<ContributorRow[]> {
  return client.$queryRaw<ContributorRow[]>`
    SELECT id,
           wedding_id AS "weddingId",
           display_name AS "displayName",
           legal_name AS "legalName",
           kind,
           relationship,
           email,
           phone,
           address,
           preferred_contact_method AS "preferredContactMethod",
           notes,
           public_recognition AS "publicRecognition",
           anonymous_public AS "anonymousPublic",
           guest_id AS "guestId",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
      FROM wewed_contributions.contributors
     WHERE wedding_id = ${weddingId}
     ORDER BY lower(display_name), created_at
  `
}

export async function listCampaigns(weddingId: string, client: SqlClient = db): Promise<Array<ReturnType<typeof serializeCampaign>>> {
  const rows = await client.$queryRaw<CampaignDbRow[]>`
    SELECT id, wedding_id AS "weddingId", type, title, description,
           target_amount::text AS "targetAmount", currency, published,
           show_target AS "showTarget", show_raised AS "showRaised",
           external_url AS "externalUrl", cta_label AS "ctaLabel",
           invitation_visible AS "invitationVisible", show_contributor_recognition AS "showContributorRecognition", public_note AS "publicNote",
           publish_from AS "publishFrom", publish_until AS "publishUntil",
           created_at AS "createdAt", updated_at AS "updatedAt"
      FROM wewed_contributions.campaigns
     WHERE wedding_id = ${weddingId}
     ORDER BY created_at DESC
  `
  const raised = await client.$queryRaw<Array<{ campaignId: string; currency: string; raised: string }>>`
    SELECT campaign_id AS "campaignId", currency, COALESCE(SUM(amount), 0)::text AS raised
      FROM wewed_contributions.wedding_contributions
     WHERE wedding_id = ${weddingId}
       AND campaign_id IS NOT NULL
       AND fulfillment_state IN ('RECEIVED','PAID_DIRECT','COMPLETED')
       AND amount IS NOT NULL
     GROUP BY campaign_id, currency
  `
  return rows.map((row) => serializeCampaign(row, raised.find((item) => item.campaignId === row.id && item.currency === row.currency)?.raised))
}

function serializeCampaign(row: CampaignDbRow, raised = '0') {
  return {
    id: row.id,
    weddingId: row.weddingId,
    type: row.type,
    title: row.title,
    description: row.description,
    targetAmount: asNumber(row.targetAmount),
    currency: row.currency,
    published: row.published,
    showTarget: row.showTarget,
    showRaised: row.showRaised,
    externalUrl: row.externalUrl,
    ctaLabel: row.ctaLabel,
    invitationVisible: row.invitationVisible,
    showContributorRecognition: row.showContributorRecognition,
    publicNote: row.publicNote,
    publishFrom: iso(row.publishFrom),
    publishUntil: iso(row.publishUntil),
    raised: asNumber(raised) ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function loadContributionWorkspace(weddingId: string) {
  const [rows, allocations, funding, taskLinks, contributors, campaigns] = await Promise.all([
    db.$queryRaw<ContributionDbRow[]>`
      SELECT c.id, c.wedding_id AS "weddingId", c.contributor_id AS "contributorId",
             c.campaign_id AS "campaignId", c.vendor_id AS "vendorId",
             c.service_engagement_id AS "serviceEngagementId", c.type, c.title,
             c.description, c.amount::text AS amount, c.currency,
             c.estimated_value::text AS "estimatedValue",
             c.estimated_value_currency AS "estimatedValueCurrency",
             c.quantity::text AS quantity, c.unit, c.route,
             c.commitment_state AS "commitmentState",
             c.fulfillment_state AS "fulfillmentState",
             c.verification_state AS "verificationState",
             c.thank_you_state AS "thankYouState",
             c.pledged_at AS "pledgedAt", c.expected_at AS "expectedAt",
             c.fulfilled_at AS "fulfilledAt", c.notes, c.source,
             c.created_at AS "createdAt", c.updated_at AS "updatedAt",
             p.display_name AS "contributorName", p.email AS "contributorEmail",
             p.relationship AS "contributorRelationship",
             camp.title AS "campaignTitle", v.name AS "vendorName",
             se."serviceCategory" AS "engagementCategory",
             se."serviceDescription" AS "engagementDescription"
        FROM wewed_contributions.wedding_contributions c
        JOIN wewed_contributions.contributors p ON p.id = c.contributor_id
        LEFT JOIN wewed_contributions.campaigns camp ON camp.id = c.campaign_id
        LEFT JOIN public."Vendor" v ON v.id = c.vendor_id
        LEFT JOIN public."ServiceEngagement" se ON se.id = c.service_engagement_id
       WHERE c.wedding_id = ${weddingId}
       ORDER BY COALESCE(c.fulfilled_at, c.created_at) DESC, c.created_at DESC
    `,
    db.$queryRaw<AllocationDbRow[]>`
      SELECT a.id, a.contribution_id AS "contributionId", a.budget_item_id AS "budgetItemId",
             a.amount::text AS amount, a.currency, a.allocation_kind AS "allocationKind",
             a.note, b.description AS "budgetDescription", b.category AS "budgetCategory"
        FROM wewed_contributions.contribution_allocations a
        JOIN public."BudgetItem" b ON b.id = a.budget_item_id
       WHERE a.wedding_id = ${weddingId}
       ORDER BY a.created_at
    `,
    db.$queryRaw<FundingDbRow[]>`
      SELECT f.id, f.contribution_id AS "contributionId", f.budget_item_id AS "budgetItemId",
             f.payment_id AS "paymentId", f.source_kind AS "sourceKind",
             f.amount::text AS amount, f.currency, f.reconciled_at AS "reconciledAt",
             ep.reference AS "paymentReference", ep."paidAt" AS "paymentPaidAt"
        FROM wewed_contributions.payment_funding_allocations f
        LEFT JOIN public."EngagementPayment" ep ON ep.id = f.payment_id
       WHERE f.wedding_id = ${weddingId}
       ORDER BY f.created_at
    `,
    db.$queryRaw<TaskLinkDbRow[]>`
      SELECT l.contribution_id AS "contributionId", l.planner_task_id AS "plannerTaskId",
             l.link_role AS "linkRole", t.title, t.status, t."dueDate" AS "dueDate"
        FROM wewed_contributions.task_links l
        JOIN public."PlannerTask" t ON t.id = l.planner_task_id
       WHERE l.wedding_id = ${weddingId}
       ORDER BY l.created_at
    `,
    listContributors(weddingId),
    listCampaigns(weddingId),
  ])

  const data = rows.map((row) => {
    const rowAllocations = allocations.filter((item) => item.contributionId === row.id).map((item) => ({
      id: item.id,
      budgetItemId: item.budgetItemId,
      amount: Number(item.amount),
      currency: item.currency,
      allocationKind: item.allocationKind,
      note: item.note,
      budgetItem: { id: item.budgetItemId, description: item.budgetDescription, category: item.budgetCategory },
    }))
    const allocationCash = rowAllocations
      .filter((item) => item.allocationKind === 'CASH')
      .reduce((sum, item) => sum + item.amount, 0)
    const paymentOnlyCash = funding
      .filter((item) => item.contributionId === row.id && item.sourceKind === 'CONTRIBUTION' && item.paymentId && !item.budgetItemId)
      .reduce((sum, item) => sum + Number(item.amount), 0)
    const allocatedAmount = allocationCash + paymentOnlyCash
    const amount = asNumber(row.amount)
    const directVendorPaidAmount = row.type === 'DIRECT_VENDOR_PAYMENT'
      ? funding.filter((item) => item.contributionId === row.id && item.sourceKind === 'CONTRIBUTION' && item.paymentId).reduce((sum, item) => sum + Number(item.amount), 0)
      : 0
    const remainingAmount = row.type === 'DIRECT_VENDOR_PAYMENT'
      ? Math.max(0, (amount ?? 0) - directVendorPaidAmount)
      : 0
    return {
      id: row.id,
      weddingId: row.weddingId,
      type: row.type,
      title: row.title,
      description: row.description,
      amount,
      directVendorPaidAmount,
      remainingAmount,
      currency: row.currency,
      estimatedValue: asNumber(row.estimatedValue),
      estimatedValueCurrency: row.estimatedValueCurrency,
      quantity: asNumber(row.quantity),
      unit: row.unit,
      route: row.route,
      commitmentState: row.commitmentState,
      fulfillmentState: row.fulfillmentState,
      verificationState: row.verificationState,
      thankYouState: row.thankYouState,
      pledgedAt: iso(row.pledgedAt),
      expectedAt: iso(row.expectedAt),
      fulfilledAt: iso(row.fulfilledAt),
      notes: row.notes,
      source: row.source,
      contributor: {
        id: row.contributorId,
        displayName: row.contributorName,
        email: row.contributorEmail,
        relationship: row.contributorRelationship,
      },
      campaign: row.campaignId ? { id: row.campaignId, title: row.campaignTitle ?? 'Campaign' } : null,
      vendor: row.vendorId ? { id: row.vendorId, name: row.vendorName ?? 'Vendor' } : null,
      serviceEngagement: row.serviceEngagementId ? {
        id: row.serviceEngagementId,
        serviceCategory: row.engagementCategory,
        serviceDescription: row.engagementDescription,
      } : null,
      allocations: rowAllocations,
      paymentFundingAllocations: funding.filter((item) => item.contributionId === row.id).map((item) => ({
        id: item.id,
        budgetItemId: item.budgetItemId,
        paymentId: item.paymentId,
        sourceKind: item.sourceKind,
        amount: Number(item.amount),
        currency: item.currency,
        reconciledAt: iso(item.reconciledAt),
        paymentReference: item.paymentReference,
        paymentPaidAt: iso(item.paymentPaidAt),
      })),
      taskLinks: taskLinks.filter((item) => item.contributionId === row.id).map((item) => ({
        plannerTask: { id: item.plannerTaskId, title: item.title, status: item.status, dueDate: iso(item.dueDate) },
        linkRole: item.linkRole,
      })),
      allocatedAmount,
      availableAmount: contributionAvailableAmount({
        type: row.type,
        amount,
        fulfillmentState: row.fulfillmentState,
        allocatedAmount,
      }),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  })

  return {
    data,
    contributors,
    campaigns,
    summaryByCurrency: summarizeContributions(data),
    counts: {
      contributors: contributors.length,
      pledged: data.filter((item) => item.commitmentState === 'PLEDGED' && !['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(item.fulfillmentState)).length,
      toThank: data.filter((item) => ['TO_THANK','PREPARED'].includes(item.thankYouState)).length,
    },
  }
}

export async function getContribution(weddingId: string, contributionIdValue: string, client: SqlClient = db) {
  const rows = await client.$queryRaw<Array<{
    id: string
    type: string
    amount: string | null
    currency: string
    fulfillmentState: string
    verificationState: string
    contributorName: string
    title: string
  }>>`
    SELECT c.id, c.type, c.amount::text AS amount, c.currency,
           c.fulfillment_state AS "fulfillmentState",
           c.verification_state AS "verificationState",
           p.display_name AS "contributorName", c.title
      FROM wewed_contributions.wedding_contributions c
      JOIN wewed_contributions.contributors p ON p.id = c.contributor_id
     WHERE c.wedding_id = ${weddingId} AND c.id = ${contributionIdValue}
     LIMIT 1
  `
  return rows[0] ? { ...rows[0], amount: asNumber(rows[0].amount) } : null
}

export async function contributionAllocatedCash(weddingId: string, contributionIdValue: string, client: SqlClient = db): Promise<number> {
  const rows = await client.$queryRaw<Array<{ total: string }>>`
    SELECT (
      COALESCE((SELECT SUM(amount) FROM wewed_contributions.contribution_allocations
        WHERE wedding_id = ${weddingId} AND contribution_id = ${contributionIdValue} AND allocation_kind = 'CASH'), 0)
      +
      COALESCE((SELECT SUM(amount) FROM wewed_contributions.payment_funding_allocations
        WHERE wedding_id = ${weddingId} AND contribution_id = ${contributionIdValue}
          AND source_kind = 'CONTRIBUTION' AND payment_id IS NOT NULL AND budget_item_id IS NULL), 0)
    )::text AS total
  `
  return Number(rows[0]?.total ?? 0)
}

export async function budgetFundingRows(weddingId: string) {
  return db.$queryRaw<Array<{
    id: string
    budgetItemId: string
    contributionId: string | null
    sourceKind: string
    amount: string
    currency: string
  }>>`
    SELECT id, budget_item_id AS "budgetItemId", contribution_id AS "contributionId",
           source_kind AS "sourceKind", amount::text AS amount, currency
      FROM wewed_contributions.payment_funding_allocations
     WHERE wedding_id = ${weddingId} AND budget_item_id IS NOT NULL
  `
}

export async function budgetContributionAllocations(weddingId: string) {
  return db.$queryRaw<Array<{
    budgetItemId: string
    contributionId: string
    allocationKind: string
    amount: string
    currency: string
    fulfillmentState: string
  }>>`
    SELECT a.budget_item_id AS "budgetItemId", a.contribution_id AS "contributionId",
           a.allocation_kind AS "allocationKind", a.amount::text AS amount, a.currency,
           c.fulfillment_state AS "fulfillmentState"
      FROM wewed_contributions.contribution_allocations a
      JOIN wewed_contributions.wedding_contributions c ON c.id = a.contribution_id
     WHERE a.wedding_id = ${weddingId}
  `
}


export async function budgetContributionContexts(weddingId: string) {
  return db.$queryRaw<Array<{
    budgetItemId: string
    contributionId: string
    allocationKind: string
    allocationAmount: string
    currency: string
    contributorName: string
    title: string
    notes: string | null
    type: string
    commitmentState: string
    fulfillmentState: string
    contributionAmount: string | null
    directPaidAmount: string
  }>>`
    SELECT a.budget_item_id AS "budgetItemId",
           a.contribution_id AS "contributionId",
           a.allocation_kind AS "allocationKind",
           a.amount::text AS "allocationAmount",
           a.currency,
           p.display_name AS "contributorName",
           c.title,
           c.notes,
           c.type,
           c.commitment_state AS "commitmentState",
           c.fulfillment_state AS "fulfillmentState",
           c.amount::text AS "contributionAmount",
           COALESCE((
             SELECT SUM(f.amount)
               FROM wewed_contributions.payment_funding_allocations f
              WHERE f.wedding_id = ${weddingId}
                AND f.contribution_id = c.id
                AND f.source_kind = 'CONTRIBUTION'
                AND f.payment_id IS NOT NULL
           ), 0)::text AS "directPaidAmount"
      FROM wewed_contributions.contribution_allocations a
      JOIN wewed_contributions.wedding_contributions c ON c.id = a.contribution_id
      JOIN wewed_contributions.contributors p ON p.id = c.contributor_id
     WHERE a.wedding_id = ${weddingId}
       AND a.budget_item_id IS NOT NULL
     ORDER BY a.created_at
  `
}
