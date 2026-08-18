import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export const WEWED_VAULT_BUCKET = 'wewed-vault'
export const WEWED_VAULT_MAX_BYTES = 25 * 1024 * 1024
export const WEWED_VAULT_SIGNED_URL_SECONDS = 10 * 60

const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

const IMMEDIATELY_DISTRIBUTABLE = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'text/plain',
  'text/csv',
])

const QUARANTINE_UNTIL_SCANNED = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export class VaultUploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 | 500 = 400,
  ) {
    super(message)
    this.name = 'VaultUploadError'
  }
}

export type PreparedVaultUpload = {
  id: string
  weddingId: string
  objectKey: string
  originalFilename: string
  displayName: string
  mimeType: string
  extension: string
  byteSize: number
  checksumSha256: string
  uploaderActorId: string | null
  uploadSource: string
  storageState: 'stored_private' | 'quarantined'
  scanState: 'content_validated' | 'external_scan_required'
  metadata: string
  distributable: boolean
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    throw new VaultUploadError('Private file storage is not configured.', 500)
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function safeFilename(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._() -]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return (normalized || 'file').slice(0, 160)
}

function extensionFor(file: File): string {
  const expected = MIME_TO_EXTENSION[file.type]
  if (!expected) throw new VaultUploadError('This file type is not supported.', 415)
  const suffix = file.name.toLowerCase().split('.').pop() ?? ''
  const aliases = expected === 'jpg' ? new Set(['jpg', 'jpeg']) : new Set([expected])
  if (!aliases.has(suffix)) {
    throw new VaultUploadError('The filename extension does not match the declared file type.', 415)
  }
  return expected
}

function startsWith(bytes: Uint8Array, expected: number[]): boolean {
  if (bytes.length < expected.length) return false
  return expected.every((value, index) => bytes[index] === value)
}

function printableText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false
  const sample = bytes.slice(0, Math.min(bytes.length, 8192))
  let controls = 0
  for (const value of sample) {
    if (value < 9 || (value > 13 && value < 32)) controls += 1
  }
  return sample.length === 0 || controls / sample.length < 0.01
}

function validateContentSignature(mimeType: string, bytes: Uint8Array): void {
  if (mimeType === 'application/pdf') {
    const header = new TextDecoder('ascii').decode(bytes.slice(0, 5))
    if (header !== '%PDF-') throw new VaultUploadError('The PDF content signature is invalid.', 415)
    return
  }
  if (mimeType === 'image/jpeg') {
    if (!startsWith(bytes, [0xff, 0xd8, 0xff])) throw new VaultUploadError('The JPEG content signature is invalid.', 415)
    return
  }
  if (mimeType === 'image/png') {
    if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) throw new VaultUploadError('The PNG content signature is invalid.', 415)
    return
  }
  if (mimeType === 'image/webp') {
    const riff = new TextDecoder('ascii').decode(bytes.slice(0, 4))
    const webp = new TextDecoder('ascii').decode(bytes.slice(8, 12))
    if (riff !== 'RIFF' || webp !== 'WEBP') throw new VaultUploadError('The WebP content signature is invalid.', 415)
    return
  }
  if (mimeType === 'image/gif') {
    const header = new TextDecoder('ascii').decode(bytes.slice(0, 6))
    if (header !== 'GIF87a' && header !== 'GIF89a') throw new VaultUploadError('The GIF content signature is invalid.', 415)
    return
  }
  if (mimeType === 'video/mp4') {
    const box = new TextDecoder('ascii').decode(bytes.slice(4, 8))
    if (box !== 'ftyp') throw new VaultUploadError('The MP4 container signature is invalid.', 415)
    return
  }
  if (mimeType === 'video/webm') {
    if (!startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) throw new VaultUploadError('The WebM container signature is invalid.', 415)
    return
  }
  if (mimeType === 'text/plain' || mimeType === 'text/csv') {
    if (!printableText(bytes)) throw new VaultUploadError('The text file contains unsupported binary content.', 415)
    return
  }
  if (QUARANTINE_UNTIL_SCANNED.has(mimeType)) {
    if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
      throw new VaultUploadError('The Office document container signature is invalid.', 415)
    }
    return
  }
  throw new VaultUploadError('This file type is not supported.', 415)
}

async function ensurePrivateVaultBucket(): Promise<void> {
  const supabase = supabaseAdmin()
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) throw new VaultUploadError('Private file storage is unavailable.', 500)
  const existing = buckets?.find((bucket) => bucket.id === WEWED_VAULT_BUCKET)
  if (existing) {
    if (existing.public) throw new VaultUploadError('Wewed Vault storage must remain private.', 500)
    return
  }
  const { error } = await supabase.storage.createBucket(WEWED_VAULT_BUCKET, {
    public: false,
    fileSizeLimit: WEWED_VAULT_MAX_BYTES,
  })
  if (error && !/already exists/i.test(error.message)) {
    throw new VaultUploadError('Could not initialize private Vault storage.', 500)
  }
}

