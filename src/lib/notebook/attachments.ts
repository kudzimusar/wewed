import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { actorCanEditNote } from './access'
import { getNote, writeAudit } from './store'
import {
  NotebookForbiddenError,
  NotebookNotFoundError,
  NotebookValidationError,
  type NotebookActor,
} from './types'

const BUCKET = 'wewed-notebook-files'
const MAX_BYTES = 25 * 1024 * 1024
const ALLOWED_MIME = new Set([
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
  deletedAt: Date | null
  createdAt: Date
}

async function ensureBucket() {
  const client = createSupabaseServiceClient()
  const { data, error } = await client.storage.listBuckets()
  if (error) throw new Error(`Storage is unavailable: ${error.message}`)
  if (data.some((bucket) => bucket.name === BUCKET)) return
  const created = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Array.from(ALLOWED_MIME),
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

export async function uploadAttachment(actor: NotebookActor, noteId: string, file: File) {
  const note = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  if (!ALLOWED_MIME.has(file.type)) throw new NotebookValidationError('Unsupported attachment type.')
  if (file.size <= 0 || file.size > MAX_BYTES) throw new NotebookValidationError('Attachment must be between 1 byte and 25 MB.')

  await ensureBucket()
  const client = createSupabaseServiceClient()
  const id = randomUUID()
  const storageKey = `${actor.session.userId}/${noteId}/${id}${extension(file.name)}`
  const uploaded = await client.storage.from(BUCKET).upload(storageKey, new Uint8Array(await file.arrayBuffer()), {
    contentType: file.type,
    upsert: false,
  })
  if (uploaded.error) throw new Error(`Attachment upload failed: ${uploaded.error.message}`)

  try {
    await db.$executeRawUnsafe(
      `INSERT INTO wewed_notebook."NotebookAttachment"
        (id, "noteId", "storageBucket", "storageKey", "fileName", "mimeType", "sizeBytes", status, "createdByUserId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'READY',$8)`,
      id,
      noteId,
      BUCKET,
      storageKey,
      cleanFileName(file.name),
      file.type,
      file.size,
      actor.session.userId,
    )
  } catch (error) {
    await client.storage.from(BUCKET).remove([storageKey])
    throw error
  }
  await writeAudit(actor, noteId, 'ATTACHMENT_UPLOADED', { attachmentId: id, mimeType: file.type, sizeBytes: file.size })
  return getAttachment(actor, id)
}

export async function attachmentSignedUrl(actor: NotebookActor, attachmentId: string): Promise<string> {
  const attachment = await getAttachment(actor, attachmentId)
  const client = createSupabaseServiceClient()
  const { data, error } = await client.storage.from(attachment.storageBucket).createSignedUrl(attachment.storageKey, 600, {
    download: attachment.fileName,
  })
  if (error || !data?.signedUrl) throw new Error('Could not authorize attachment download.')
  return data.signedUrl
}

export async function deleteAttachment(actor: NotebookActor, attachmentId: string): Promise<void> {
  const attachment = await getAttachment(actor, attachmentId)
  const note = await getNote(actor, attachment.noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  const client = createSupabaseServiceClient()
  const removed = await client.storage.from(attachment.storageBucket).remove([attachment.storageKey])
  if (removed.error) throw new Error(`Attachment deletion failed: ${removed.error.message}`)
  await db.$executeRawUnsafe(
    `UPDATE wewed_notebook."NotebookAttachment" SET "deletedAt"=CURRENT_TIMESTAMP, status='DELETED' WHERE id=$1`,
    attachmentId,
  )
  await writeAudit(actor, attachment.noteId, 'ATTACHMENT_DELETED', { attachmentId })
}
