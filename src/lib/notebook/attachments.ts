import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  createVaultLink,
  prepareVaultUpload,
  registerPreparedVaultObject,
  removePreparedVaultUpload,
  signedVaultDownload,
  vaultObjectIsDistributable,
  VaultUploadError,
  WEWED_VAULT_BUCKET,
} from '@/lib/vault/core'
import { actorCanEditNote } from './access'
import { getNote, writeAudit } from './store'
import {
  NotebookForbiddenError,
  NotebookNotFoundError,
  NotebookValidationError,
  type NotebookActor,
} from './types'

const LEGACY_BUCKET = 'wewed-notebook-files'
const MAX_BYTES = 25 * 1024 * 1024
const LEGACY_ALLOWED_MIME = new Set([
  'image/jpeg','image/png','image/webp','image/gif',
  'application/pdf','text/plain','text/markdown','text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

interface AttachmentRow {
  id: string
  noteId: string
  storageBucket: string
  storageKey: string
  fileName: string
  mimeType: string
  sizeBytes: bigint | number
  status: string
  createdByUserId: string
  vaultObjectId: string | null
  deletedAt: Date | null
  createdAt: Date
}

async function ensureLegacyBucket() {
  const client = createSupabaseServiceClient()
  const { data, error } = await client.storage.listBuckets()
  if (error) throw new Error(`Storage is unavailable: ${error.message}`)
  if (data.some((bucket) => bucket.name === LEGACY_BUCKET)) return
  const created = await client.storage.createBucket(LEGACY_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Array.from(LEGACY_ALLOWED_MIME),
  })
  if (created.error && !created.error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Could not create private Notebook file storage: ${created.error.message}`)
  }
}

function cleanFileName(name: string): string {
  return name.replace(/[\\/\0]/g, '_').trim().slice(0, 240) || 'attachment'
}

function extension(name: string): string {
  const value = cleanFileName(name)
  const index = value.lastIndexOf('.')
  return index >= 0 ? value.slice(index).toLowerCase().replace(/[^a-z0-9.]/g, '') : ''
}

async function getAttachment(actor: NotebookActor, attachmentId: string): Promise<AttachmentRow> {
  const rows = await db.$queryRawUnsafe<AttachmentRow[]>(
    `SELECT * FROM wewed_notebook."NotebookAttachment" WHERE id=$1 AND "deletedAt" IS NULL LIMIT 1`,
    attachmentId,
  )
  const attachment = rows[0]
  if (!attachment) throw new NotebookNotFoundError('Attachment not found.')
  await getNote(actor, attachment.noteId)
  return attachment
}

export async function listAttachments(actor: NotebookActor, noteId: string) {
  await getNote(actor, noteId)
  const rows = await db.$queryRawUnsafe<AttachmentRow[]>(
    `SELECT * FROM wewed_notebook."NotebookAttachment"
      WHERE "noteId"=$1 AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC`,
    noteId,
  )
  return rows.map((row) => ({ ...row, sizeBytes: Number(row.sizeBytes) }))
}

async function uploadLegacyAttachment(actor: NotebookActor, noteId: string, file: File) {
  if (!LEGACY_ALLOWED_MIME.has(file.type)) throw new NotebookValidationError('Unsupported attachment type.')
  if (file.size <= 0 || file.size > MAX_BYTES) throw new NotebookValidationError('Attachment must be between 1 byte and 25 MB.')

  await ensureLegacyBucket()
  const client = createSupabaseServiceClient()
  const id = randomUUID()
  const storageKey = `${actor.session.userId}/${noteId}/${id}${extension(file.name)}`
  const uploaded = await client.storage.from(LEGACY_BUCKET).upload(storageKey, new Uint8Array(await file.arrayBuffer()), {
    contentType: file.type,
    upsert: false,
  })
  if (uploaded.error) throw new Error(`Attachment upload failed: ${uploaded.error.message}`)

  try {
    await db.$executeRawUnsafe(
      `INSERT INTO wewed_notebook."NotebookAttachment"
        (id, "noteId", "storageBucket", "storageKey", "fileName", "mimeType", "sizeBytes", status, "createdByUserId", "vaultObjectId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'READY',$8,NULL)`,
      id,
      noteId,
      LEGACY_BUCKET,
      storageKey,
      cleanFileName(file.name),
      file.type,
      file.size,
      actor.session.userId,
    )
  } catch (error) {
    await client.storage.from(LEGACY_BUCKET).remove([storageKey])
    throw error
  }
  return getAttachment(actor, id)
}

export async function uploadAttachment(actor: NotebookActor, noteId: string, file: File) {
  const note = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()

  if (!note.weddingId) {
    const attachment = await uploadLegacyAttachment(actor, noteId, file)
    await writeAudit(actor, noteId, 'ATTACHMENT_UPLOADED', {
      attachmentId: attachment.id,
      mimeType: file.type,
      sizeBytes: file.size,
      storageDomain: 'notebook_legacy_contextless',
    })
    return attachment
  }

  let prepared
  try {
    prepared = await prepareVaultUpload({
      file,
      weddingId: note.weddingId,
      actorId: actor.session.userId,
      source: 'notebook_attachment',
      category: 'planner_note',
      metadata: { noteId, noteVisibility: note.visibility },
    })
  } catch (error) {
    if (error instanceof VaultUploadError) throw new NotebookValidationError(error.message)
    throw error
  }

  const attachmentId = randomUUID()
  try {
    await db.$transaction(async (tx) => {
      await registerPreparedVaultObject(prepared, tx)
      await createVaultLink({
        vaultObjectId: prepared.id,
        weddingId: note.weddingId!,
        entityType: 'notebook_note',
        entityId: noteId,
        linkRole: 'attachment',
        actorId: actor.session.userId,
        tx,
      })
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_notebook."NotebookAttachment"
          (id, "noteId", "storageBucket", "storageKey", "fileName", "mimeType", "sizeBytes", status, "createdByUserId", "vaultObjectId")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        attachmentId,
        noteId,
        WEWED_VAULT_BUCKET,
        prepared.objectKey,
        prepared.originalFilename,
        prepared.mimeType,
        prepared.byteSize,
        prepared.distributable ? 'READY' : 'QUARANTINED',
        actor.session.userId,
        prepared.id,
      )
    })
  } catch (error) {
    await removePreparedVaultUpload(prepared)
    throw error
  }

  await writeAudit(actor, noteId, 'ATTACHMENT_UPLOADED', {
    attachmentId,
    vaultObjectId: prepared.id,
    mimeType: file.type,
    sizeBytes: file.size,
    storageDomain: 'wewed_vault',
    scanState: prepared.scanState,
  })
  return getAttachment(actor, attachmentId)
}

