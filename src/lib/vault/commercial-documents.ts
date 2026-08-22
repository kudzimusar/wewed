import 'server-only'

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { createVaultLink } from '@/lib/vault/core'

export const COMMERCIAL_DOCUMENT_LINK_ROLES = [
  'existing_agreement',
  'generated_contract',
  'issued_contract',
  'amendment',
  'proposal',
  'quote',
  'invoice',
  'receipt',
  'payment_proof',
  'proof',
  'contribution_proof',
  'service_evidence',
  'acceptance_evidence',
  'dispute_evidence',
  'evidence',
  'insurance',
  'licence',
  'compliance',
] as const

/**
 * Automatic direct-payer projection is deliberately narrower than the overall
 * commercial document vocabulary. A real payment makes an invoice/receipt
 * relevant to the payer; it does not make the vendor's contract, generic
 * evidence, service evidence or dispute material theirs to discover.
 */
export const DIRECT_PAYER_AUTO_LINK_ROLES = ['invoice', 'receipt'] as const

/**
 * A Vendor may discover only known provider-facing commercial roles. Unknown
 * or dispute-oriented roles fail closed until product/access policy explicitly
 * admits them.
 */
export const VENDOR_VISIBLE_COMMERCIAL_DOCUMENT_ROLES = [
  'existing_agreement',
  'generated_contract',
  'issued_contract',
  'amendment',
  'proposal',
  'quote',
  'invoice',
  'receipt',
  'payment_proof',
  'proof',
  'service_evidence',
  'acceptance_evidence',
  'insurance',
  'licence',
  'compliance',
] as const

export interface CommercialDocumentSummary {
  id: string
  linkRole: string
  displayName: string
  originalFilename: string
  mimeType: string
  byteSize: number
  checksumSha256: string
  storageState: string
  scanState: string
  createdAt: string
}

interface DirectPayingContributionRow {
  id: string
}

function documentSummary(link: {
  linkRole: string
  vaultObject: {
    id: string
    displayName: string
    originalFilename: string
    mimeType: string
    byteSize: bigint
    checksumSha256: string
    storageState: string
    scanState: string
    createdAt: Date
  }
}): CommercialDocumentSummary {
  return {
    id: link.vaultObject.id,
    linkRole: link.linkRole,
    displayName: link.vaultObject.displayName,
    originalFilename: link.vaultObject.originalFilename,
    mimeType: link.vaultObject.mimeType,
    byteSize: Number(link.vaultObject.byteSize),
    checksumSha256: link.vaultObject.checksumSha256,
    storageState: link.vaultObject.storageState,
    scanState: link.vaultObject.scanState,
    createdAt: link.vaultObject.createdAt.toISOString(),
  }
}

function isDirectPayerAutoLinkRole(linkRole: string): boolean {
  return (DIRECT_PAYER_AUTO_LINK_ROLES as readonly string[]).includes(linkRole)
}

/**
 * Projects one authoritative Vault object across every commercial record that is
 * already factually related to the Service Engagement. It never creates or
 * mutates payments, contribution amounts, Budget Paid, contract lifecycle state,
 * or duplicate file bytes.
 */
export async function linkCommercialDocumentGraph(args: {
  tx: Prisma.TransactionClient
  vaultObjectId: string
  weddingId: string
  engagementId: string
  linkRole: string
  actorId: string
}) {
  const { tx, vaultObjectId, weddingId, engagementId, linkRole, actorId } = args
  const engagement = await tx.serviceEngagement.findFirst({
    where: { id: engagementId, weddingId },
    select: {
      id: true,
      vendorId: true,
      budgetItems: { select: { id: true } },
    },
  })
  if (!engagement) throw new Error('Service engagement not found for commercial document linkage.')

  await createVaultLink({
    tx,
    vaultObjectId,
    weddingId,
    entityType: 'service_engagement',
    entityId: engagement.id,
    linkRole,
    actorId,
  })

  await createVaultLink({
    tx,
    vaultObjectId,
    weddingId,
    entityType: 'vendor',
    entityId: engagement.vendorId,
    linkRole,
    actorId,
  })

  for (const budgetItem of engagement.budgetItems) {
    await createVaultLink({
      tx,
      vaultObjectId,
      weddingId,
      entityType: 'budget_item',
      entityId: budgetItem.id,
      linkRole,
      actorId,
    })
  }

  let directPayers: DirectPayingContributionRow[] = []
  if (isDirectPayerAutoLinkRole(linkRole)) {
    // Direct-payer visibility is earned only by actual money movement and only
    // for payment-scoped document roles. A pledge with $0 paid cannot be selected
    // because it has no positive funding allocation tied to a real payment.
    directPayers = await tx.$queryRaw<DirectPayingContributionRow[]>`
      SELECT DISTINCT c.id
        FROM wewed_contributions.wedding_contributions c
        JOIN wewed_contributions.payment_funding_allocations f
          ON f.contribution_id = c.id
         AND f.wedding_id = c.wedding_id
        JOIN public."EngagementPayment" p
          ON p.id = f.payment_id
       WHERE c.wedding_id = ${weddingId}
         AND c.service_engagement_id = ${engagementId}
         AND c.type = 'DIRECT_VENDOR_PAYMENT'
         AND f.source_kind = 'CONTRIBUTION'
         AND f.amount > 0
         AND p."serviceEngagementId" = ${engagementId}
    `
  }

  for (const contribution of directPayers) {
    await createVaultLink({
      tx,
      vaultObjectId,
      weddingId,
      entityType: 'WeddingContribution',
      entityId: contribution.id,
      // Existing Contribution evidence UI intentionally uses this projection
      // role. The Service Engagement/Vendor/Budget links retain the payment
      // document's commercial role (invoice or receipt).
      linkRole: 'evidence',
      actorId,
    })
  }

  return {
    serviceEngagementId: engagement.id,
    vendorId: engagement.vendorId,
    budgetItemIds: engagement.budgetItems.map((item) => item.id),
    directPayingContributionIds: directPayers.map((item) => item.id),
  }
}

