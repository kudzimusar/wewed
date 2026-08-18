import 'server-only'

import { db } from '@/lib/db'

export type Phase6ReviewSignal = {
  code: string
  severity: 'info' | 'warning' | 'critical'
  engagementId: string | null
  message: string
}

type PaymentAgg = {
  serviceEngagementId: string
  paymentFacts: number
  missingProof: number
}

type MilestoneAgg = {
  serviceEngagementId: string
  plannedCount: number
  plannedTotal: string | null
}

type DisputeAgg = {
  serviceEngagementId: string
  disputeCount: number
  openDisputes: number
}

type OutcomeAgg = {
  serviceEngagementId: string
  externalOutcomes: number
}

type HoldAgg = {
  serviceEngagementId: string
  activeHolds: number
}

type EffectivityRow = {
  contractVersionId: string
  contractId: string
}

type RequirementAgg = {
  contractId: string
  pendingRequirements: number
}

type AmendmentAgg = {
  contractId: string
  amendmentCount: number
  pendingAmendments: number
}

function numberValue(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizedQuery(value?: string | null): string {
  return (value ?? '').normalize('NFKC').trim().toLowerCase().slice(0, 120)
}

function includesQuery(values: Array<string | null | undefined>, query: string): boolean {
  if (!query) return true
  return values.some((value) => (value ?? '').toLowerCase().includes(query))
}

export async function getContractIntelligenceDashboard(input: { weddingId: string; query?: string | null }) {
  const query = normalizedQuery(input.query)
  const engagements = await db.serviceEngagement.findMany({
    where: { weddingId: input.weddingId },
    include: {
      vendor: { select: { id: true, name: true, category: true } },
      contracts: {
        include: { versions: { orderBy: { versionNumber: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  const [paymentRows, milestoneRows, disputeRows, outcomeRows, holdRows, effectivityRows, requirementRows, amendmentRows, activeWeddingHolds] = await Promise.all([
    db.$queryRawUnsafe<PaymentAgg[]>(
      `SELECT "serviceEngagementId", count(*)::int AS "paymentFacts", count(*) FILTER (WHERE "proofRequired" AND "proofVaultObjectId" IS NULL)::int AS "missingProof" FROM wewed_contracts."ManagedPaymentRecord" WHERE "weddingId"=$1 GROUP BY "serviceEngagementId"`,
      input.weddingId,
    ),
    db.$queryRawUnsafe<MilestoneAgg[]>(
      `SELECT "serviceEngagementId", count(*) FILTER (WHERE "status"='PLANNED')::int AS "plannedCount", sum("amount") FILTER (WHERE "status"='PLANNED') AS "plannedTotal" FROM wewed_contracts."PaymentMilestone" WHERE "weddingId"=$1 GROUP BY "serviceEngagementId"`,
      input.weddingId,
    ),
    db.$queryRawUnsafe<DisputeAgg[]>(
      `SELECT "serviceEngagementId", count(*)::int AS "disputeCount", count(*) FILTER (WHERE "status" IN ('OPEN','NOTICE_SENT','RESPONSE_RECEIVED','NEGOTIATING'))::int AS "openDisputes" FROM wewed_contracts."DisputeCase" WHERE "weddingId"=$1 GROUP BY "serviceEngagementId"`,
      input.weddingId,
    ),
    db.$queryRawUnsafe<OutcomeAgg[]>(
      `SELECT c."serviceEngagementId", count(*)::int AS "externalOutcomes" FROM wewed_contracts."DisputeOutcome" o JOIN wewed_contracts."DisputeCase" c ON c."id"=o."disputeCaseId" WHERE o."weddingId"=$1 GROUP BY c."serviceEngagementId"`,
      input.weddingId,
    ),
    db.$queryRawUnsafe<HoldAgg[]>(
      `SELECT c."serviceEngagementId", count(*) FILTER (WHERE h."status"='ACTIVE')::int AS "activeHolds" FROM wewed_contracts."EvidenceHold" h JOIN wewed_contracts."DisputeCase" c ON c."id"=h."disputeCaseId" WHERE h."weddingId"=$1 GROUP BY c."serviceEngagementId"`,
      input.weddingId,
    ),
    db.$queryRawUnsafe<EffectivityRow[]>(
      `SELECT "contractVersionId", "contractId" FROM wewed_contracts."ContractVersionEffectivity" WHERE "weddingId"=$1`,
      input.weddingId,
    ),
    db.$queryRawUnsafe<RequirementAgg[]>(
      `SELECT r."contractId", count(*) FILTER (WHERE r."status"='PENDING')::int AS "pendingRequirements" FROM wewed_contracts."ContractPartyRequirement" r JOIN public."Contract" c ON c."id"=r."contractId" WHERE c."weddingId"=$1 GROUP BY r."contractId"`,
      input.weddingId,
    ),
    db.$queryRawUnsafe<AmendmentAgg[]>(
      `SELECT a."contractId", count(*)::int AS "amendmentCount", count(*) FILTER (WHERE a."status" IN ('DRAFT','PROPOSED','PARTIALLY_ACCEPTED'))::int AS "pendingAmendments" FROM wewed_contracts."ContractAmendment" a JOIN public."Contract" c ON c."id"=a."contractId" WHERE c."weddingId"=$1 GROUP BY a."contractId"`,
      input.weddingId,
    ),
    db.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT count(*) FILTER (WHERE "status"='ACTIVE')::int AS count FROM wewed_contracts."EvidenceHold" WHERE "weddingId"=$1`,
      input.weddingId,
    ),
  ])

  const payments = new Map(paymentRows.map((row) => [row.serviceEngagementId, row]))
  const milestones = new Map(milestoneRows.map((row) => [row.serviceEngagementId, row]))
  const disputes = new Map(disputeRows.map((row) => [row.serviceEngagementId, row]))
  const outcomes = new Map(outcomeRows.map((row) => [row.serviceEngagementId, row]))
  const holds = new Map(holdRows.map((row) => [row.serviceEngagementId, row]))
  const effectiveVersions = new Set(effectivityRows.map((row) => row.contractVersionId))
  const effectiveContracts = new Set(effectivityRows.map((row) => row.contractId))
  const requirements = new Map(requirementRows.map((row) => [row.contractId, row.pendingRequirements]))
  const amendments = new Map(amendmentRows.map((row) => [row.contractId, row]))
  const reviewSignals: Phase6ReviewSignal[] = []

  const engagementResults = engagements.map((engagement) => {
    const payment = payments.get(engagement.id)
    const milestone = milestones.get(engagement.id)
    const dispute = disputes.get(engagement.id)
    const outcome = outcomes.get(engagement.id)
    const hold = holds.get(engagement.id)
    const governedEffectiveContract = engagement.contracts.find((contract) => effectiveContracts.has(contract.id)) ?? null
    const plannedTotal = numberValue(milestone?.plannedTotal)
    const agreedAmount = engagement.agreedAmount === null ? null : Number(engagement.agreedAmount)

    if (!governedEffectiveContract && engagement.lifecycleStatus !== 'historical_capture') {
      reviewSignals.push({ code: 'NO_EFFECTIVE_CONTRACT', severity: 'warning', engagementId: engagement.id, message: `${engagement.serviceCategory}: no governed effective contract is recorded.` })
    }
    if ((payment?.missingProof ?? 0) > 0) {
      reviewSignals.push({ code: 'PAYMENT_PROOF_GAP', severity: 'warning', engagementId: engagement.id, message: `${engagement.serviceCategory}: ${payment!.missingProof} payment fact${payment!.missingProof === 1 ? '' : 's'} require proof but have no Vault proof object.` })
    }
    if ((dispute?.openDisputes ?? 0) > 0) {
      reviewSignals.push({ code: 'OPEN_DISPUTE', severity: 'warning', engagementId: engagement.id, message: `${engagement.serviceCategory}: ${dispute!.openDisputes} dispute case${dispute!.openDisputes === 1 ? '' : 's'} remain open. This is a workflow signal, not a finding.` })
    }
    if ((hold?.activeHolds ?? 0) > 0) {
      reviewSignals.push({ code: 'ACTIVE_EVIDENCE_HOLD', severity: 'info', engagementId: engagement.id, message: `${engagement.serviceCategory}: evidence is under an active hold and must remain preserved.` })
    }
    if ((milestone?.plannedCount ?? 0) > 0 && agreedAmount !== null && Math.abs(plannedTotal - agreedAmount) >= 0.01) {
      reviewSignals.push({ code: 'MILESTONE_TOTAL_MISMATCH', severity: 'warning', engagementId: engagement.id, message: `${engagement.serviceCategory}: planned milestones total ${plannedTotal.toFixed(2)} differs from the recorded engagement amount ${agreedAmount.toFixed(2)}.` })
    }

    return {
      id: engagement.id,
      vendorId: engagement.vendor.id,
      vendorName: engagement.vendor.name,
      vendorCategory: engagement.vendor.category,
      serviceCategory: engagement.serviceCategory,
      serviceDescription: engagement.serviceDescription,
      lifecycleStatus: engagement.lifecycleStatus,
      agreedAmount,
      currency: engagement.currency,
      serviceDate: engagement.serviceDate?.toISOString() ?? null,
      contractCount: engagement.contracts.length,
      effectiveContractCount: engagement.contracts.filter((contract) => effectiveContracts.has(contract.id)).length,
      managedPaymentFacts: payment?.paymentFacts ?? 0,
      paymentProofGaps: payment?.missingProof ?? 0,
      plannedMilestones: milestone?.plannedCount ?? 0,
      openDisputes: dispute?.openDisputes ?? 0,
      disputeCount: dispute?.disputeCount ?? 0,
      externalOrMutualOutcomes: outcome?.externalOutcomes ?? 0,
      activeEvidenceHolds: hold?.activeHolds ?? 0,
    }
  })

  const contractResults = engagements.flatMap((engagement) => engagement.contracts.map((contract) => ({
    id: contract.id,
    contractNumber: contract.contractNumber,
    title: contract.title,
    status: contract.status,
    currentVersionNumber: contract.currentVersionNumber,
    serviceEngagementId: engagement.id,
    serviceCategory: engagement.serviceCategory,
    vendorName: engagement.vendor.name,
    pendingAcceptanceRequirements: requirements.get(contract.id) ?? 0,
    amendmentCount: amendments.get(contract.id)?.amendmentCount ?? 0,
    pendingAmendments: amendments.get(contract.id)?.pendingAmendments ?? 0,
    versions: contract.versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      effective: effectiveVersions.has(version.id),
      contentSha256: version.contentSha256,
      artifactSha256: version.artifactSha256,
      issuedAt: version.issuedAt?.toISOString() ?? null,
    })),
  })))

  const vendorMap = new Map<string, {
    vendorId: string
    vendorName: string
    engagementCount: number
    effectiveContractCount: number
    managedPaymentFacts: number
    paymentProofGaps: number
    openDisputes: number
    externalOrMutualOutcomes: number
    activeEvidenceHolds: number
  }>()
  for (const engagement of engagementResults) {
    const current = vendorMap.get(engagement.vendorId) ?? {
      vendorId: engagement.vendorId,
      vendorName: engagement.vendorName,
      engagementCount: 0,
      effectiveContractCount: 0,
      managedPaymentFacts: 0,
      paymentProofGaps: 0,
      openDisputes: 0,
      externalOrMutualOutcomes: 0,
      activeEvidenceHolds: 0,
    }
    current.engagementCount += 1
    current.effectiveContractCount += engagement.effectiveContractCount
    current.managedPaymentFacts += engagement.managedPaymentFacts
    current.paymentProofGaps += engagement.paymentProofGaps
    current.openDisputes += engagement.openDisputes
    current.externalOrMutualOutcomes += engagement.externalOrMutualOutcomes
    current.activeEvidenceHolds += engagement.activeEvidenceHolds
    vendorMap.set(engagement.vendorId, current)
  }

  const filteredEngagements = engagementResults.filter((item) => includesQuery([item.vendorName, item.vendorCategory, item.serviceCategory, item.serviceDescription, item.lifecycleStatus], query))
  const filteredContracts = contractResults.filter((item) => includesQuery([item.contractNumber, item.title, item.status, item.serviceCategory, item.vendorName], query))
  const filteredSignals = query
    ? reviewSignals.filter((item) => {
        const engagement = engagementResults.find((row) => row.id === item.engagementId)
        return includesQuery([item.code, item.message, engagement?.vendorName, engagement?.serviceCategory], query)
      })
    : reviewSignals

  return {
    weddingId: input.weddingId,
    generatedAt: new Date().toISOString(),
    query: query || null,
    advisoryBoundary: 'Review signals are factual workflow prompts, not legal findings, fraud determinations, or adjudications.',
    aiBoundary: 'AI explanations and amendment extraction are advisory only and never accept, amend, make effective, pay, archive, or alter evidence.',
    overview: {
      engagementCount: engagements.length,
      contractCount: contractResults.length,
      effectiveContractCount: effectiveContracts.size,
      pendingAcceptanceRequirements: requirementRows.reduce((sum, row) => sum + row.pendingRequirements, 0),
      pendingAmendments: amendmentRows.reduce((sum, row) => sum + row.pendingAmendments, 0),
      managedPaymentFacts: paymentRows.reduce((sum, row) => sum + row.paymentFacts, 0),
      paymentProofGaps: paymentRows.reduce((sum, row) => sum + row.missingProof, 0),
      openDisputes: disputeRows.reduce((sum, row) => sum + row.openDisputes, 0),
      activeEvidenceHolds: activeWeddingHolds[0]?.count ?? 0,
      reviewSignalCount: reviewSignals.length,
    },
    engagements: filteredEngagements,
    contracts: filteredContracts,
    vendorSignals: Array.from(vendorMap.values()).filter((item) => includesQuery([item.vendorName], query)),
    reviewSignals: filteredSignals,
  }
}

export async function getContractVersionIntelligenceContext(input: { weddingId: string; contractVersionId: string }) {
  const version = await db.contractVersion.findFirst({
    where: { id: input.contractVersionId, contract: { weddingId: input.weddingId } },
    select: {
      id: true,
      versionNumber: true,
      status: true,
      canonicalJson: true,
      contentSha256: true,
      artifactSha256: true,
      issuedAt: true,
      contract: { select: { id: true, contractNumber: true, title: true, status: true, serviceEngagementId: true } },
    },
  })
  if (!version) return null
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
    contentSha256: version.contentSha256,
    artifactSha256: version.artifactSha256,
    issuedAt: version.issuedAt?.toISOString() ?? null,
    contract: version.contract,
    canonicalJson: version.canonicalJson.slice(0, 60_000),
  }
}

export async function getPrivacySafeAdminIntelligence(input: { weddingId: string }) {
  const dashboard = await getContractIntelligenceDashboard({ weddingId: input.weddingId })
  const signalCounts = new Map<string, number>()
  for (const signal of dashboard.reviewSignals) signalCounts.set(signal.code, (signalCounts.get(signal.code) ?? 0) + 1)
  return {
    weddingId: dashboard.weddingId,
    generatedAt: dashboard.generatedAt,
    overview: dashboard.overview,
    signalCounts: Array.from(signalCounts.entries()).map(([code, count]) => ({ code, count })),
    boundaries: {
      reviewSignals: dashboard.advisoryBoundary,
      ai: dashboard.aiBoundary,
      privacy: 'This Admin support view exposes aggregate counts only: no contract text, party identity, contact detail, or AI prompt content.',
    },
  }
}
