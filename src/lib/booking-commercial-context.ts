import 'server-only'

import { db } from '@/lib/db'

export type BookingCommercialContext = {
  bookingId: string
  serviceEngagementId: string | null
  budget: null | {
    id: string
    estimatedCost: number
    actualCost: number | null
    paidAmount: number
    currency: string
    dueDate: Date | null
  }
  contract: null | { id: string; contractNumber: string; status: string; currentVersionNumber: number }
  paymentMilestones: Array<{
    id: string
    milestoneType: string
    label: string
    amount: string
    currency: string
    dueAt: Date | null
    status: string
    sequence: number
  }>
  paymentFacts: Array<{
    id: string
    entryType: string
    amount: string
    currency: string
    paidAt: Date
    method: string | null
    reference: string | null
    source: string
  }>
  contributions: Array<{
    id: string
    type: string
    title: string
    amount: string | null
    currency: string
    estimatedValue: string | null
    estimatedValueCurrency: string | null
    commitmentState: string
    fulfillmentState: string
    verificationState: string
    route: string
    allocationAmount: string | null
    allocationCurrency: string | null
    allocationKind: string | null
  }>
  fundingAllocations: Array<{
    id: string
    sourceKind: string
    amount: string
    currency: string
    contributionId: string | null
    paymentId: string | null
    reconciledAt: Date | null
  }>
  conversationId: string | null
}

