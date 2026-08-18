import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { actorCanEditNote } from './access'
import { getNote, writeAudit } from './store'
import {
  NotebookConflictError,
  NotebookForbiddenError,
  NotebookNotFoundError,
  NotebookValidationError,
  type NotebookActor,
} from './types'

const NOTEBOOK_BUCKET = 'wewed-notebook'
const MAX_RECORDING_BYTES = 100 * 1024 * 1024
const RECORDING_MIME = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'video/webm',
])

interface RecordingRow {
  id: string
  noteId: string
  storageBucket: string
  storageKey: string
  mimeType: string
  sizeBytes: bigint | number
  durationMs: number | null
  status: 'UPLOADING' | 'READY' | 'TRANSCRIBING' | 'TRANSCRIBED' | 'FAILED'
  transcriptionProvider: string | null
  transcriptionJobId: string | null
  errorCode: string | null
  errorMessage: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}

async function ensurePrivateBucket(): Promise<void> {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.storage.listBuckets()
  if (error) throw new Error(`Storage is unavailable: ${error.message}`)
  if (data.some((bucket) => bucket.name === NOTEBOOK_BUCKET)) return
  const created = await supabase.storage.createBucket(NOTEBOOK_BUCKET, {
    public: false,
    fileSizeLimit: MAX_RECORDING_BYTES,
    allowedMimeTypes: Array.from(RECORDING_MIME),
  })
  if (created.error && !created.error.message.toLowerCase().includes('already exists')) {
    throw new Error(`Could not create private Notebook storage: ${created.error.message}`)
  }
}

function extensionForMime(mime: string): string {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('mpeg')) return 'mp3'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

async function getRecording(actor: NotebookActor, recordingId: string): Promise<RecordingRow> {
  const rows = await db.$queryRawUnsafe<RecordingRow[]>(
    `SELECT * FROM wewed_notebook."NotebookRecording" WHERE id=$1 LIMIT 1`,
    recordingId,
  )
  const recording = rows[0]
  if (!recording) throw new NotebookNotFoundError('Recording not found.')
  await getNote(actor, recording.noteId)
  return recording
}

export async function listRecordings(actor: NotebookActor, noteId: string) {
  await getNote(actor, noteId)
  const rows = await db.$queryRawUnsafe<RecordingRow[]>(
    `SELECT * FROM wewed_notebook."NotebookRecording" WHERE "noteId"=$1 ORDER BY "createdAt" DESC`,
    noteId,
  )
  return rows.map((row) => ({ ...row, sizeBytes: Number(row.sizeBytes) }))
}

export async function uploadRecording(
  actor: NotebookActor,
  noteId: string,
  file: File,
  durationMs?: number | null,
) {
  const note = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  if (!RECORDING_MIME.has(file.type)) {
    throw new NotebookValidationError('Unsupported recording format. Use WebM, MP4/M4A, MP3, WAV or OGG audio.')
  }
  if (file.size <= 0 || file.size > MAX_RECORDING_BYTES) {
    throw new NotebookValidationError('Recording must be between 1 byte and 100 MB.')
  }

  await ensurePrivateBucket()
  const supabase = createSupabaseServiceClient()
  const id = randomUUID()
  const storageKey = `${actor.session.userId}/${noteId}/${id}.${extensionForMime(file.type)}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const uploaded = await supabase.storage.from(NOTEBOOK_BUCKET).upload(storageKey, bytes, {
    contentType: file.type,
    upsert: false,
  })
  if (uploaded.error) throw new Error(`Recording upload failed: ${uploaded.error.message}`)

  try {
    await db.$executeRawUnsafe(
      `INSERT INTO wewed_notebook."NotebookRecording"
        (id, "noteId", "storageBucket", "storageKey", "mimeType", "sizeBytes", "durationMs", status, "createdByUserId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'READY',$8)`,
      id,
      noteId,
      NOTEBOOK_BUCKET,
      storageKey,
      file.type,
      file.size,
      typeof durationMs === 'number' && Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : null,
      actor.session.userId,
    )
  } catch (error) {
    await supabase.storage.from(NOTEBOOK_BUCKET).remove([storageKey])
    throw error
  }
  await writeAudit(actor, noteId, 'RECORDING_UPLOADED', { recordingId: id, sizeBytes: file.size, mimeType: file.type })
  return getRecording(actor, id)
}

export async function getRecordingSignedUrl(
  actor: NotebookActor,
  recordingId: string,
  expiresInSeconds = 600,
): Promise<string> {
  const recording = await getRecording(actor, recordingId)
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.storage
    .from(recording.storageBucket)
    .createSignedUrl(recording.storageKey, Math.min(Math.max(expiresInSeconds, 60), 3600))
  if (error || !data?.signedUrl) throw new Error('Could not create an authorized recording URL.')
  return data.signedUrl
}