export function vaultFilePolicy(file: File): {
  extension: string
  distributable: boolean
  scanState: PreparedVaultUpload['scanState']
} {
  if (!file || file.size <= 0) throw new VaultUploadError('Choose a non-empty file.')
  if (file.size > WEWED_VAULT_MAX_BYTES) {
    throw new VaultUploadError('Files must be 25 MB or smaller.', 413)
  }
  const extension = extensionFor(file)
  if (!IMMEDIATELY_DISTRIBUTABLE.has(file.type) && !QUARANTINE_UNTIL_SCANNED.has(file.type)) {
    throw new VaultUploadError('This file type is not supported.', 415)
  }
  const distributable = IMMEDIATELY_DISTRIBUTABLE.has(file.type)
  return {
    extension,
    distributable,
    scanState: distributable ? 'content_validated' : 'external_scan_required',
  }
}

export async function prepareVaultUpload(input: {
  file: File
  weddingId: string
  actorId?: string | null
  source: string
  category?: string
  metadata?: Record<string, unknown>
}): Promise<PreparedVaultUpload> {
  const { extension, distributable, scanState } = vaultFilePolicy(input.file)
  const bytes = new Uint8Array(await input.file.arrayBuffer())
  validateContentSignature(input.file.type, bytes)
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex')
  const id = `vault-${randomUUID()}`
  const filename = safeFilename(input.file.name)
  const objectKey = `${input.weddingId}/${new Date().toISOString().slice(0, 10)}/${id}.${extension}`
  await ensurePrivateVaultBucket()
  const supabase = supabaseAdmin()
  const { error } = await supabase.storage.from(WEWED_VAULT_BUCKET).upload(objectKey, bytes, {
    contentType: input.file.type,
    upsert: false,
    cacheControl: '0',
  })
  if (error) throw new VaultUploadError('Could not store the private file.', 500)

  return {
    id,
    weddingId: input.weddingId,
    objectKey,
    originalFilename: filename,
    displayName: filename,
    mimeType: input.file.type,
    extension,
    byteSize: input.file.size,
    checksumSha256,
    uploaderActorId: input.actorId ?? null,
    uploadSource: input.source,
    storageState: distributable ? 'stored_private' : 'quarantined',
    scanState,
    metadata: JSON.stringify({ category: input.category ?? 'wedding_document', ...(input.metadata ?? {}) }),
    distributable,
  }
}

export async function registerPreparedVaultObject(
  prepared: PreparedVaultUpload,
  tx: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  await tx.vaultObject.create({
    data: {
      id: prepared.id,
      storageProvider: 'supabase',
      objectKey: prepared.objectKey,
      originalFilename: prepared.originalFilename,
      displayName: prepared.displayName,
      mimeType: prepared.mimeType,
      extension: prepared.extension,
      byteSize: BigInt(prepared.byteSize),
      checksumSha256: prepared.checksumSha256,
      uploaderActorId: prepared.uploaderActorId,
      uploadSource: prepared.uploadSource,
      storageState: prepared.storageState,
      scanState: prepared.scanState,
      retentionClass: 'wedding_record',
      sensitivity: 'private',
      publicationState: 'private',
      metadata: prepared.metadata,
      weddingId: prepared.weddingId,
    },
  })
}

export async function createVaultLink(input: {
  vaultObjectId: string
  weddingId: string
  entityType: string
  entityId: string
  linkRole: string
  actorId?: string | null
  tx?: Prisma.TransactionClient | typeof db
}): Promise<void> {
  const tx = input.tx ?? db
  await tx.vaultLink.upsert({
    where: {
      vaultObjectId_entityType_entityId_linkRole: {
        vaultObjectId: input.vaultObjectId,
        entityType: input.entityType,
        entityId: input.entityId,
        linkRole: input.linkRole,
      },
    },
    update: {},
    create: {
      id: `vault-link-${randomUUID()}`,
      vaultObjectId: input.vaultObjectId,
      weddingId: input.weddingId,
      entityType: input.entityType,
      entityId: input.entityId,
      linkRole: input.linkRole,
      createdById: input.actorId ?? null,
    },
  })
}

export async function removePreparedVaultUpload(prepared: Pick<PreparedVaultUpload, 'objectKey'>): Promise<void> {
  try {
    await supabaseAdmin().storage.from(WEWED_VAULT_BUCKET).remove([prepared.objectKey])
  } catch {
    // Reconciliation/observability can surface an orphaned object; never mask the original failure.
  }
}

export async function signedVaultDownload(input: {
  objectKey: string
  filename: string
  distributable?: boolean
}): Promise<string> {
  if (input.distributable === false) {
    throw new VaultUploadError('This file is quarantined and cannot be distributed yet.', 415)
  }
  const { data, error } = await supabaseAdmin().storage
    .from(WEWED_VAULT_BUCKET)
    .createSignedUrl(input.objectKey, WEWED_VAULT_SIGNED_URL_SECONDS, {
      download: safeFilename(input.filename),
    })
  if (error || !data?.signedUrl) throw new VaultUploadError('Could not create a secure download link.', 500)
  return data.signedUrl
}

export function vaultObjectIsDistributable(value: { storageState: string; scanState: string; deletedAt?: Date | null }): boolean {
  return !value.deletedAt && value.storageState === 'stored_private' && value.scanState === 'content_validated'
}
