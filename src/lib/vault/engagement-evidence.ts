import 'server-only'

import { db } from '@/lib/db'
import { linkCommercialDocumentGraph } from '@/lib/vault/commercial-documents'
import {
  prepareVaultUpload,
  registerPreparedVaultObject,
  removePreparedVaultUpload,
  signedVaultDownload,
  vaultObjectIsDistributable,
  VaultUploadError,
} from '@/lib/vault/core'

const ALLOWED_ENGAGEMENT_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export const ENGAGEMENT_EVIDENCE_LINK_ROLES = [
  'proof',
  'invoice',
  'receipt',
  'existing_agreement',
  'evidence',
] as const

export type EngagementEvidenceLinkRole = (typeof ENGAGEMENT_EVIDENCE_LINK_ROLES)[number]

export class VaultEvidenceError extends Error {
  status: number
  field?: string

  constructor(message: string, status = 400, field?: string) {
    super(message)
    this.name = 'VaultEvidenceError'
    this.status = status
    this.field = field
  }
}

function validateRole(value: string): EngagementEvidenceLinkRole {
  if (!ENGAGEMENT_EVIDENCE_LINK_ROLES.includes(value as EngagementEvidenceLinkRole)) {
    throw new VaultEvidenceError(
      `linkRole must be one of: ${ENGAGEMENT_EVIDENCE_LINK_ROLES.join(', ')}.`,
      400,
      'linkRole',
    )
  }
  return value as EngagementEvidenceLinkRole
}

async function assertEngagementInWedding(weddingId: string, engagementId: string) {
  const engagement = await db.serviceEngagement.findFirst({
    where: { id: engagementId, weddingId },
    select: { id: true },
  })
  if (!engagement) {
    throw new VaultEvidenceError('Service engagement not found.', 404)
  }
}

function legacyCommercialObjectIsDistributable(value: { storageState: string; scanState: string; deletedAt?: Date | null }): boolean {
  // Pre-convergence Service Engagement uploads used these two equivalent states.
  // Keep them readable while all new uploads use the canonical Vault state model.
  return !value.deletedAt && value.storageState === 'stored' && value.scanState === 'signature_validated'
}

export function engagementDocumentIsDistributable(value: { storageState: string; scanState: string; deletedAt?: Date | null }): boolean {
  return vaultObjectIsDistributable(value) || legacyCommercialObjectIsDistributable(value)
}

export async function uploadEngagementEvidence(args: {
  weddingId: string
  actorId: string
  engagementId: string
  linkRole: string
  file: File
}) {
  const { weddingId, actorId, engagementId, file } = args
  const linkRole = validateRole(args.linkRole)
  await assertEngagementInWedding(weddingId, engagementId)

  if (!ALLOWED_ENGAGEMENT_DOCUMENT_MIME_TYPES.has(file.type)) {
    throw new VaultEvidenceError('Documents must be PDF, JPEG, PNG, or WebP.', 415, 'file')
  }

  let prepared
  try {
    prepared = await prepareVaultUpload({
      file,
      weddingId,
      actorId,
      source: 'service_engagement_document',
      category: 'commercial_document',
      metadata: {
        serviceEngagementId: engagementId,
        documentRole: linkRole,
      },
    })
  } catch (error) {
    if (error instanceof VaultUploadError) {
      throw new VaultEvidenceError(error.message, error.status, 'file')
    }
    throw error
  }

  try {
    await db.$transaction(async (tx) => {
      await registerPreparedVaultObject(prepared, tx)
      await linkCommercialDocumentGraph({
        tx,
        vaultObjectId: prepared.id,
        weddingId,
        engagementId,
        linkRole,
        actorId,
      })
    })
    return db.vaultObject.findUniqueOrThrow({ where: { id: prepared.id } })
  } catch (error) {
    await removePreparedVaultUpload(prepared)
    throw error
  }
}

export async function listEngagementEvidence(weddingId: string, engagementId: string) {
  await assertEngagementInWedding(weddingId, engagementId)
  const links = await db.vaultLink.findMany({
    where: {
      weddingId,
      entityType: 'service_engagement',
      entityId: engagementId,
    },
    include: { vaultObject: true },
    orderBy: { createdAt: 'desc' },
  })

  return links
    .filter((link) => link.vaultObject.deletedAt == null)
    .map((link) => ({
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
    }))
}

export async function engagementEvidenceSignedUrl(args: {
  weddingId: string
  vaultObjectId: string
}): Promise<{ signedUrl: string; fileName: string }> {
  const link = await db.vaultLink.findFirst({
    where: {
      weddingId: args.weddingId,
      vaultObjectId: args.vaultObjectId,
      entityType: 'service_engagement',
      vaultObject: { deletedAt: null },
    },
    include: { vaultObject: true },
  })
  if (!link) throw new VaultEvidenceError('Vault document not found.', 404)
  if (!engagementDocumentIsDistributable(link.vaultObject)) {
    throw new VaultEvidenceError('This document is not available for secure distribution.', 415)
  }

  try {
    const signedUrl = await signedVaultDownload({
      objectKey: link.vaultObject.objectKey,
      filename: link.vaultObject.originalFilename,
      distributable: true,
    })
    return { signedUrl, fileName: link.vaultObject.originalFilename }
  } catch (error) {
    if (error instanceof VaultUploadError) {
      throw new VaultEvidenceError(error.message, error.status)
    }
    throw error
  }
}
