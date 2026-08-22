import 'server-only'

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

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

async function upsertLink(args: {
  tx: Prisma.TransactionClient
  vaultObjectId: string
  weddingId: string
  entityType: string
  entityId: string
  linkRole: string
  actorId: string
}) {
  const { tx, vaultObjectId, weddingId, entityType, entityId, linkRole, actorId } = args
  return tx.vaultLink.upsert({
    where: {
      vaultObjectId_entityType_entityId_linkRole: {
        vaultObjectId,
        entityType,
        entityId,
        linkRole,
      },
    },
    create: {
      vaultObjectId,
      weddingId,
      entityType,
      entityId,
      linkRole,
      createdById: actorId,
    },
    update: {},
  })
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

  await upsertLink({
    tx,
    vaultObjectId,
    weddingId,
    entityType: 'service_engagement',
    entityId: engagement.id,
    linkRole,
    actorId,
  })

  await upsertLink({
    tx,
    vaultObjectId,
    weddingId,
    entityType: 'vendor',
    entityId: engagement.vendorId,
    linkRole,
    actorId,
  })

  for (const budgetItem of engagement.budgetItems) {
    await upsertLink({
      tx,
      vaultObjectId,
      weddingId,
      entityType: 'budget_item',
      entityId: budgetItem.id,
      linkRole,
      actorId,
    })
  }

  // Direct-payer visibility is earned only by actual money movement. A pledge
  // with $0 paid cannot be selected by this query because it has no positive
  // payment_funding_allocations row tied to a real EngagementPayment.
  const directPayers = await tx.$queryRaw<DirectPayingContributionRow[]>`
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

  for (const contribution of directPayers) {
    await upsertLink({
      tx,
      vaultObjectId,
      weddingId,
      entityType: 'WeddingContribution',
      entityId: contribution.id,
      // Existing Contribution evidence UI intentionally uses this projection
      // role. The Service Engagement/Vendor/Budget links retain the document's
      // commercial role such as existing_agreement or invoice.
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