export async function transcribeRecording(actor: NotebookActor, recordingId: string) {
  const recording = await getRecording(actor, recordingId)
  const note = await getNote(actor, recording.noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  if (!['READY', 'FAILED', 'TRANSCRIBED'].includes(recording.status)) {
    throw new NotebookConflictError('Recording is already being processed.')
  }

  const endpoint = process.env.WEWED_TRANSCRIPTION_URL?.trim()
  const apiKey = process.env.WEWED_TRANSCRIPTION_API_KEY?.trim()
  const model = process.env.WEWED_TRANSCRIPTION_MODEL?.trim() || 'whisper-1'
  if (!endpoint) {
    await db.$executeRawUnsafe(
      `UPDATE wewed_notebook."NotebookRecording"
          SET status='FAILED', "errorCode"='TRANSCRIPTION_NOT_CONFIGURED',
              "errorMessage"='Recording is preserved. Configure WEWED_TRANSCRIPTION_URL to transcribe it.',
              "updatedAt"=CURRENT_TIMESTAMP
        WHERE id=$1`,
      recordingId,
    )
    return { success: false, preserved: true, code: 'TRANSCRIPTION_NOT_CONFIGURED' }
  }

  await db.$executeRawUnsafe(
    `UPDATE wewed_notebook."NotebookRecording"
        SET status='TRANSCRIBING', "errorCode"=NULL, "errorMessage"=NULL,
            "transcriptionProvider"=$2, "updatedAt"=CURRENT_TIMESTAMP
      WHERE id=$1`,
    recordingId,
    new URL(endpoint).hostname,
  )

  try {
    const supabase = createSupabaseServiceClient()
    const downloaded = await supabase.storage.from(recording.storageBucket).download(recording.storageKey)
    if (downloaded.error || !downloaded.data) throw new Error(downloaded.error?.message || 'Recording download failed.')

    const form = new FormData()
    form.set('file', new File([downloaded.data], `recording.${extensionForMime(recording.mimeType)}`, { type: recording.mimeType }))
    form.set('model', model)
    form.set('response_format', 'verbose_json')

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      body: form,
      signal: AbortSignal.timeout(120_000),
    })
    if (!response.ok) throw new Error(`Transcription provider returned HTTP ${response.status}.`)
    const json = (await response.json()) as Record<string, unknown>
    const transcriptText = typeof json.text === 'string' ? json.text.trim() : ''
    if (!transcriptText) throw new Error('Transcription provider returned no transcript text.')
    const segments = Array.isArray(json.segments) ? json.segments : []
    const language = typeof json.language === 'string' ? json.language : null
    const providerJobId = typeof json.id === 'string' ? json.id : null

    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_notebook."NotebookTranscript"
          (id, "recordingId", "noteId", text, segments, language, provider, "providerJobId", "updatedByUserId")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
         ON CONFLICT ("recordingId") DO UPDATE SET
           text=EXCLUDED.text, segments=EXCLUDED.segments, language=EXCLUDED.language,
           provider=EXCLUDED.provider, "providerJobId"=EXCLUDED."providerJobId",
           revision=wewed_notebook."NotebookTranscript".revision + 1,
           "updatedByUserId"=EXCLUDED."updatedByUserId", "updatedAt"=CURRENT_TIMESTAMP`,
        randomUUID(),
        recordingId,
        note.id,
        transcriptText,
        JSON.stringify(segments),
        language,
        new URL(endpoint).hostname,
        providerJobId,
        actor.session.userId,
      )
      await tx.$executeRawUnsafe(
        `UPDATE wewed_notebook."NotebookRecording"
            SET status='TRANSCRIBED', "transcriptionJobId"=$2,
                "errorCode"=NULL, "errorMessage"=NULL, "updatedAt"=CURRENT_TIMESTAMP
          WHERE id=$1`,
        recordingId,
        providerJobId,
      )
    })
    await writeAudit(actor, note.id, 'RECORDING_TRANSCRIBED', { recordingId, provider: new URL(endpoint).hostname })
    return { success: true, text: transcriptText, segments, language }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed.'
    await db.$executeRawUnsafe(
      `UPDATE wewed_notebook."NotebookRecording"
          SET status='FAILED', "errorCode"='TRANSCRIPTION_FAILED', "errorMessage"=$2,
              "updatedAt"=CURRENT_TIMESTAMP
        WHERE id=$1`,
      recordingId,
      message.slice(0, 1000),
    )
    await writeAudit(actor, note.id, 'RECORDING_TRANSCRIPTION_FAILED', { recordingId })
    return { success: false, preserved: true, code: 'TRANSCRIPTION_FAILED', error: message }
  }
}

export async function getTranscript(actor: NotebookActor, recordingId: string) {
  const recording = await getRecording(actor, recordingId)
  const rows = await db.$queryRawUnsafe<Array<{
    id: string
    recordingId: string
    noteId: string
    text: string
    segments: unknown
    language: string | null
    confidence: number | null
    provider: string | null
    providerJobId: string | null
    revision: number
    updatedByUserId: string | null
    createdAt: Date
    updatedAt: Date
  }>>(
    `SELECT * FROM wewed_notebook."NotebookTranscript" WHERE "recordingId"=$1 AND "noteId"=$2 LIMIT 1`,
    recordingId,
    recording.noteId,
  )
  return rows[0] ?? null
}

export async function updateTranscript(
  actor: NotebookActor,
  recordingId: string,
  transcriptText: string,
  segments?: unknown,
) {
  const recording = await getRecording(actor, recordingId)
  const note = await getNote(actor, recording.noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  const normalized = transcriptText.trim()
  if (!normalized || normalized.length > 2_000_000) {
    throw new NotebookValidationError('Transcript must contain between 1 and 2,000,000 characters.')
  }
  await db.$executeRawUnsafe(
    `UPDATE wewed_notebook."NotebookTranscript"
        SET text=$2, segments=$3::jsonb, revision=revision+1,
            "updatedByUserId"=$4, "updatedAt"=CURRENT_TIMESTAMP
      WHERE "recordingId"=$1`,
    recordingId,
    normalized,
    JSON.stringify(Array.isArray(segments) ? segments : []),
    actor.session.userId,
  )
  await writeAudit(actor, note.id, 'TRANSCRIPT_CORRECTED', { recordingId })
  return getTranscript(actor, recordingId)
}
