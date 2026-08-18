import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import {
  createVaultLink,
  prepareVaultUpload,
  registerPreparedVaultObject,
  removePreparedVaultUpload,
} from '@/lib/vault/core'

export class Phase4GovernanceError extends Error {
  constructor(message: string, readonly status = 400, readonly field?: string) {
    super(message)
    this.name = 'Phase4GovernanceError'
  }
}

type PaymentMilestoneRow = {
  id: string
  serviceEngagementId: string
  weddingId: string
  contractId: string | null
  contractVersionId: string | null
  milestoneType: string
  label: string
  description: string | null
  amount: string
  currency: string
  dueAt: Date | null
  status: string
  sequence: number
  proofRequired: boolean
  createdById: string
  createdAt: Date
  updatedAt: Date
}

type ManagedPaymentRow = {
  id: string
  serviceEngagementId: string
  weddingId: string
  milestoneId: string | null
  entryType: 'PAYMENT' | 'REFUND' | 'REVERSAL'
  amount: string
  currency: string
  paidAt: Date
  method: string | null
  reference: string | null
  notes: string | null
  source: string
  proofRequired: boolean
  proofWaiverReason: string | null
  proofVaultObjectId: string | null
  reversesPaymentId: string | null
  recordedById: string
  recordNature: string
  wewedProcessorRole: string
  custodyStatus: string
  createdAt: Date
}

type DisputeCaseRow = {
  id: string
  weddingId: string
  serviceEngagementId: string
  contractId: string | null
  contractVersionId: string | null
  status: string
  summary: string
  openedById: string
  openedAt: Date
  closedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type DisputeIssueRow = {
  id: string
  disputeCaseId: string
  clauseReference: string | null
  category: string
  allegationText: string
  status: string
  findingStatus: string
  createdById: string
  createdAt: Date
  updatedAt: Date
}

type DisputeEventRow = {
  id: string
  disputeCaseId: string
  issueId: string | null
  eventType: string
  source: string
  actorId: string
  actorPartyId: string | null
  note: string
  metadata: unknown
  createdAt: Date
}

type DisputeOutcomeRow = {
  id: string
  disputeCaseId: string
  weddingId: string
  source: string
  outcomeSummary: string
  remedyType: string
  amount: string | null
  currency: string | null
  externalReference: string | null
  evidenceVaultObjectId: string | null
  recordedById: string
  recordedAt: Date
  wewedAdjudicationRole: string
}

type EvidenceHoldRow = {
  id: string
  weddingId: string
  vaultObjectId: string
  disputeCaseId: string | null
  reason: string
  status: string
  placedById: string
  placedAt: Date
  releasedById: string | null
  releasedAt: Date | null
  releaseReason: string | null
}

const MILESTONE_TYPES = new Set([
  'DEPOSIT',
  'INSTALLMENT',
  'PRE_EVENT_BALANCE',
  'POST_EVENT_DELIVERY',
  'SECURITY_DAMAGE_DEPOSIT',
  'CUSTOM',
])
const PAYMENT_ENTRY_TYPES = new Set(['PAYMENT', 'REFUND'])
const PAYMENT_SOURCES = new Set(['MANUAL_FACT', 'EXTERNAL_PROCESSOR_FACT', 'CORRECTION_FACT'])
const DISPUTE_EVENT_TYPES = new Set([
  'NOTICE_RECORDED',
  'PARTY_RESPONSE_RECORDED',
  'NEGOTIATION_NOTE',
])
const DISPUTE_EVENT_SOURCES = new Set(['IN_APP_ACTOR', 'EXTERNAL_REPORTED'])
const OUTCOME_SOURCES = new Set(['MUTUAL_SETTLEMENT', 'EXTERNAL_ADJUDICATION', 'COURT_ORDER', 'WITHDRAWAL'])
const REMEDY_TYPES = new Set(['NONE', 'REFUND', 'SERVICE_CREDIT', 'FEE_ADJUSTMENT', 'REPERFORMANCE', 'CUSTOM'])

function text(value: unknown, max = 4000): string {
  return typeof value === 'string' ? value.normalize('NFKC').trim().slice(0, max) : ''
}

function optionalText(value: unknown, max = 4000): string | null {
  return text(value, max) || null
}

function currency(value: unknown): string {
  const result = text(value, 3).toUpperCase()
  if (!/^[A-Z]{3}$/.test(result)) throw new Phase4GovernanceError('Currency must use a three-letter ISO code.', 400, 'currency')
  return result
}

function amount(value: unknown, field = 'amount'): number {
  const result = Number(value)
  if (!Number.isFinite(result) || result <= 0) throw new Phase4GovernanceError('Amount must be greater than zero.', 400, field)
  return Math.round(result * 100) / 100
}

function nonNegativeAmount(value: unknown, field = 'amount'): number | null {
  if (value === null || value === undefined || value === '') return null
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0) throw new Phase4GovernanceError('Amount must be zero or greater.', 400, field)
  return Math.round(result * 100) / 100
}

