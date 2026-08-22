import 'server-only'

import { db } from '@/lib/db'
import { VENDOR_VISIBLE_COMMERCIAL_DOCUMENT_ROLES } from '@/lib/vault/commercial-documents'
import { vaultObjectIsDistributable } from '@/lib/vault/core'

export interface VendorDocumentAccessIdentity {
  userId: string
  email: string
}

async function hasActiveVendorBusinessIdentity(userId: string): Promise<boolean> {
  if (!userId) return false
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT ba.id
      FROM public."BusinessAccount" ba
      LEFT JOIN public."BusinessAccountMember" member
        ON member."businessAccountId" = ba.id
       AND member."userId" = ${userId}
       AND member.status = 'active'
     WHERE ba.type = 'vendor'
       AND ba.status = 'active'
       AND ba."onboardingStatus" = 'complete'
       AND (ba."ownerUserId" = ${userId} OR member."userId" = ${userId})
     LIMIT 1
  `
  return rows.length > 0
}

function vendorObjectIsDistributable(value: { storageState: string; scanState: string; deletedAt?: Date | null }): boolean {
  if (vaultObjectIsDistributable(value)) return true
  // Compatibility only for Service Engagement documents registered before the
  // canonical Vault-state convergence. New uploads never write these states.
  return !value.deletedAt && value.storageState === 'stored' && value.scanState === 'signature_validated'
}

export async function vendorServiceEngagementAccess(identity: VendorDocumentAccessIdentity) {
  const normalizedEmail = identity.email.trim().toLowerCase()
  if (!identity.userId || !normalizedEmail) return []

  // A vendor-role app session is not enough. The authenticated app user must
  // also own or actively belong to a completed, active Vendor BusinessAccount.
  if (!(await hasActiveVendorBusinessIdentity(identity.userId))) return []

  return db.engagementParty.findMany({
    where: {
      partyRole: 'SERVICE_PROVIDER',
      status: 'active',
      OR: [
        // Preferred binding: the Service Engagement party explicitly names the
        // authenticated app user.
        { userId: identity.userId },
        // Legacy/current engagements may predate explicit party user binding.
        // Email fallback is accepted only after authoritative active Vendor
        // BusinessAccount membership has already been proved above.
        { userId: null, email: { equals: normalizedEmail, mode: 'insensitive' } },
      ],
    },
    select: {
      serviceEngagementId: true,
      weddingId: true,
      serviceEngagement: {
        select: {
          id: true,
          serviceCategory: true,
          serviceDescription: true,
          lifecycleStatus: true,
          vendor: { select: { id: true, name: true, category: true } },
          wedding: { select: { id: true, title: true, date: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function listVendorCommercialDocuments(identity: VendorDocumentAccessIdentity) {
  const access = await vendorServiceEngagementAccess(identity)
  if (access.length === 0) return []

  const engagementIds = Array.from(new Set(access.map((item) => item.serviceEngagementId)))
  const weddingIds = Array.from(new Set(access.map((item) => item.weddingId)))
  const accessByEngagement = new Map(access.map((item) => [item.serviceEngagementId, item.serviceEngagement]))

  const links = await db.vaultLink.findMany({
    where: {
      weddingId: { in: weddingIds },
      entityType: 'service_engagement',
      entityId: { in: engagementIds },
      linkRole: { in: [...VENDOR_VISIBLE_COMMERCIAL_DOCUMENT_ROLES] },
      vaultObject: { deletedAt: null },
    },
    include: { vaultObject: true },
    orderBy: { createdAt: 'desc' },
  })

  return links.filter((link) => vendorObjectIsDistributable(link.vaultObject)).map((link) => {
    const engagement = accessByEngagement.get(link.entityId)
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
      serviceEngagement: engagement ? {
        id: engagement.id,
        serviceCategory: engagement.serviceCategory,
        serviceDescription: engagement.serviceDescription,
        lifecycleStatus: engagement.lifecycleStatus,
      } : null,
      vendor: engagement?.vendor ?? null,
      wedding: engagement?.wedding ? {
        id: engagement.wedding.id,
        title: engagement.wedding.title,
        date: engagement.wedding.date.toISOString(),
      } : null,
    }
  })
}

export async function vendorCommercialDocumentAccess(identity: VendorDocumentAccessIdentity, vaultObjectId: string) {
  const access = await vendorServiceEngagementAccess(identity)
  if (access.length === 0) return null
  const engagementIds = Array.from(new Set(access.map((item) => item.serviceEngagementId)))
  const weddingIds = Array.from(new Set(access.map((item) => item.weddingId)))

  const link = await db.vaultLink.findFirst({
    where: {
      vaultObjectId,
      weddingId: { in: weddingIds },
      entityType: 'service_engagement',
      entityId: { in: engagementIds },
      linkRole: { in: [...VENDOR_VISIBLE_COMMERCIAL_DOCUMENT_ROLES] },
      vaultObject: { deletedAt: null },
    },
    include: { vaultObject: true },
  })
  if (!link || !vendorObjectIsDistributable(link.vaultObject)) return null
  return link
}
