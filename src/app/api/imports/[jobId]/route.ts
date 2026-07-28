import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-gate'
import { getModuleSchema } from '@/lib/import-engine/schemas'
import { executeImport, rollbackImport, peekRollback } from '@/lib/import-engine/executor'
import { getStoredPreview, _peekPreviewStore } from '../route'
import { getFlagshipWeddingId } from '@/lib/import-engine/wedding'

/* ============================================================
   /api/imports/[jobId]
   ------------------------------------------------------------
   GET     → get stored preview + (if executed) rollback status
   POST    → execute the import (apply changes)
   DELETE  → roll back an executed import (requires ?rollbackToken=)

   The jobId comes from POST /api/imports — it's a stable fingerprint
   of the file + module. The store is in-memory; restarting the dev
   server clears it.
   ============================================================ */

type RouteContext = { params: Promise<{ jobId: string }> }

// ─── GET /api/imports/[jobId] ──────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  const gateFail = requireAdmin(request)
  if (gateFail) return gateFail

  const { jobId } = await context.params
  const preview = getStoredPreview(jobId)

  if (!preview) {
    return NextResponse.json(
      { success: false, error: 'Import job not found. It may have expired — re-upload the file.' },
      { status: 404 },
    )
  }

  // Check if this preview has been executed (rollback snapshot exists).
  // We don't have a direct token→jobId map; the UI must pass the
  // rollback token via query to inspect execution status.
  const rollbackToken = new URL(request.url).searchParams.get('rollbackToken')
  let executed: { executedAt: string; createdIds: number; updatedSnapshots: number } | null = null
  if (rollbackToken) {
    const snap = peekRollback(rollbackToken)
    if (snap && snap.jobId.startsWith(jobId.replace('imp_', 'job_'))) {
      executed = {
        executedAt: snap.executedAt,
        createdIds: snap.createdIds.length,
        updatedSnapshots: snap.updatedSnapshots.length,
      }
    } else if (snap) {
      // Different jobId — return generic info
      executed = {
        executedAt: snap.executedAt,
        createdIds: snap.createdIds.length,
        updatedSnapshots: snap.updatedSnapshots.length,
      }
    }
  }

  return NextResponse.json({
    success: true,
    jobId,
    preview,
    executed,
  })
}

// ─── POST /api/imports/[jobId] — EXECUTE ──────────────────
export async function POST(request: NextRequest, context: RouteContext) {
  const gateFail = requireAdmin(request)
  if (gateFail) return gateFail

  const { jobId } = await context.params
  const preview = getStoredPreview(jobId)

  if (!preview) {
    return NextResponse.json(
      { success: false, error: 'Import job not found. It may have expired — re-upload the file.' },
      { status: 404 },
    )
  }

  try {
    // ── Resolve the wedding + schema ──
    const weddingId = await getFlagshipWeddingId()
    if (!weddingId) {
      return NextResponse.json(
        { success: false, error: 'Flagship wedding not found.' },
        { status: 404 },
      )
    }

    const schema = getModuleSchema(preview.moduleKey)

    // ── Optional override: only execute a subset of rows? ──
    // Allow POST body { rowIndices: [2, 3, 5] } to limit which rows
    // get executed. Default: all non-invalid, non-skip rows.
    let rowIndices: Set<number> | null = null
    try {
      const body = await request.json()
      if (Array.isArray(body?.rowIndices)) {
        rowIndices = new Set(body.rowIndices as number[])
      }
    } catch {
      /* no body or not JSON — that's fine, execute everything */
    }

    // Filter the preview rows if a subset was specified.
    let previewToExecute = preview
    if (rowIndices) {
      previewToExecute = {
        ...preview,
        rows: preview.rows.filter((r) => rowIndices!.has(r.rowIndex)),
      }
    }

    // ── Execute ──
    const result = await executeImport(previewToExecute, schema, weddingId)

    return NextResponse.json({
      success: true,
      jobId,
      result,
    })
  } catch (err) {
    console.error('[IMPORTS EXECUTE POST] error:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to execute import',
      },
      { status: 500 },
    )
  }
}

// ─── DELETE /api/imports/[jobId] — ROLLBACK ───────────────
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gateFail = requireAdmin(request)
  if (gateFail) return gateFail

  const { jobId } = await context.params
  const url = new URL(request.url)
  const rollbackToken = url.searchParams.get('rollbackToken')

  if (!rollbackToken) {
    return NextResponse.json(
      { success: false, error: 'Missing ?rollbackToken= query parameter.' },
      { status: 400 },
    )
  }

  try {
    const result = await rollbackImport(rollbackToken)
    return NextResponse.json({
      success: true,
      jobId,
      rollback: result,
    })
  } catch (err) {
    console.error('[IMPORTS ROLLBACK DELETE] error:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to roll back import',
      },
      { status: 500 },
    )
  }
}

// Inspect the preview store (used by GET to check job status).
// Re-exported here for type-safety; the actual store lives in ../route.
export const _previewStore = _peekPreviewStore