function dateValue(value: unknown, field: string, required = false): Date | null {
  const raw = text(value, 80)
  if (!raw && !required) return null
  const result = new Date(raw)
  if (!raw || Number.isNaN(result.getTime())) throw new Phase4GovernanceError(`${field} is invalid.`, 400, field)
  return result
}

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01
}

function decimal(value: unknown): number {
  if (value === null || value === undefined) return 0
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

async function engagementOrThrow(weddingId: string, engagementId: string) {
  const engagement = await db.serviceEngagement.findFirst({
    where: { id: engagementId, weddingId },
    include: {
      vendor: true,
      budgetItems: true,
      payments: { orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }] },
      contracts: {
        include: { versions: { orderBy: { versionNumber: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!engagement) throw new Phase4GovernanceError('Service engagement was not found in this wedding.', 404)
  return engagement
}

function effectiveContractAmount(engagement: Awaited<ReturnType<typeof engagementOrThrow>>): { amount: number | null; contractId: string | null; versionId: string | null; source: string } {
  for (const contract of engagement.contracts) {
    const version = contract.versions.find((item) => item.status === 'EFFECTIVE')
      ?? contract.versions.find((item) => item.status === 'SUPERSEDED')
    if (!version) continue
    try {
      const canonical = JSON.parse(version.canonicalJson) as { service?: { agreedAmount?: string | number | null } }
      if (canonical?.service?.agreedAmount !== null && canonical?.service?.agreedAmount !== undefined && canonical.service.agreedAmount !== '') {
        return { amount: decimal(canonical.service.agreedAmount), contractId: contract.id, versionId: version.id, source: 'governed_contract_version' }
      }
    } catch {
      // Fall back to the engagement amount; a malformed canonical artifact is surfaced by contract governance separately.
    }
  }
  return {
    amount: engagement.agreedAmount === null ? null : decimal(engagement.agreedAmount),
    contractId: null,
    versionId: null,
    source: 'service_engagement',
  }
}

function paymentSign(row: ManagedPaymentRow, byId: Map<string, ManagedPaymentRow>): number {
  if (row.entryType === 'PAYMENT') return 1
  if (row.entryType === 'REFUND') return -1
  const original = row.reversesPaymentId ? byId.get(row.reversesPaymentId) : null
  if (!original) return 0
  return -paymentSign(original, byId)
}

function computeManagedNet(rows: ManagedPaymentRow[]): number {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return Math.round(rows.reduce((sum, row) => sum + paymentSign(row, byId) * decimal(row.amount), 0) * 100) / 100
}

function milestonePaid(rows: ManagedPaymentRow[], milestoneId: string): number {
  return computeManagedNet(rows.filter((row) => row.milestoneId === milestoneId))
}

async function phase4Rows(engagementId: string, weddingId: string) {
  const [milestones, payments, disputes, issues, events, outcomes, holds] = await Promise.all([
    db.$queryRawUnsafe<PaymentMilestoneRow[]>(
      `SELECT * FROM wewed_contracts."PaymentMilestone" WHERE "serviceEngagementId"=$1 AND "weddingId"=$2 ORDER BY "sequence", "dueAt" NULLS LAST, "createdAt", "id"`, engagementId, weddingId,
    ),
    db.$queryRawUnsafe<ManagedPaymentRow[]>(
      `SELECT * FROM wewed_contracts."ManagedPaymentRecord" WHERE "serviceEngagementId"=$1 AND "weddingId"=$2 ORDER BY "paidAt", "createdAt", "id"`, engagementId, weddingId,
    ),
    db.$queryRawUnsafe<DisputeCaseRow[]>(
      `SELECT * FROM wewed_contracts."DisputeCase" WHERE "serviceEngagementId"=$1 AND "weddingId"=$2 ORDER BY "openedAt" DESC, "id"`, engagementId, weddingId,
    ),
    db.$queryRawUnsafe<DisputeIssueRow[]>(
      `SELECT i.* FROM wewed_contracts."DisputeIssue" i JOIN wewed_contracts."DisputeCase" c ON c."id"=i."disputeCaseId" WHERE c."serviceEngagementId"=$1 AND c."weddingId"=$2 ORDER BY i."createdAt", i."id"`, engagementId, weddingId,
    ),
    db.$queryRawUnsafe<DisputeEventRow[]>(
      `SELECT e.* FROM wewed_contracts."DisputeEvent" e JOIN wewed_contracts."DisputeCase" c ON c."id"=e."disputeCaseId" WHERE c."serviceEngagementId"=$1 AND c."weddingId"=$2 ORDER BY e."createdAt", e."id"`, engagementId, weddingId,
    ),
    db.$queryRawUnsafe<DisputeOutcomeRow[]>(
      `SELECT o.* FROM wewed_contracts."DisputeOutcome" o JOIN wewed_contracts."DisputeCase" c ON c."id"=o."disputeCaseId" WHERE c."serviceEngagementId"=$1 AND c."weddingId"=$2 ORDER BY o."recordedAt", o."id"`, engagementId, weddingId,
    ),
    db.$queryRawUnsafe<EvidenceHoldRow[]>(
      `SELECT h.* FROM wewed_contracts."EvidenceHold" h LEFT JOIN wewed_contracts."DisputeCase" c ON c."id"=h."disputeCaseId" WHERE h."weddingId"=$2 AND (c."serviceEngagementId"=$1 OR h."disputeCaseId" IS NULL) ORDER BY h."placedAt", h."id"`, engagementId, weddingId,
    ),
  ])
  return { milestones, payments, disputes, issues, events, outcomes, holds }
}

export async function getTransactionGovernance(input: { weddingId: string; engagementId: string }) {
  const engagement = await engagementOrThrow(input.weddingId, input.engagementId)
  const rows = await phase4Rows(engagement.id, input.weddingId)
  const contract = effectiveContractAmount(engagement)
  const budgetCommitted = Math.round(engagement.budgetItems.reduce((sum, item) => sum + (item.actualCost ?? item.estimatedCost), 0) * 100) / 100
  const budgetPaid = Math.round(engagement.budgetItems.reduce((sum, item) => sum + item.paidAmount, 0) * 100) / 100
  const legacyTotal = Math.round(engagement.payments.reduce((sum, item) => sum + decimal(item.amount), 0) * 100) / 100
  const managedNet = computeManagedNet(rows.payments)
  const comparisonPaymentTotal = rows.payments.length > 0 ? managedNet : legacyTotal
  const milestoneTotal = Math.round(rows.milestones.filter((item) => item.status === 'PLANNED').reduce((sum, item) => sum + decimal(item.amount), 0) * 100) / 100
  const orphanPaidBudgetItems = await db.budgetItem.count({ where: { weddingId: input.weddingId, paidAmount: { gt: 0 }, serviceEngagementId: null } })
  const flags: Array<{ code: string; severity: 'info' | 'warning' | 'critical'; message: string }> = []

  if (contract.amount !== null && !approxEqual(contract.amount, budgetCommitted)) {
    flags.push({ code: 'CONTRACT_BUDGET_TOTAL_MISMATCH', severity: 'warning', message: `Governed commitment ${contract.amount.toFixed(2)} differs from linked Budget commitment ${budgetCommitted.toFixed(2)}.` })
  }
  if (contract.amount !== null && comparisonPaymentTotal - contract.amount >= 0.01) {
    flags.push({ code: 'PAYMENTS_EXCEED_CONTRACT', severity: 'critical', message: `Recorded payment facts ${comparisonPaymentTotal.toFixed(2)} exceed governed commitment ${contract.amount.toFixed(2)}.` })
  }
  const missingProof = rows.payments.filter((item) => item.proofRequired && !item.proofVaultObjectId)
  if (missingProof.length) flags.push({ code: 'PAYMENT_PROOF_MISSING', severity: 'warning', message: `${missingProof.length} governed payment fact${missingProof.length === 1 ? '' : 's'} require proof but have no Vault proof object.` })
  if (!approxEqual(budgetPaid, comparisonPaymentTotal)) {
    flags.push({ code: 'BUDGET_PAID_FACT_MISMATCH', severity: 'warning', message: `Budget paid amount ${budgetPaid.toFixed(2)} differs from payment facts ${comparisonPaymentTotal.toFixed(2)}.` })
  }
  if (contract.amount !== null && rows.milestones.length > 0 && !approxEqual(milestoneTotal, contract.amount)) {
    flags.push({ code: 'MILESTONE_TOTAL_CONTRACT_MISMATCH', severity: 'warning', message: `Planned milestones total ${milestoneTotal.toFixed(2)} differs from governed commitment ${contract.amount.toFixed(2)}.` })
  }
  const now = Date.now()
  const overdue = rows.milestones.filter((item) => item.status === 'PLANNED' && item.dueAt && item.dueAt.getTime() < now && decimal(item.amount) - milestonePaid(rows.payments, item.id) >= 0.01)
  if (overdue.length) flags.push({ code: 'OVERDUE_MILESTONE', severity: 'warning', message: `${overdue.length} payment milestone${overdue.length === 1 ? '' : 's'} are overdue with an outstanding recorded balance.` })
  if (legacyTotal > 0 && rows.payments.length > 0) flags.push({ code: 'LEGACY_PAYMENT_UNALLOCATED', severity: 'info', message: 'Legacy EngagementPayment facts and Phase 4 managed payment facts both exist. Wewed shows them separately and does not double-count them automatically.' })
  if (orphanPaidBudgetItems > 0) flags.push({ code: 'ORPHAN_PAID_BUDGET_ITEMS', severity: 'warning', message: `${orphanPaidBudgetItems} paid Budget item${orphanPaidBudgetItems === 1 ? '' : 's'} in this wedding are not linked to a Service Engagement.` })

  return {
    engagement: {
      id: engagement.id,
      weddingId: engagement.weddingId,
      vendorId: engagement.vendorId,
      vendorName: engagement.vendor.name,
      serviceCategory: engagement.serviceCategory,
      agreedAmount: engagement.agreedAmount === null ? null : decimal(engagement.agreedAmount),
      currency: engagement.currency,
      lifecycleStatus: engagement.lifecycleStatus,
    },
    contractCommitment: contract,
    reconciliation: {
      budgetCommitted,
      budgetPaid,
      legacyPaymentFactsTotal: legacyTotal,
      managedPaymentFactsNet: managedNet,
      comparisonPaymentTotal,
      comparisonSource: rows.payments.length > 0 ? 'managed_payment_facts' : 'legacy_engagement_payments',
      milestoneTotal,
      orphanPaidBudgetItems,
      flags,
      budgetMutationPolicy: 'read_only_reconciliation',
      wewedProcessorRole: 'NONE',
      custodyStatus: 'NOT_HELD_BY_WEWED',
    },
    milestones: rows.milestones.map((item) => {
      const allocated = milestonePaid(rows.payments, item.id)
      return { ...item, amount: decimal(item.amount), dueAt: item.dueAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), recordedNet: allocated, outstanding: Math.max(0, Math.round((decimal(item.amount) - allocated) * 100) / 100) }
    }),
    managedPayments: rows.payments.map((item) => ({ ...item, amount: decimal(item.amount), paidAt: item.paidAt.toISOString(), createdAt: item.createdAt.toISOString() })),
    legacyPayments: engagement.payments.map((item) => ({ id: item.id, amount: decimal(item.amount), currency: item.currency, paidAt: item.paidAt?.toISOString() ?? null, method: item.method, reference: item.reference, notes: item.notes, createdAt: item.createdAt.toISOString() })),
    disputes: rows.disputes.map((item) => ({ ...item, openedAt: item.openedAt.toISOString(), closedAt: item.closedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), issues: rows.issues.filter((issue) => issue.disputeCaseId === item.id).map((issue) => ({ ...issue, createdAt: issue.createdAt.toISOString(), updatedAt: issue.updatedAt.toISOString() })), events: rows.events.filter((event) => event.disputeCaseId === item.id).map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })), outcome: rows.outcomes.find((outcome) => outcome.disputeCaseId === item.id) ? (() => { const outcome = rows.outcomes.find((value) => value.disputeCaseId === item.id)!; return { ...outcome, amount: outcome.amount === null ? null : decimal(outcome.amount), recordedAt: outcome.recordedAt.toISOString() } })() : null, holds: rows.holds.filter((hold) => hold.disputeCaseId === item.id).map((hold) => ({ ...hold, placedAt: hold.placedAt.toISOString(), releasedAt: hold.releasedAt?.toISOString() ?? null })) })),
  }
}

