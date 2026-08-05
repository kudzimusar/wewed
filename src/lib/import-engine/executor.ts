/**
 * Executes confirmed worksheet previews with per-row atomicity and durable,
 * wedding-scoped rollback snapshots.
 */
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import type {
  ImportErrorEntry,
  ImportExecutionContext,
  ImportPreview,
  ImportResult,
  ModuleSchema,
  RollbackSnapshot,
} from './types'

const ROLLBACK_STORE = new Map<string, RollbackSnapshot>()
const MAX_SNAPSHOTS_PER_WEDDING = 50
const MAX_RUNTIME_ERRORS = 5

function pruneOldSnapshots(weddingId: string): void {
  const entries = Array.from(ROLLBACK_STORE.entries())
    .filter(([, snapshot]) => snapshot.weddingId === weddingId)
    .sort((left, right) => left[1].executedAt.localeCompare(right[1].executedAt))
  while (entries.length >= MAX_SNAPSHOTS_PER_WEDDING) {
    const oldest = entries.shift()
    if (oldest) ROLLBACK_STORE.delete(oldest[0])
  }
}

export function _peekRollbackStore(): typeof ROLLBACK_STORE {
  return ROLLBACK_STORE
}

export function _clearRollbackStore(): void {
  ROLLBACK_STORE.clear()
}

export async function executeImport(
  preview: ImportPreview,
  schema: ModuleSchema,
  weddingId: string,
  context: ImportExecutionContext = {},
): Promise<ImportResult> {
  const jobId = randomUUID()
  const rollbackToken = `rb_${randomUUID().replace(/-/g, '')}`
  const errorReport: ImportErrorEntry[] = []
  const createdIds: string[] = []
  const updatedById = new Map<string, { id: string; snapshot: any }>()

  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  let runtimeErrors = 0

  for (let index = 0; index < preview.rows.length; index += 1) {
    const row = preview.rows[index]
    if (row.action === 'invalid') {
      errors += 1
      errorReport.push({ row: row.rowIndex, errors: row.errors })
      continue
    }
    if (row.action === 'skip') {
      skipped += 1
      continue
    }

    let snapshotAddedForThisRow = false
    try {
      const record = schema.rowToRecord(row.mapped)
      let existingForUpsert: any = undefined
      let snapshotEntry: { id: string; snapshot: any } | undefined

      if (row.action === 'update') {
        if (!row.existingId) throw new Error('Update row is missing its existing record ID.')
        existingForUpsert = await findExistingById(schema, row.existingId, weddingId)
        if (!existingForUpsert) throw new Error('Existing record was not found in the active wedding.')

        snapshotEntry = updatedById.get(existingForUpsert.id)
        if (!snapshotEntry) {
          const snapshot = schema.captureRollbackSnapshot
            ? await schema.captureRollbackSnapshot(weddingId, existingForUpsert, record)
            : schema.recordToRow(existingForUpsert)
          snapshotEntry = { id: existingForUpsert.id, snapshot }
          updatedById.set(existingForUpsert.id, snapshotEntry)
          snapshotAddedForThisRow = true
        }
      }

      const result = await db.$transaction(async (transaction) => {
        const written = await schema.upsert(
          weddingId,
          record,
          existingForUpsert,
          { ...context, db: transaction },
        )
        if (!written?.id) throw new Error('Worksheet write did not return a record ID.')
        return written
      })

      if (snapshotEntry && result.__rollbackPatch && typeof result.__rollbackPatch === 'object') {
        Object.assign(snapshotEntry.snapshot, result.__rollbackPatch)
      }

      if (row.action === 'create') {
        createdIds.push(result.id)
        created += 1
      } else {
        updated += 1
      }
    } catch (error) {
      if (snapshotAddedForThisRow && row.existingId) updatedById.delete(row.existingId)
      errors += 1
      runtimeErrors += 1
      errorReport.push({
        row: row.rowIndex,
        errors: [`DB write failed: ${error instanceof Error ? error.message : String(error)}`],
      })

      if (runtimeErrors >= MAX_RUNTIME_ERRORS) {
        for (const remaining of preview.rows.slice(index + 1)) {
          if (remaining.action === 'skip') {
            skipped += 1
            continue
          }
          errors += 1
          errorReport.push({
            row: remaining.rowIndex,
            errors: [
              ...(remaining.action === 'invalid' ? remaining.errors : []),
              `Not executed because the import stopped after ${MAX_RUNTIME_ERRORS} database errors.`,
            ],
          })
        }
        break
      }
    }
  }

  const snapshot: RollbackSnapshot = {
    jobId,
    moduleKey: schema.key,
    weddingId,
    createdIds,
    updatedSnapshots: [...updatedById.values()],
    executedAt: new Date().toISOString(),
  }
  pruneOldSnapshots(weddingId)
  ROLLBACK_STORE.set(rollbackToken, snapshot)

  return {
    jobId,
    moduleKey: schema.key,
    created,
    updated,
    skipped,
    errors,
    errorReport,
    rollbackToken,
    executedAt: snapshot.executedAt,
  }
}

export interface RollbackResult {
  rollbackToken: string
  deleted: number
  restored: number
  failed: number
  errors: string[]
}

