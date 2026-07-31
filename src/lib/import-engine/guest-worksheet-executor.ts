import { randomUUID } from 'node:crypto'
import { applyGuestWorksheetRow, snapshotGuestWorksheetState } from './guest-worksheet-apply'
import type { GuestWorksheetExecution } from './guest-worksheet-snapshot'
import type { ImportErrorEntry, ImportPreview } from './types'

export async function executeGuestWorksheetImport(
  preview: ImportPreview,
  weddingId: string,
): Promise<GuestWorksheetExecution> {
  const jobId = randomUUID()
  const rollbackToken = `rb_guest_${randomUUID().replace(/-/g, '')}`
  const createdIds: string[] = []
  const updatedSnapshots = []
  const errorReport: ImportErrorEntry[] = []
  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const row of preview.rows) {
    if (row.action === 'invalid') {
      errors += 1
      errorReport.push({ row: row.rowIndex, errors: row.errors })
      continue
    }
    if (row.action === 'skip') {
      skipped += 1
      continue
    }

    try {
      if (row.action === 'update' && row.existingId) {
        updatedSnapshots.push(await snapshotGuestWorksheetState(weddingId, row.existingId))
      }
      const applied = await applyGuestWorksheetRow(weddingId, row.mapped, row.existingId)
      if (applied.created) {
        createdIds.push(applied.id)
        created += 1
      } else {
        updated += 1
      }
    } catch (error) {
      errors += 1
      errorReport.push({
        row: row.rowIndex,
        errors: [error instanceof Error ? error.message : String(error)],
      })
      if (errors >= 5) {
        errorReport.push({ row: 0, errors: ['Aborted after 5 row errors. Fix the data and retry.'] })
        break
      }
    }
  }

  const executedAt = new Date().toISOString()
  return {
    result: {
      jobId,
      moduleKey: 'guests',
      created,
      updated,
      skipped,
      errors,
      errorReport,
      rollbackToken,
      executedAt,
    },
    snapshot: {
      kind: 'guest-worksheet-v2',
      jobId,
      moduleKey: 'guests',
      weddingId,
      createdIds,
      updatedSnapshots,
      executedAt,
    },
  }
}