export async function createPaymentMilestone(input: {
  weddingId: string
  engagementId: string
  actorId: string
  milestoneType: unknown
  label: unknown
  description?: unknown
  amount: unknown
  currency: unknown
  dueAt?: unknown
  sequence?: unknown
  proofRequired?: unknown
  contractId?: unknown
  contractVersionId?: unknown
}) {
  await engagementOrThrow(input.weddingId, input.engagementId)
  const milestoneType = text(input.milestoneType, 40).toUpperCase()
  if (!MILESTONE_TYPES.has(milestoneType)) throw new Phase4GovernanceError('Choose a supported milestone type.', 400, 'milestoneType')
  const label = text(input.label, 180)
  if (label.length < 2) throw new Phase4GovernanceError('Milestone label is required.', 400, 'label')
  const contractId = optionalText(input.contractId, 100)
  const contractVersionId = optionalText(input.contractVersionId, 100)
  if (Boolean(contractId) !== Boolean(contractVersionId)) throw new Phase4GovernanceError('Contract and contract version must be supplied together.', 400)
  const id = `milestone-${randomUUID()}`
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_contracts."PaymentMilestone" ("id","serviceEngagementId","weddingId","contractId","contractVersionId","milestoneType","label","description","amount","currency","dueAt","sequence","proofRequired","createdById") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    id, input.engagementId, input.weddingId, contractId, contractVersionId, milestoneType, label, optionalText(input.description, 2000), amount(input.amount), currency(input.currency), dateValue(input.dueAt, 'dueAt'), Number.isFinite(Number(input.sequence)) ? Math.trunc(Number(input.sequence)) : 0, input.proofRequired !== false, input.actorId,
  )
  return { id }
}

