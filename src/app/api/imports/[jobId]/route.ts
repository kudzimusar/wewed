import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { getModuleSchema } from '@/lib/import-engine/schemas'
import {
  executeImport,
  rollbackImport,
  peekRollback,
  _peekRollbackStore,
} from '@/lib/import-engine/executor'
import type { ImportPreview, RollbackSnapshot } from '@/lib/import-engine/types'

type RouteContext = { params: Promise<{ jobId: string }> }

async function findJob(jobId: string, weddingId: string) {
  return db.importJob.findFirst({ where: { id: jobId, weddingId } })
}

export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error
  const { jobId } = await context.params

  try {
    const job = await findJob(jobId, access.context.weddingId)
    if (!job) return NextResponse.json({ success: false, error: 'Import job not found.' }, { status: 404 })
    const preview = job.previewData ? (JSON.parse(job.previewData) as ImportPreview) : null
    return NextResponse.json({
      success: true,
      jobId,
      status: job.status,
      preview,
      result: {
        created: job.createdCount,
        updated: job.updatedCount,
        skipped: job.skippedCount,
        errors: job.errorCount,
        rollbackToken: job.rollbackToken,
      },
    })
  } catch (error) {
    console.error('[imports job GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load import job.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'import.execute')
  if (access.error) return access.error
  const { jobId } = await context.params

  try {
    const job = await findJob(jobId, access.context.weddingId)
    if (!job || !job.previewData) {
      return NextResponse.json({ success: false, error: 'Import preview not found.' }, { status: 404 })
    }
    if (job.status === 'executed') {
      return NextResponse.json(
        { success: false, error: 'This import has already been executed.' },
        { status: 409 },
      )
    }
    if (job.status === 'rolled_back') {
      return NextResponse.json(
        { success: false, error: 'This import was rolled back. Upload the file again to re-import.' },
        { status: 409 },
      )
    }

    const preview = JSON.parse(job.previewData) as ImportPreview
    let previewToExecute = preview
    try {
      const body = (await request.json()) as { rowIndices?: unknown }
      if (Array.isArray(body.rowIndices)) {
        const selected = new Set(body.rowIndices.filter((value): value is number => typeof value === 'number'))
        previewToExecute = { ...preview, rows: preview.rows.filter((row) => selected.has(row.rowIndex)) }
      }
    } catch {
      // Empty body means execute all valid rows.
    }

    const schema = getModuleSchema(preview.moduleKey)
    const result = await executeImport(previewToExecute, schema, access.context.weddingId)
    const snapshot = peekRollback(result.rollbackToken)

    await db.importJob.update({
      where: { id: jobId },
      data: {
        status: 'executed',
        createdCount: result.created,
        updatedCount: result.updated,
        skippedCount: result.skipped,
        errorCount: result.errors,
        errorReport: JSON.stringify(result.errorReport),
        rollbackToken: result.rollbackToken,
        rollbackData: snapshot ? JSON.stringify(snapshot) : null,
      },
    })
    await db.auditEvent.create({
      data: {
        action: 'import.execute',
        resourceType: 'import_job',
        resourceId: jobId,
        afterValue: JSON.stringify({
          moduleKey: preview.moduleKey,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors,
        }),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({ success: true, jobId, result })
  } catch (error) {
    console.error('[imports job POST] Error:', error)
    await db.importJob
      .update({ where: { id: jobId }, data: { status: 'failed' } })
      .catch(() => undefined)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to execute import.' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'import.execute')
  if (access.error) return access.error
  const { jobId } = await context.params

  try {
    const job = await findJob(jobId, access.context.weddingId)
    if (!job) return NextResponse.json({ success: false, error: 'Import job not found.' }, { status: 404 })
    if (job.status !== 'executed' || !job.rollbackToken || !job.rollbackData) {
      return NextResponse.json(
        { success: false, error: 'This import does not have an available rollback.' },
        { status: 409 },
      )
    }

    const suppliedToken = new URL(request.url).searchParams.get('rollbackToken')
    if (!suppliedToken || suppliedToken !== job.rollbackToken) {
      return NextResponse.json({ success: false, error: 'Invalid rollback token.' }, { status: 403 })
    }

    if (!peekRollback(job.rollbackToken)) {
      const snapshot = JSON.parse(job.rollbackData) as RollbackSnapshot
      if (snapshot.weddingId !== access.context.weddingId) {
        return NextResponse.json({ success: false, error: 'Rollback wedding mismatch.' }, { status: 403 })
      }
      _peekRollbackStore().set(job.rollbackToken, snapshot)
    }

    const rollback = await rollbackImport(job.rollbackToken)
    await db.importJob.update({
      where: { id: jobId },
      data: {
        status: rollback.failed ? 'rollback_failed' : 'rolled_back',
        rollbackData: null,
      },
    })
    await db.auditEvent.create({
      data: {
        action: 'import.rollback',
        resourceType: 'import_job',
        resourceId: jobId,
        afterValue: JSON.stringify(rollback),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    return NextResponse.json({ success: true, jobId, rollback })
  } catch (error) {
    console.error('[imports job DELETE] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to roll back import.' },
      { status: 500 },
    )
  }
}
