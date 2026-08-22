import 'server-only'

import { db } from '@/lib/db'

export interface VendorDocumentAccessIdentity {
  userId: string
  email: string
}

export async function vendorServiceEngagementAccess(identity: VendorDocumentAccessIdentity) {
  const normalizedEmail = identity.email.trim().toLowerCase()
  if (!normalizedEmail) return []

  return db.engagementParty.findMany({
    where: {
      partyRole: 'SERVICE_PROVIDER',
      status: 'active',
      OR: [
        { userId: identity.userId },
        { email: { equals: normalizedEmail, mode: 'insensitive' } },
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
  const accessByEngagement = new Map(access.map((item) => [item.serviceEngagementId, item.serviceEngagement]))

  const links = await db.vaultLink.findMany({
    where: {
      entityType: 'service_engagement',
      entityId: { in: engagementIds },
      vaultObject: { deletedAt: null },
    },
    include: { vaultObject: true },
    orderBy: { createdAt: 'desc' },
  })

  return links.map((link) => {
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

  return db.vaultLink.findFirst({
    where: {
      vaultObjectId,
      entityType: 'service_engagement',
      entityId: { in: engagementIds },
      vaultObject: { deletedAt: null, storageState: 'stored' },
    },
    include: { vaultObject: true },
  })
}