export async function recordManagedPayment(input: {
  weddingId: string
  engagementId: string
  actorId: string
  entryType?: unknown
  amount: unknown
  currency: unknown
  paidAt: unknown
  milestoneId?: unknown
  method?: unknown
  reference?: unknown
  notes?: unknown
  source?: unknown
  proofRequired?: unknown
  proofWaiverReason?: unknown
  proofFile?: File | null
}) {
  await engagementOrThrow(input.weddingId, input.engagementId)
  const entryType = text(input.entryType || 'PAYMENT', 20).toUpperCase()
  if (!PAYMENT_ENTRY_TYPES.has(entryType)) throw new Phase4GovernanceError('Only payment or refund facts can be recorded directly.', 400, 'entryType')
  const source = text(input.source || 'MANUAL_FACT', 40).toUpperCase()
  if (!PAYMENT_SOURCES.has(source)) throw new Phase4GovernanceError('Payment source is invalid.', 400, 'source')
  const proofRequired = input.proofRequired !== false
  const proofWaiverReason = optionalText(input.proofWaiverReason, 2000)
  if (!proofRequired && !proofWaiverReason) throw new Phase4GovernanceError('Explain why payment proof is not required.', 400, 'proofWaiverReason')
  const id = `managed-payment-${randomUUID()}`
  const prepared = input.proofFile ? await prepareVaultUpload({ file: input.proofFile, weddingId: input.weddingId, actorId: input.actorId, source: 'phase4_payment_proof', category: 'payment_proof', metadata: { serviceEngagementId: input.engagementId, managedPaymentId: id, recordNature: 'FACT_ONLY' } }) : null
  try {
    await db.$transaction(async (tx) => {
      if (prepared) {
        await registerPreparedVaultObject(prepared, tx)
        await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'service_engagement', entityId: input.engagementId, linkRole: 'payment_proof', actorId: input.actorId, tx })
        await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'managed_payment_record', entityId: id, linkRole: 'proof', actorId: input.actorId, tx })
      }
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_contracts."ManagedPaymentRecord" ("id","serviceEngagementId","weddingId","milestoneId","entryType","amount","currency","paidAt","method","reference","notes","source","proofRequired","proofWaiverReason","proofVaultObjectId","recordedById") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        id, input.engagementId, input.weddingId, optionalText(input.milestoneId, 100), entryType, amount(input.amount), currency(input.currency), dateValue(input.paidAt, 'paidAt', true), optionalText(input.method, 120), optionalText(input.reference, 240), optionalText(input.notes, 2000), source, proofRequired, proofWaiverReason, prepared?.id ?? null, input.actorId,
      )
    })
  } catch (error) {
    if (prepared) await removePreparedVaultUpload(prepared)
    throw error
  }
  return { id, proofVaultObjectId: prepared?.id ?? null, recordNature: 'FACT_ONLY', wewedProcessorRole: 'NONE', custodyStatus: 'NOT_HELD_BY_WEWED' }
}