export async function listWeddingBookingCommercialContext(weddingId: string): Promise<BookingCommercialContext[]> {
  const bookings = await db.$queryRawUnsafe<Array<{ id: string; serviceEngagementId: string | null }>>(
    `SELECT id,"serviceEngagementId" FROM wewed_booking."Booking" WHERE "weddingId"=$1 ORDER BY "createdAt" DESC`,
    weddingId,
  )
  if (!bookings.length) return []
  const bookingIds = bookings.map((row) => row.id)
  const engagementIds = bookings.map((row) => row.serviceEngagementId).filter((value): value is string => Boolean(value))

  const budgets = engagementIds.length ? await db.$queryRawUnsafe<Array<{
    id: string; serviceEngagementId: string; estimatedCost: number; actualCost: number | null; paidAmount: number; currency: string; dueDate: Date | null
  }>>(
    `SELECT id,"serviceEngagementId","estimatedCost","actualCost","paidAmount",currency,"dueDate"
       FROM public."BudgetItem"
      WHERE "weddingId"=$1 AND "serviceEngagementId"=ANY($2::text[])
      ORDER BY "createdAt"`,
    weddingId,
    engagementIds,
  ) : []
  const budgetByEngagement = new Map(budgets.map((row) => [row.serviceEngagementId, row]))
  const budgetIds = budgets.map((row) => row.id)

  const contracts = engagementIds.length ? await db.$queryRawUnsafe<Array<{
    id: string; serviceEngagementId: string; contractNumber: string; status: string; currentVersionNumber: number
  }>>(
    `SELECT DISTINCT ON ("serviceEngagementId") id,"serviceEngagementId","contractNumber",status,"currentVersionNumber"
       FROM public."Contract"
      WHERE "weddingId"=$1 AND "serviceEngagementId"=ANY($2::text[])
      ORDER BY "serviceEngagementId","createdAt" DESC`,
    weddingId,
    engagementIds,
  ) : []
  const contractByEngagement = new Map(contracts.map((row) => [row.serviceEngagementId, row]))

  const milestones = engagementIds.length ? await db.$queryRawUnsafe<Array<{
    id: string; serviceEngagementId: string; milestoneType: string; label: string; amount: string; currency: string; dueAt: Date | null; status: string; sequence: number
  }>>(
    `SELECT id,"serviceEngagementId","milestoneType",label,amount::text AS amount,currency,"dueAt",status,sequence
       FROM wewed_contracts."PaymentMilestone"
      WHERE "weddingId"=$1 AND "serviceEngagementId"=ANY($2::text[])
      ORDER BY "serviceEngagementId",sequence,"createdAt"`,
    weddingId,
    engagementIds,
  ) : []

  const payments = engagementIds.length ? await db.$queryRawUnsafe<Array<{
    id: string; serviceEngagementId: string; entryType: string; amount: string; currency: string; paidAt: Date; method: string | null; reference: string | null; source: string
  }>>(
    `SELECT id,"serviceEngagementId","entryType",amount::text AS amount,currency,"paidAt",method,reference,source
       FROM wewed_contracts."ManagedPaymentRecord"
      WHERE "weddingId"=$1 AND "serviceEngagementId"=ANY($2::text[])
      ORDER BY "serviceEngagementId","paidAt","createdAt"`,
    weddingId,
    engagementIds,
  ) : []

  const directContributions = engagementIds.length ? await db.$queryRawUnsafe<Array<{
    id: string; serviceEngagementId: string; type: string; title: string; amount: string | null; currency: string; estimatedValue: string | null; estimatedValueCurrency: string | null; commitmentState: string; fulfillmentState: string; verificationState: string; route: string
  }>>(
    `SELECT id,service_engagement_id AS "serviceEngagementId",type,title,amount::text AS amount,currency,
            estimated_value::text AS "estimatedValue",estimated_value_currency AS "estimatedValueCurrency",
            commitment_state AS "commitmentState",fulfillment_state AS "fulfillmentState",verification_state AS "verificationState",route
       FROM wewed_contributions.wedding_contributions
      WHERE wedding_id=$1 AND service_engagement_id=ANY($2::text[])
      ORDER BY created_at`,
    weddingId,
    engagementIds,
  ) : []

  const allocatedContributions = budgetIds.length ? await db.$queryRawUnsafe<Array<{
    id: string; serviceEngagementId: string; type: string; title: string; amount: string | null; currency: string; estimatedValue: string | null; estimatedValueCurrency: string | null; commitmentState: string; fulfillmentState: string; verificationState: string; route: string; allocationAmount: string; allocationCurrency: string; allocationKind: string
  }>>(
    `SELECT wc.id,bi."serviceEngagementId",wc.type,wc.title,wc.amount::text AS amount,wc.currency,
            wc.estimated_value::text AS "estimatedValue",wc.estimated_value_currency AS "estimatedValueCurrency",
            wc.commitment_state AS "commitmentState",wc.fulfillment_state AS "fulfillmentState",wc.verification_state AS "verificationState",wc.route,
            ca.amount::text AS "allocationAmount",ca.currency AS "allocationCurrency",ca.allocation_kind AS "allocationKind"
       FROM wewed_contributions.contribution_allocations ca
       JOIN public."BudgetItem" bi ON bi.id=ca.budget_item_id
       JOIN wewed_contributions.wedding_contributions wc ON wc.id=ca.contribution_id
      WHERE ca.wedding_id=$1 AND ca.budget_item_id=ANY($2::text[])
      ORDER BY ca.created_at`,
    weddingId,
    budgetIds,
  ) : []

  const funding = budgetIds.length ? await db.$queryRawUnsafe<Array<{
    id: string; budgetItemId: string | null; sourceKind: string; amount: string; currency: string; contributionId: string | null; paymentId: string | null; reconciledAt: Date | null
  }>>(
    `SELECT id,budget_item_id AS "budgetItemId",source_kind AS "sourceKind",amount::text AS amount,currency,
            contribution_id AS "contributionId",payment_id AS "paymentId",reconciled_at AS "reconciledAt"
       FROM wewed_contributions.payment_funding_allocations
      WHERE wedding_id=$1 AND budget_item_id=ANY($2::text[])
      ORDER BY created_at`,
    weddingId,
    budgetIds,
  ) : []

  const conversations = await db.$queryRawUnsafe<Array<{ bookingId: string; conversationId: string }>>(
    `SELECT cel."entityId" AS "bookingId",cel."conversationId"
       FROM wewed_communications."CommunicationEntityLink" cel
       JOIN wewed_communications."CommunicationConversation" cc ON cc.id=cel."conversationId"
      WHERE cel."entityType"='booking' AND cel."entityId"=ANY($1::text[]) AND cc."weddingId"=$2 AND cc.status='OPEN'`,
    bookingIds,
    weddingId,
  )
  const conversationByBooking = new Map(conversations.map((row) => [row.bookingId,row.conversationId]))

  return bookings.map((booking) => {
    const engagementId = booking.serviceEngagementId
    const budget = engagementId ? budgetByEngagement.get(engagementId) ?? null : null
    const direct = engagementId ? directContributions.filter((row) => row.serviceEngagementId===engagementId) : []
    const allocated = engagementId ? allocatedContributions.filter((row) => row.serviceEngagementId===engagementId) : []
    const directIds = new Set(direct.map((row) => row.id))
    const contributionRows = [
      ...direct.map((row) => ({ ...row, allocationAmount: null, allocationCurrency: null, allocationKind: null })),
      ...allocated.filter((row) => !directIds.has(row.id)),
    ]
    return {
      bookingId: booking.id,
      serviceEngagementId: engagementId,
      budget: budget ? {
        id: budget.id,
        estimatedCost: Number(budget.estimatedCost),
        actualCost: budget.actualCost == null ? null : Number(budget.actualCost),
        paidAmount: Number(budget.paidAmount),
        currency: budget.currency,
        dueDate: budget.dueDate,
      } : null,
      contract: engagementId ? contractByEngagement.get(engagementId) ?? null : null,
      paymentMilestones: engagementId ? milestones.filter((row) => row.serviceEngagementId===engagementId).map(({ serviceEngagementId: _serviceEngagementId, ...row }) => row) : [],
      paymentFacts: engagementId ? payments.filter((row) => row.serviceEngagementId===engagementId).map(({ serviceEngagementId: _serviceEngagementId, ...row }) => row) : [],
      contributions: contributionRows.map(({ serviceEngagementId: _serviceEngagementId, ...row }) => row),
      fundingAllocations: budget ? funding.filter((row) => row.budgetItemId===budget.id).map(({ budgetItemId: _budgetItemId, ...row }) => row) : [],
      conversationId: conversationByBooking.get(booking.id) ?? null,
    }
  })
}
