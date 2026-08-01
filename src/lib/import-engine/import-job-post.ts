import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { getWorksheetSchema } from './schema-resolver'
import { generatePreview } from './preview'
import { executeImport, peekRollback } from './executor'
import { executeGuestWorksheetImport } from './guest-worksheet-executor'
import type { ImportPreview, ImportResult, ParsedFile } from './types'
import { findImportJob, type ImportJobRouteContext } from './import-job-shared'

export async function handleImportJobPost(request: NextRequest, context: ImportJobRouteContext) {
  const access = await requireWeddingPermission(request, 'import.execute')
  if (access.error) return access.error
  const { jobId } = await context.params

  try {
    const job = await findImportJob(jobId, access.context.weddingId)
    if (!job || !job.previewData) {
      return NextResponse.json({ success: false, error: 'Import preview not found.' }, { status: 404 })
    }
    if (job.status === 'executed') {
      return NextResponse.json({ success: false, error: 'This import has already been executed.' }, { status: 409 })
    }
    if (job.status === 'rolled_back') {
      return NextResponse.json({ success: false, error: 'This import was rolled back. Upload the file again to re-import.' }, { status: 409 })
    }

    const storedPreview = JSON.parse(job.previewData) as ImportPreview
    const schema = getWorksheetSchema(storedPreview.moduleKey)
    let body: { rowIndices?: unknown; mappingOverrides?: unknown } = {}
    try { body = (await request.json()) as typeof body } catch { /* empty body */ }

    let preview = storedPreview
    if (body.mappingOverrides && typeof body.mappingOverrides === 'object') {
      const rawRows = storedPreview.rows.map((row) => row.raw)
      const headers = Array.from(new Set(rawRows.flatMap((row) => Object.keys(row))))
      const parsed: ParsedFile = { headers, rows: rawRows, rowNumbers: rawRows.map((_, index) => index + 2), formulaCells: [], rawRowCount: rawRows.length }
      preview = await generatePreview(
        parsed,
        schema,
        access.context.weddingId,
        storedPreview.fileName,
        body.mappingOverrides as Record<string, string>,
      )
      await db.importJob.update({
        where: { id: jobId },
        data: {
          previewData: JSON.stringify(preview),
          fieldMapping: JSON.stringify(preview.fieldMapping),
          totalRows: preview.totalRows,
          errorCount: preview.invalidRows,
        },
      })
    }

    if (Array.isArray(body.rowIndices)) {
      const selected = new Set(body.rowIndices.filter((value): value is number => typeof value === 'number'))
      preview = { ...preview, rows: preview.rows.filter((row) => selected.has(row.rowIndex)) }
    }

    let result: ImportResult
    let rollbackData: string | null
    if (preview.moduleKey === 'guests') {
      const execution = await executeGuestWorksheetImport(preview, access.context.weddingId)
      result = execution.result
      rollbackData = JSON.stringify(execution.snapshot)
    } else {
      result = await executeImport(preview, schema, access.context.weddingId)
      const snapshot = peekRollback(result.rollbackToken)
      rollbackData = snapshot ? JSON.stringify(snapshot) : null
    }

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
        rollbackData,
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
          mappingAdjusted: Boolean(body.mappingOverrides),
        }),
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })
    return NextResponse.json({ success: true, jobId, result })
  } catch (error) {
    console.error('[imports job POST] Error:', error)
    await db.importJob.update({ where: { id: jobId }, data: { status: 'failed' } }).catch(() => undefined)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to execute import.',
    }, { status: 500 })
  }
}