/**
 * Completes the graph in the opposite event order: when a real direct-vendor
 * payment is recorded after the engagement documents already exist, project only
 * payment-scoped authoritative Service Engagement Vault objects into that
 * Contribution. Contracts, generic/service/dispute evidence and unknown roles do
 * not become contributor-visible merely because money moved.
 */
export async function linkExistingEngagementDocumentsToDirectPayer(args: {
  tx: Prisma.TransactionClient
  weddingId: string
  engagementId: string
  contributionId: string
  actorId: string
}) {
  const { tx, weddingId, engagementId, contributionId, actorId } = args
  const documents = await tx.vaultLink.findMany({
    where: {
      weddingId,
      entityType: 'service_engagement',
      entityId: engagementId,
      linkRole: { in: [...DIRECT_PAYER_AUTO_LINK_ROLES] },
      vaultObject: { deletedAt: null },
    },
    select: { vaultObjectId: true },
  })

  for (const document of documents) {
    await createVaultLink({
      tx,
      vaultObjectId: document.vaultObjectId,
      weddingId,
      entityType: 'WeddingContribution',
      entityId: contributionId,
      linkRole: 'evidence',
      actorId,
    })
  }

  return documents.map((document) => document.vaultObjectId)
}

export async function listBudgetCommercialDocuments(args: {
  weddingId: string
  budgetItems: Array<{ id: string; serviceEngagementId: string | null }>
}): Promise<Map<string, CommercialDocumentSummary[]>> {
  const itemIds = args.budgetItems.map((item) => item.id)
  const engagementIds = Array.from(new Set(args.budgetItems.map((item) => item.serviceEngagementId).filter((value): value is string => Boolean(value))))
  const result = new Map<string, CommercialDocumentSummary[]>(args.budgetItems.map((item) => [item.id, []]))
  if (itemIds.length === 0) return result

  const links = await db.vaultLink.findMany({
    where: {
      weddingId: args.weddingId,
      linkRole: { in: [...COMMERCIAL_DOCUMENT_LINK_ROLES] },
      OR: [
        { entityType: 'budget_item', entityId: { in: itemIds } },
        ...(engagementIds.length ? [{ entityType: 'service_engagement', entityId: { in: engagementIds } }] : []),
      ],
      vaultObject: { deletedAt: null },
    },
    include: { vaultObject: true },
    orderBy: { createdAt: 'desc' },
  })

  const engagementToBudgetIds = new Map<string, string[]>()
  for (const item of args.budgetItems) {
    if (!item.serviceEngagementId) continue
    const current = engagementToBudgetIds.get(item.serviceEngagementId) ?? []
    current.push(item.id)
    engagementToBudgetIds.set(item.serviceEngagementId, current)
  }

  const seen = new Map<string, Set<string>>(args.budgetItems.map((item) => [item.id, new Set<string>()]))
  for (const link of links) {
    const targetIds = link.entityType === 'budget_item'
      ? [link.entityId]
      : engagementToBudgetIds.get(link.entityId) ?? []
    for (const budgetId of targetIds) {
      const ids = seen.get(budgetId)
      if (!ids || ids.has(link.vaultObjectId)) continue
      ids.add(link.vaultObjectId)
      result.get(budgetId)?.push(documentSummary(link))
    }
  }

  return result
}
