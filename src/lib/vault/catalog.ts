import 'server-only'

import { db } from '@/lib/db'
import {
  createVaultLink,
  prepareVaultUpload,
  registerPreparedVaultObject,
  removePreparedVaultUpload,
  signedVaultDownload,
  vaultObjectIsDistributable,
} from '@/lib/vault/core'

const GENERAL_UPLOAD_CATEGORIES = new Set([
  'wedding_document',
  'inspiration',
  'couple_media',
])

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

export async function listWeddingVaultObjects(weddingId: string) {
  const objects = await db.vaultObject.findMany({
    where: { weddingId, deletedAt: null },
    include: {
      links: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          entityType: true,
          entityId: true,
          linkRole: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500,
  })

  return objects.map((object) => {
    const metadata = parseMetadata(object.metadata)
    return {
      id: object.id,
      displayName: object.displayName,
      originalFilename: object.originalFilename,
      mimeType: object.mimeType,
      extension: object.extension,
      byteSize: Number(object.byteSize),
      checksumSha256: object.checksumSha256,
      uploadSource: object.uploadSource,
      storageState: object.storageState,
      scanState: object.scanState,
      sensitivity: object.sensitivity,
      publicationState: object.publicationState,
      retentionClass: object.retentionClass,
      legalHold: object.legalHold,
      category: typeof metadata.category === 'string' ? metadata.category : 'wedding_document',
      createdAt: object.createdAt.toISOString(),
      archivedAt: object.archivedAt?.toISOString() ?? null,
      available: vaultObjectIsDistributable(object),
      links: object.links.map((link) => ({
        ...link,
        createdAt: link.createdAt.toISOString(),
      })),
    }
  })
}

export async function uploadWeddingVaultObject(input: {
  file: File
  weddingId: string
  actorId: string
  category?: string | null
}) {
  const category = input.category?.trim() || 'wedding_document'
  if (!GENERAL_UPLOAD_CATEGORIES.has(category)) {
    throw new Error('Unsupported Vault upload category.')
  }

  const prepared = await prepareVaultUpload({
    file: input.file,
    weddingId: input.weddingId,
    actorId: input.actorId,
    source: 'vault_workspace',
    category,
  })
  try {
    await db.$transaction(async (tx) => {
      await registerPreparedVaultObject(prepared, tx)
      await createVaultLink({
        vaultObjectId: prepared.id,
        weddingId: input.weddingId,
        entityType: 'wedding',
        entityId: input.weddingId,
        linkRole: category,
        actorId: input.actorId,
        tx,
      })
    })
  } catch (error) {
    await removePreparedVaultUpload(prepared)
    throw error
  }

  return {
    id: prepared.id,
    displayName: prepared.displayName,
    available: prepared.distributable,
    storageState: prepared.storageState,
    scanState: prepared.scanState,
  }
}

export async function findVaultObjectForDownload(id: string) {
  return db.vaultObject.findUnique({
    where: { id },
    select: {
      id: true,
      weddingId: true,
      objectKey: true,
      originalFilename: true,
      storageState: true,
      scanState: true,
      deletedAt: true,
    },
  })
}

export async function authorizeVaultObjectDownload(object: NonNullable<Awaited<ReturnType<typeof findVaultObjectForDownload>>>) {
  if (!vaultObjectIsDistributable(object)) {
    throw new Error('This Vault file is quarantined and cannot be opened yet.')
  }
  return signedVaultDownload({
    objectKey: object.objectKey,
    filename: object.originalFilename,
    distributable: true,
  })
}