export async function rollbackImport(
  rollbackToken: string,
  context: ImportExecutionContext = {},
): Promise<RollbackResult> {
  const snapshot = ROLLBACK_STORE.get(rollbackToken)
  if (!snapshot) {
    return {
      rollbackToken,
      deleted: 0,
      restored: 0,
      failed: 0,
      errors: ['Rollback token not found (it may have expired).'],
    }
  }

  const { getWorksheetSchema } = await import('./schema-resolver')
  const schema = getWorksheetSchema(snapshot.moduleKey)
  let deleted = 0
  let restored = 0
  let failed = 0
  const rollbackErrors: string[] = []

  // Reverse create order so dependent records created later are removed first.
  for (const id of [...snapshot.createdIds].reverse()) {
    try {
      if (schema.deleteCreated) {
        await db.$transaction((transaction) => schema.deleteCreated!(
          snapshot.weddingId,
          id,
          { ...context, db: transaction },
        ))
      } else {
        await deleteRecordById(snapshot.moduleKey, id, snapshot.weddingId)
      }
      deleted += 1
    } catch (error) {
      failed += 1
      rollbackErrors.push(
        `Failed to delete ${snapshot.moduleKey}#${id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Reverse update order so sequential relational changes unwind correctly.
  for (const { id, snapshot: previous } of [...snapshot.updatedSnapshots].reverse()) {
    try {
      if (schema.restoreUpdated) {
        await db.$transaction((transaction) => schema.restoreUpdated!(
          snapshot.weddingId,
          id,
          previous,
          { ...context, db: transaction },
        ))
      } else {
        await restoreRecordById(snapshot.moduleKey, id, previous, snapshot.weddingId)
      }
      restored += 1
    } catch (error) {
      failed += 1
      rollbackErrors.push(
        `Failed to restore ${snapshot.moduleKey}#${id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  ROLLBACK_STORE.delete(rollbackToken)
  return { rollbackToken, deleted, restored, failed, errors: rollbackErrors }
}

async function findExistingById(
  schema: ModuleSchema,
  id: string,
  weddingId: string,
): Promise<any | undefined> {
  const all = await schema.fetchExisting(weddingId)
  return all.find((record) => record.id === id)
}

async function deleteRecordById(moduleKey: string, id: string, weddingId: string): Promise<void> {
  let count = 0
  switch (moduleKey) {
    case 'guests':
    case 'wedding-party':
    case 'travel':
      count = (await db.guest.deleteMany({ where: { id, weddingId } })).count
      break
    case 'budget':
      count = (await db.budgetItem.deleteMany({ where: { id, weddingId } })).count
      break
    case 'checklist':
      count = (await db.plannerTask.deleteMany({ where: { id, weddingId } })).count
      break
    case 'seating':
      count = (await db.guest.deleteMany({ where: { id, weddingId } })).count
      break
    case 'vendors':
      count = (await db.vendor.deleteMany({ where: { id, weddingId } })).count
      break
    case 'timeline':
      count = (await db.programmeItem.deleteMany({ where: { id, weddingId } })).count
      break
    case 'songs':
      count = (await db.song.deleteMany({ where: { id, weddingId } })).count
      break
    case 'media':
      count = (await db.mediaItem.deleteMany({ where: { id, weddingId } })).count
      break
    default:
      throw new Error(`Unknown module for delete: ${moduleKey}`)
  }
  if (count !== 1) throw new Error('Record was not found in the active wedding.')
}

async function restoreRecordById(
  moduleKey: string,
  id: string,
  previous: Record<string, string>,
  weddingId: string,
): Promise<void> {
  const { getWorksheetSchema } = await import('./schema-resolver')
  const schema = getWorksheetSchema(moduleKey as any)
  const record = schema.rowToRecord(previous)
  const { _importMeta, ...data } = record

  let count = 0
  switch (moduleKey) {
    case 'guests':
    case 'wedding-party':
    case 'travel':
      count = (await db.guest.updateMany({ where: { id, weddingId }, data })).count
      break
    case 'budget':
      count = (await db.budgetItem.updateMany({ where: { id, weddingId }, data })).count
      break
    case 'checklist':
      count = (await db.plannerTask.updateMany({ where: { id, weddingId }, data })).count
      break
    case 'seating':
      count = (await db.guest.updateMany({ where: { id, weddingId }, data: { seatingTableId: null } })).count
      break
    case 'vendors':
      count = (await db.vendor.updateMany({ where: { id, weddingId }, data })).count
      break
    case 'timeline':
      count = (await db.programmeItem.updateMany({ where: { id, weddingId }, data })).count
      break
    case 'songs':
      count = (await db.song.updateMany({ where: { id, weddingId }, data })).count
      break
    case 'media':
      count = (await db.mediaItem.updateMany({ where: { id, weddingId }, data })).count
      break
    default:
      throw new Error(`Unknown module for restore: ${moduleKey}`)
  }
  if (count !== 1) throw new Error('Record was not found in the active wedding.')
}

export function peekRollback(token: string): RollbackSnapshot | undefined {
  return ROLLBACK_STORE.get(token)
}