export async function reverseManagedPayment(input: { weddingId: string; engagementId: string; actorId: string; paymentId: string; paidAt?: unknown; notes?: unknown }) {
  await engagementOrThrow(input.weddingId, input.engagementId)
  const rows = await db.$queryRawUnsafe<ManagedPaymentRow[]>(`SELECT * FROM wewed_contracts."ManagedPaymentRecord" WHERE "id"=$1 AND "serviceEngagementId"=$2 AND "weddingId"=$3 LIMIT 1`, input.paymentId, input.engagementId, input.weddingId)
  const original = rows[0]
  if (!original || original.entryType === 'REVERSAL') throw new Phase4GovernanceError('The original payment fact cannot be reversed.', 404)
  const id = `managed-payment-${randomUUID()}`
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_contracts."ManagedPaymentRecord" ("id","serviceEngagementId","weddingId","milestoneId","entryType","amount","currency","paidAt","method","reference","notes","source","proofRequired","proofWaiverReason","proofVaultObjectId","reversesPaymentId","recordedById") VALUES ($1,$2,$3,$4,'REVERSAL',$5,$6,$7,$8,$9,$10,'CORRECTION_FACT',false,'Governed reversal of an existing immutable payment fact',NULL,$11,$12)`,
    id, input.engagementId, input.weddingId, original.milestoneId, decimal(original.amount), original.currency, dateValue(input.paidAt, 'paidAt') ?? new Date(), original.method, original.reference, optionalText(input.notes, 2000), original.id, input.actorId,
  )
  return { id, reversesPaymentId: original.id }
}

export async function openDisputeCase(input: { weddingId: string; engagementId: string; actorId: string; summary: unknown; contractId?: unknown; contractVersionId?: unknown }) {
  await engagementOrThrow(input.weddingId, input.engagementId)
  const summary = text(input.summary, 4000)
  if (summary.length < 10) throw new Phase4GovernanceError('Describe the issue without presenting it as an established breach.', 400, 'summary')
  const contractId = optionalText(input.contractId, 100)
  const contractVersionId = optionalText(input.contractVersionId, 100)
  if (Boolean(contractId) !== Boolean(contractVersionId)) throw new Phase4GovernanceError('Contract and contract version must be supplied together.', 400)
  const id = `dispute-${randomUUID()}`
  await db.$executeRawUnsafe(`INSERT INTO wewed_contracts."DisputeCase" ("id","weddingId","serviceEngagementId","contractId","contractVersionId","summary","openedById") VALUES ($1,$2,$3,$4,$5,$6,$7)`, id, input.weddingId, input.engagementId, contractId, contractVersionId, summary, input.actorId)
  return { id, status: 'OPEN', findingStatus: 'UNADJUDICATED' }
}

export async function addDisputeIssue(input: { weddingId: string; engagementId: string; disputeCaseId: string; actorId: string; clauseReference?: unknown; category: unknown; allegationText: unknown }) {
  await assertDisputeScope(input.weddingId, input.engagementId, input.disputeCaseId)
  const category = text(input.category, 120)
  const allegationText = text(input.allegationText, 6000)
  if (category.length < 2) throw new Phase4GovernanceError('Issue category is required.', 400, 'category')
  if (allegationText.length < 5) throw new Phase4GovernanceError('Describe the allegation or issue.', 400, 'allegationText')
  const id = `dispute-issue-${randomUUID()}`
  await db.$executeRawUnsafe(`INSERT INTO wewed_contracts."DisputeIssue" ("id","disputeCaseId","clauseReference","category","allegationText","createdById") VALUES ($1,$2,$3,$4,$5,$6)`, id, input.disputeCaseId, optionalText(input.clauseReference, 400), category, allegationText, input.actorId)
  return { id, status: 'ALLEGED', findingStatus: 'UNADJUDICATED' }
}

async function assertDisputeScope(weddingId: string, engagementId: string, disputeCaseId: string): Promise<DisputeCaseRow> {
  const rows = await db.$queryRawUnsafe<DisputeCaseRow[]>(`SELECT * FROM wewed_contracts."DisputeCase" WHERE "id"=$1 AND "weddingId"=$2 AND "serviceEngagementId"=$3 LIMIT 1`, disputeCaseId, weddingId, engagementId)
  if (!rows[0]) throw new Phase4GovernanceError('Dispute case was not found in this service engagement.', 404)
  return rows[0]
}

export async function recordDisputeEvent(input: { weddingId: string; engagementId: string; disputeCaseId: string; actorId: string; issueId?: unknown; eventType: unknown; source?: unknown; actorPartyId?: unknown; note: unknown; metadata?: Record<string, unknown> }) {
  await assertDisputeScope(input.weddingId, input.engagementId, input.disputeCaseId)
  const eventType = text(input.eventType, 60).toUpperCase()
  if (!DISPUTE_EVENT_TYPES.has(eventType)) throw new Phase4GovernanceError('Choose a supported party/notice/negotiation event.', 400, 'eventType')
  const source = text(input.source || 'IN_APP_ACTOR', 40).toUpperCase()
  if (!DISPUTE_EVENT_SOURCES.has(source)) throw new Phase4GovernanceError('Dispute event source is invalid.', 400, 'source')
  const note = text(input.note, 6000)
  if (note.length < 2) throw new Phase4GovernanceError('A factual event note is required.', 400, 'note')
  const id = `dispute-event-${randomUUID()}`
  await db.$executeRawUnsafe(`INSERT INTO wewed_contracts."DisputeEvent" ("id","disputeCaseId","issueId","eventType","source","actorId","actorPartyId","note","metadata") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, id, input.disputeCaseId, optionalText(input.issueId, 100), eventType, source, input.actorId, optionalText(input.actorPartyId, 100), note, JSON.stringify(input.metadata ?? {}))
  return { id }
}

