import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-gate'
import { getModuleSchema, isModuleKey } from '@/lib/import-engine/schemas'
import { parseFile } from '@/lib/import-engine/parser'
import { generatePreview } from '@/lib/import-engine/preview'
import { getFlagshipWeddingId } from '@/lib/import-engine/wedding'
import type { ImportPreview } from '@/lib/import-engine/types'

/* ============================================================
   /api/imports
   ------------------------------------------------------------
   POST → accepts file upload + moduleKey, parses the file,
          generates an ImportPreview, stores it in memory keyed
          by a jobId, and returns the preview. Does NOT execute.

   Multipart form-data:
     file      = the .xlsx or .csv file (≤10 MB)
     moduleKey = one of the 10 module keys

   Response:
     200 { success, jobId, preview: ImportPreview }
     400 { success: false, error }  — bad request
     401 { success: false, error }  — not admin
     413 { success: false, error }  — file too big
     500 { success: false, error }  — server error
   ============================================================ */

// 10 MB upload cap (matches the spec).
const MAX_FILE_BYTES = 10 * 1024 * 1024

// Allowed file extensions
const ALLOWED_EXTS = ['.xlsx', '.csv']

// In-memory preview store — keyed by jobId. Per-wedding cap below.
// Replaced by a Prisma ImportJob model in a later hardening pass.
const PREVIEW_STORE = new Map<string, { preview: ImportPreview; weddingId: string; createdAt: string }>()
const MAX_PREVIEWS = 30

// Prune oldest previews when the store grows.
function prunePreviews(): void {
  if (PREVIEW_STORE.size < MAX_PREVIEWS) return
  const entries = Array.from(PREVIEW_STORE.entries()).sort((a, b) =>
    a[1].createdAt < b[1].createdAt ? -1 : 1,
  )
  while (entries.length >= MAX_PREVIEWS) {
    const oldest = entries.shift()
    if (oldest) PREVIEW_STORE.delete(oldest[0])
  }
}

/** Test/dev helper to inspect the preview store. */
export function _peekPreviewStore() {
  return PREVIEW_STORE
}

/** Get a stored preview by jobId — used by the [jobId] route. */
export function getStoredPreview(jobId: string): ImportPreview | undefined {
  return PREVIEW_STORE.get(jobId)?.preview
}

/** Store a preview — used here. */
export function storePreview(jobId: string, preview: ImportPreview, weddingId: string): void {
  prunePreviews()
  PREVIEW_STORE.set(jobId, { preview, weddingId, createdAt: new Date().toISOString() })
}

export async function POST(request: NextRequest) {
  // ── Admin gate ──
  const gateFail = requireAdmin(request)
  if (gateFail) return gateFail

  try {
    // ── Parse multipart form ──
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Expected multipart/form-data with a file and moduleKey.' },
        { status: 400 },
      )
    }

    const fileEntry = form.get('file')
    const moduleKey = (form.get('moduleKey') as string | null)?.toString().trim()

    if (!fileEntry) {
      return NextResponse.json(
        { success: false, error: 'Missing "file" field.' },
        { status: 400 },
      )
    }
    // form.get returns File | string; we only accept File.
    if (typeof fileEntry === 'string') {
      return NextResponse.json(
        { success: false, error: '"file" must be a file upload, not a string.' },
        { status: 400 },
      )
    }
    const file: File = fileEntry
    if (!moduleKey) {
      return NextResponse.json(
        { success: false, error: 'Missing "moduleKey" field.' },
        { status: 400 },
      )
    }
    if (!isModuleKey(moduleKey)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown moduleKey "${moduleKey}". Valid: guests, budget, checklist, seating, vendors, timeline, songs, wedding-party, travel, media`,
        },
        { status: 400 },
      )
    }

    // ── File size check ──
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)} MB. Max: 10 MB.`,
        },
        { status: 413 },
      )
    }

    // ── Extension check ──
    const fileName = (file instanceof File ? file.name : 'upload') || 'upload'
    const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `File extension "${ext}" not allowed. Use .xlsx or .csv.`,
        },
        { status: 400 },
      )
    }

    // ── Resolve wedding ──
    const weddingId = await getFlagshipWeddingId()
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'Flagship wedding not found. Seed the database first.' },
        { status: 404 },
      )
    }

    // ── Read file bytes ──
    const arrayBuf = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)

    // ── Parse + preview ──
    const mimeType = file instanceof File ? file.type : 'application/octet-stream'
    const parsed = await parseFile(buffer, mimeType)
    const schema = getModuleSchema(moduleKey)
    const preview = await generatePreview(parsed, schema, weddingId, fileName)

    // ── Generate a stable jobId from the file fingerprint + moduleKey ──
    // This means uploading the same file twice returns the same jobId,
    // so the user can refresh the preview without polluting the store.
    const jobId = `imp_${preview.fileFingerprint}_${moduleKey}`

    // ── Store the preview ──
    storePreview(jobId, preview, weddingId)

    return NextResponse.json({
      success: true,
      jobId,
      preview,
    })
  } catch (err) {
    console.error('[IMPORTS POST] error:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to parse + preview file',
      },
      { status: 500 },
    )
  }
}

/* GET /api/imports — list recent previews (for the UI's "recent imports" panel) */
export async function GET(request: NextRequest) {
  const gateFail = requireAdmin(request)
  if (gateFail) return gateFail

  const recent = Array.from(PREVIEW_STORE.entries())
    .map(([jobId, entry]) => ({
      jobId,
      moduleKey: entry.preview.moduleKey,
      fileName: entry.preview.fileName,
      totalRows: entry.preview.totalRows,
      newRecords: entry.preview.newRecords,
      updateRecords: entry.preview.updateRecords,
      invalidRows: entry.preview.invalidRows,
      createdAt: entry.createdAt,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 10)

  return NextResponse.json({ success: true, recent })
}
