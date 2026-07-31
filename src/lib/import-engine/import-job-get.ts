import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import type { ImportPreview } from './types'
import { findImportJob, type ImportJobRouteContext } from './import-job-shared'

export async function handleImportJobGet(request: NextRequest, context: ImportJobRouteContext) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error
  const { jobId } = await context.params
  try {
    const job = await findImportJob(jobId, access.context.weddingId)
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