export async function addDisputeEvidence(input: { weddingId: string; engagementId: string; disputeCaseId: string; issueId?: string | null; actorId: string; file: File; reason: unknown; note?: unknown }) {
  await assertDisputeScope(input.weddingId, input.engagementId, input.disputeCaseId)
  const reason = text(input.reason, 2000)
  if (reason.length < 3) throw new Phase4GovernanceError('Explain why this evidence must be preserved.', 400, 'reason')
  const holdId = `evidence-hold-${randomUUID()}`
  const eventId = `dispute-event-${randomUUID()}`
  const prepared = await prepareVaultUpload({ file: input.file, weddingId: input.weddingId, actorId: input.actorId, source: 'phase4_dispute_evidence', category: 'dispute_evidence', metadata: { serviceEngagementId: input.engagementId, disputeCaseId: input.disputeCaseId, issueId: input.issueId ?? null, evidenceHoldId: holdId } })
  try {
    await db.$transaction(async (tx) => {
      await registerPreparedVaultObject(prepared, tx)
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'service_engagement', entityId: input.engagementId, linkRole: 'dispute_evidence', actorId: input.actorId, tx })
      await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'dispute_case', entityId: input.disputeCaseId, linkRole: 'evidence', actorId: input.actorId, tx })
      if (input.issueId) await createVaultLink({ vaultObjectId: prepared.id, weddingId: input.weddingId, entityType: 'dispute_issue', entityId: input.issueId, linkRole: 'evidence', actorId: input.actorId, tx })
      await tx.$executeRawUnsafe(`INSERT INTO wewed_contracts."EvidenceHold" ("id","weddingId","vaultObjectId","disputeCaseId","reason","placedById") VALUES ($1,$2,$3,$4,$5,$6)`, holdId, input.weddingId, prepared.id, input.disputeCaseId, reason, input.actorId)
      await tx.$executeRawUnsafe(`INSERT INTO wewed_contracts."DisputeEvent" ("id","disputeCaseId","issueId","eventType","source","actorId","note","metadata") VALUES ($1,$2,$3,'EVIDENCE_ADDED','SYSTEM_GOVERNANCE',$4,$5,$6::jsonb)`, eventId, input.disputeCaseId, input.issueId ?? null, input.actorId, text(input.note, 6000) || `Evidence preserved under hold ${holdId}.`, JSON.stringify({ vaultObjectId: prepared.id, evidenceHoldId: holdId, checksumSha256: prepared.checksumSha256, storageState: prepared.storageState, scanState: prepared.scanState }))
    })
  } catch (error) {
    await removePreparedVaultUpload(prepared)
    throw error
  }
  return { vaultObjectId: prepared.id, holdId, checksumSha256: prepared.checksumSha256, storageState: prepared.storageState, scanState: prepared.scanState }
}

