import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { rollbackImport, peekRollback, _peekRollbackStore } from './executor'
import { rollbackGuestWorksheetImport } from './guest-worksheet-rollback'
import type { GuestWorksheetRollbackSnapshot } from './guest-worksheet-snapshot'
import type { RollbackSnapshot } from './types'
import { findImportJob, type ImportJobRouteContext } from './import-job-shared'

export async function handleImportJobDelete(request: NextRequest, context: ImportJobRouteContext) {
  const access = await requireWeddingPermission(request, 'import.execute')
  if (access.error) return access.error
  const { jobId } = await context.params

  try {
    const job = await findImportJob(jobId, access.context.weddingId)
    if (!job) return NextResponse.json({ success: false, error: 'Import job not found.' }, { status: 404 })
    if (job.status !== 'executed' || !job.rollbackToken || !job.rollbackData) {
      return NextResponse.json({ success: false, error: 'This import does not have an available rollback.' }, { status: 409 })
    }
    const suppliedToken = new URL(request.url).searchParams.get('rollbackToken')
    if (!suppliedToken || suppliedToken !== job.rollbackToken) {
      return NextResponse.json({ success: false, error: 'Invalid rollback token.' }, { status: 403 })
    }

    let rollback: { deleted: number; restored: number; failed: number; errors: string[] }
    if (job.moduleKey === 'guests') {
      rollback = await rollbackGuestWorksheetImport(
        JSON.parse(job.rollbackData) as GuestWorksheetRollbackSnapshot,
        access.context.weddingId,
      )
    } else {
      if (!peekRollback(job.rollbackToken)) {
        const snapshot = JSON.parse(job.rollbackData) as RollbackSnapshot
        if (snapshot.weddingId !== access.context.weddingId) {
          return NextResponse.json({ success: false, error: 'Rollback wedding mismatch.' }, { status: 403 })
        }
        _peekRollbackStore().set(job.rollbackToken, snapshot)
      }
      rollback = await rollbackImport(job.rollbackToken)
    }

    await db.importJob.update({
      where: { id: jobId },
      data: { status: rollback.failed ? 'rollback_failed' : 'rolled_back', rollbackData: null },
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
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to roll back import.',
    }, { status: 500 })
  }
}
