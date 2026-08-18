import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

const BUCKET = 'wewed-vault'
const MAX_BYTES = 25 * 1024 * 1024

const FILE_TYPES = {
  'application/pdf': { extension: 'pdf', signature: 'pdf' },
  'image/jpeg': { extension: 'jpg', signature: 'jpeg' },
  'image/png': { extension: 'png', signature: 'png' },
  'image/webp': { extension: 'webp', signature: 'webp' },
} as const

type AllowedMime = keyof typeof FILE_TYPES

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

async function ensureBucket(): Promise<void> {
  const client = createSupabaseServiceClient()
  const { data, error } = await client.storage.listBuckets()
  if (error) throw new Error(`Vault storage is unavailable: ${error.message}`)
  if (data.some((bucket) => bucket.name === BUCKET)) return

  const created = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(FILE_TYPES),
  })
  if (created.error && !created.error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Could not create private Wewed Vault storage: ${created.error.message}`)
  }
}

function cleanFileName(name: string): string {
  return name.replace(/[\\/\0]/g, '_').trim().slice(0, 240) || 'evidence'
}

function hasExpectedSignature(bytes: Uint8Array, mimeType: AllowedMime): boolean {
  if (mimeType === 'application/pdf') {
    return bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  }
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === 'image/png') {
    const expected = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    return bytes.length >= expected.length && expected.every((value, index) => bytes[index] === value)
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12
      && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
      && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  }
  return false
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
    where: { id: engagementId, weddingId, origin: 'historical' },
    select: { id: true },
  })
  if (!engagement) {
    throw new VaultEvidenceError('Historical service engagement not found.', 404)
  }
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

  if (!(file.type in FILE_TYPES)) {
    throw new VaultEvidenceError('Proof documents must be PDF, JPEG, PNG, or WebP.', 400, 'file')
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new VaultEvidenceError('Proof document must be between 1 byte and 25 MB.', 400, 'file')
  }

  const mimeType = file.type as AllowedMime
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!hasExpectedSignature(bytes, mimeType)) {
    throw new VaultEvidenceError('File contents do not match the declared file type.', 400, 'file')
  }

  await ensureBucket()
  const client = createSupabaseServiceClient()
  const id = randomUUID()
  const extension = FILE_TYPES[mimeType].extension
  const storageKey = `${weddingId}/service-engagements/${engagementId}/${id}.${extension}`
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex')

  const uploaded = await client.storage.from(BUCKET).upload(storageKey, bytes, {
    contentType: mimeType,
    upsert: false,
  })
  if (uploaded.error) throw new Error(`Vault evidence upload failed: ${uploaded.error.message}`)

  try {
    return await db.$transaction(async (tx) => {
      const object = await tx.vaultObject.create({
        data: {
          id,
          weddingId,
          storageProvider: 'supabase',
          objectKey: storageKey,
          originalFilename: cleanFileName(file.name),
          displayName: cleanFileName(file.name),
          mimeType,
          extension,
          byteSize: BigInt(file.size),
          checksumSha256,
          uploaderActorId: actorId,
          uploadSource: 'planner_historical_engagement',
          storageState: 'stored',
          scanState: 'signature_validated',
          retentionClass: 'wedding_record',
          legalHold: false,
          sensitivity: 'private',
          publicationState: 'private',
          metadata: JSON.stringify({ storageBucket: BUCKET }),
        },
      })
      await tx.vaultLink.create({
        data: {
          vaultObjectId: object.id,
          weddingId,
          entityType: 'service_engagement',
          entityId: engagementId,
          linkRole,
          createdById: actorId,
        },
      })
      return object
    })
  } catch (error) {
    await client.storage.from(BUCKET).remove([storageKey])
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
      vaultObject: { deletedAt: null, storageState: 'stored' },
    },
    include: { vaultObject: true },
  })
  if (!link) throw new VaultEvidenceError('Vault evidence not found.', 404)

  const client = createSupabaseServiceClient()
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(
    link.vaultObject.objectKey,
    600,
    { download: link.vaultObject.originalFilename },
  )
  if (error || !data?.signedUrl) throw new Error('Could not authorize Vault evidence download.')
  return { signedUrl: data.signedUrl, fileName: link.vaultObject.originalFilename }
}