export async function recordDisputeOutcome(input: { weddingId: string; engagementId: string; disputeCaseId: string; actorId: string; source: unknown; outcomeSummary: unknown; remedyType?: unknown; amount?: unknown; currency?: unknown; externalReference?: unknown; evidenceVaultObjectId?: unknown }) {
  await assertDisputeScope(input.weddingId, input.engagementId, input.disputeCaseId)
  const source = text(input.source, 40).toUpperCase()
  if (!OUTCOME_SOURCES.has(source)) throw new Phase4GovernanceError('Outcome source must be mutual settlement, external adjudication, court order, or withdrawal.', 400, 'source')
  const outcomeSummary = text(input.outcomeSummary, 6000)
  if (outcomeSummary.length < 5) throw new Phase4GovernanceError('Outcome summary is required.', 400, 'outcomeSummary')
  const remedyType = text(input.remedyType || 'NONE', 40).toUpperCase()
  if (!REMEDY_TYPES.has(remedyType)) throw new Phase4GovernanceError('Remedy type is invalid.', 400, 'remedyType')
  const remedyAmount = nonNegativeAmount(input.amount)
  const remedyCurrency = remedyAmount === null ? null : currency(input.currency)
  const id = `dispute-outcome-${randomUUID()}`
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`INSERT INTO wewed_contracts."DisputeOutcome" ("id","disputeCaseId","weddingId","source","outcomeSummary","remedyType","amount","currency","externalReference","evidenceVaultObjectId","recordedById") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, id, input.disputeCaseId, input.weddingId, source, outcomeSummary, remedyType, remedyAmount, remedyCurrency, optionalText(input.externalReference, 1000), optionalText(input.evidenceVaultObjectId, 100), input.actorId)
    await tx.$executeRawUnsafe(`INSERT INTO wewed_contracts."DisputeEvent" ("id","disputeCaseId","eventType","source","actorId","note","metadata") VALUES ($1,$2,'OUTCOME_RECORDED','SYSTEM_GOVERNANCE',$3,$4,$5::jsonb)`, `dispute-event-${randomUUID()}`, input.disputeCaseId, input.actorId, `Outcome recorded from ${source.replaceAll('_', ' ').toLowerCase()}; Wewed did not adjudicate the dispute.`, JSON.stringify({ outcomeId: id, source, remedyType, amount: remedyAmount, currency: remedyCurrency }))
  })
  return { id, source, remedyType, wewedAdjudicationRole: 'NONE' }
}

export async function releaseEvidenceHold(input: { weddingId: string; engagementId: string; holdId: string; actorId: string; releaseReason: unknown }) {
  const rows = await db.$queryRawUnsafe<Array<EvidenceHoldRow & { caseEngagementId: string | null }>>(`SELECT h.*, c."serviceEngagementId" AS "caseEngagementId" FROM wewed_contracts."EvidenceHold" h LEFT JOIN wewed_contracts."DisputeCase" c ON c."id"=h."disputeCaseId" WHERE h."id"=$1 AND h."weddingId"=$2 LIMIT 1`, input.holdId, input.weddingId)
  const hold = rows[0]
  if (!hold || (hold.caseEngagementId && hold.caseEngagementId !== input.engagementId)) throw new Phase4GovernanceError('Evidence hold was not found in this service engagement.', 404)
  if (hold.status !== 'ACTIVE') throw new Phase4GovernanceError('Evidence hold is already released.', 409)
  const releaseReason = text(input.releaseReason, 2000)
  if (releaseReason.length < 3) throw new Phase4GovernanceError('Explain why the evidence hold can be released.', 400, 'releaseReason')
  const releasedAt = new Date()
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE wewed_contracts."EvidenceHold" SET "status"='RELEASED', "releasedById"=$2, "releasedAt"=$3, "releaseReason"=$4 WHERE "id"=$1`, hold.id, input.actorId, releasedAt, releaseReason)
    if (hold.disputeCaseId) await tx.$executeRawUnsafe(`INSERT INTO wewed_contracts."DisputeEvent" ("id","disputeCaseId","eventType","source","actorId","note","metadata") VALUES ($1,$2,'HOLD_RELEASED','SYSTEM_GOVERNANCE',$3,$4,$5::jsonb)`, `dispute-event-${randomUUID()}`, hold.disputeCaseId, input.actorId, `Evidence hold released: ${releaseReason}`, JSON.stringify({ evidenceHoldId: hold.id, vaultObjectId: hold.vaultObjectId, releasedAt: releasedAt.toISOString() }))
  })
  return { holdId: hold.id, vaultObjectId: hold.vaultObjectId, releasedAt: releasedAt.toISOString(), objectDeleted: false }
}