export async function attachmentSignedUrl(actor: NotebookActor, attachmentId: string): Promise<string> {
  const attachment = await getAttachment(actor, attachmentId)
  if (!attachment.vaultObjectId) {
    const client = createSupabaseServiceClient()
    const { data, error } = await client.storage.from(attachment.storageBucket).createSignedUrl(attachment.storageKey, 600, {
      download: attachment.fileName,
    })
    if (error || !data?.signedUrl) throw new Error('Could not authorize attachment download.')
    return data.signedUrl
  }

  const object = await db.vaultObject.findUnique({
    where: { id: attachment.vaultObjectId },
    select: {
      objectKey: true,
      originalFilename: true,
      storageState: true,
      scanState: true,
      deletedAt: true,
    },
  })
  if (!object || !vaultObjectIsDistributable(object)) {
    throw new NotebookValidationError('This attachment is quarantined and cannot be opened yet.')
  }
  return signedVaultDownload({
    objectKey: object.objectKey,
    filename: object.originalFilename,
    distributable: true,
  })
}

export async function deleteAttachment(actor: NotebookActor, attachmentId: string): Promise<void> {
  const attachment = await getAttachment(actor, attachmentId)
  const note = await getNote(actor, attachment.noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()

  if (!attachment.vaultObjectId) {
    const client = createSupabaseServiceClient()
    const removed = await client.storage.from(attachment.storageBucket).remove([attachment.storageKey])
    if (removed.error) throw new Error(`Attachment deletion failed: ${removed.error.message}`)
    await db.$executeRawUnsafe(
      `UPDATE wewed_notebook."NotebookAttachment" SET "deletedAt"=CURRENT_TIMESTAMP, status='DELETED' WHERE id=$1`,
      attachmentId,
    )
  } else {
    // Vault-backed files are detached from the editable note, not silently destroyed. Other
    // evidence/entity links and retention obligations remain intact.
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE wewed_notebook."NotebookAttachment" SET "deletedAt"=CURRENT_TIMESTAMP, status='DETACHED' WHERE id=$1`,
        attachmentId,
      )
      await tx.vaultLink.deleteMany({
        where: {
          vaultObjectId: attachment.vaultObjectId!,
          entityType: 'notebook_note',
          entityId: attachment.noteId,
          linkRole: 'attachment',
        },
      })
    })
  }

  await writeAudit(actor, attachment.noteId, 'ATTACHMENT_DELETED', {
    attachmentId,
    vaultObjectId: attachment.vaultObjectId,
    binaryRetainedInVault: Boolean(attachment.vaultObjectId),
  })
}
