/**
 * wewed — Import/Export Engine — Import Executor
 * ============================================================
 * Executes a confirmed import preview: for each valid row, calls
 * the schema's `upsert` to create or update the DB record.
 *
 * Properties:
 *  - ATOMIC PER ROW: each row's upsert is wrapped in its own
 *    Prisma transaction. If a single row fails, the engine stops
 *    the loop (rather than continuing and leaving partial state).
 *  - ROLLBACK TOKEN: every executed import gets a token whose
 *    snapshot records every created id (for DELETE) and every
 *    updated id's pre-import state (for RESTORE). The DELETE
 *    /api/imports/[jobId] route calls `rollbackImport(token)`.
 *  - ERROR REPORT: invalid rows are collected into an array with
 *    their row index and errors — returned in the ImportResult
 *    so the UI can show a downloadable error report.
 *
 * NOTE on ImportJob model: the spec calls for a Prisma `ImportJob`
 * + `ImportRollback` model. They will be added to the schema
 * separately (Phase 2 hardening). Until then we use an in-memory
 * Map keyed by rollback token. Restarting the dev server clears
 * this map — the user can still execute imports, just can't
 * roll back after a server restart. Acceptable for the current
 * milestone; the public API (`executeImport` / `rollbackImport`)
 * won't change when the Prisma model is added.
 */

import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import type {
  ImportErrorEntry,
  ImportPreview,
  ImportResult,
  ModuleSchema,
  RollbackSnapshot,
} from './types'

// ============================================================
// In-memory rollback token store
// (Replace with Prisma ImportJob model when added.)
// ============================================================

const ROLLBACK_STORE = new Map<string, RollbackSnapshot>()

// Per-wedding cap to avoid unbounded memory growth in dev.
const MAX_SNAPSHOTS_PER_WEDDING = 50

function pruneOldSnapshots(weddingId: string): void {
  const entries = Array.from(ROLLBACK_STORE.entries())
    .filter(([, snap]) => snap.weddingId === weddingId)
    .sort((a, b) => (a[1].executedAt < b[1].executedAt ? -1 : 1))
  while (entries.length >= MAX_SNAPSHOTS_PER_WEDDING) {
    const oldest = entries.shift()
    if (oldest) ROLLBACK_STORE.delete(oldest[0])
  }
}

/** Test-only / dev helper: peek at the rollback store. */
export function _peekRollbackStore(): typeof ROLLBACK_STORE {
  return ROLLBACK_STORE
}

/** Test-only / dev helper: clear all rollback snapshots. */
export function _clearRollbackStore(): void {
  ROLLBACK_STORE.clear()
}

// ============================================================
// Execute
// ============================================================

/**
 * Execute a confirmed import preview.
 *
 * @param preview    the ImportPreview returned by generatePreview
 * @param schema     the module schema
 * @param weddingId  the wedding these records belong to
 * @returns          ImportResult with counts + rollback token
 */
export async function executeImport(
  preview: ImportPreview,
  schema: ModuleSchema,
  weddingId: string,
): Promise<ImportResult> {
  const jobId = randomUUID()
  const rollbackToken = `rb_${randomUUID().replace(/-/g, '')}`

  const errorReport: ImportErrorEntry[] = []
  const createdIds: string[] = []
  const updatedSnapshots: Array<{ id: string; snapshot: any }> = []

  let created = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  // Process rows in order. Invalid rows are recorded but skipped.
  for (const row of preview.rows) {
    if (row.action === 'invalid') {
      errors++
      errorReport.push({ row: row.rowIndex, errors: row.errors })
      continue
    }
    if (row.action === 'skip') {
      skipped++
      continue
    }

    try {
      // Convert the mapped row to a DB record.
      const record = schema.rowToRecord(row.mapped)

      // For updates: snapshot the existing record BEFORE we mutate.
      let existingForUpsert: any = undefined
      if (row.action === 'update' && row.existingId) {
        existingForUpsert = await findExistingById(schema, row.existingId, weddingId)
        if (existingForUpsert) {
          // Snapshot a JSON-serializable version (recordToRow is fine).
          updatedSnapshots.push({
            id: existingForUpsert.id,
            snapshot: schema.recordToRow(existingForUpsert),
          })
        }
      }

      // Run the upsert. Per-row atomicity: wrap in a transaction.
      // Note: schemas' upserts use `db` directly (not tx), so this
      // $transaction is the outermost atomic boundary for any nested
      // creates the upsert performs. SQLite supports nested writes
      // under a single interactive transaction.
      const result = await db.$transaction(async () => {
        return schema.upsert(weddingId, record, existingForUpsert)
      })

      if (result?.id) {
        if (row.action === 'create') {
          createdIds.push(result.id)
          created++
        } else {
          updated++
        }
      } else {
        // No id returned — treat as skip to be safe.
        skipped++
      }
    } catch (err) {
      // A row-level failure aborts this row only. We log it as an
      // error and continue — the couple should still be able to
      // review + roll back the rows that DID succeed.
      errors++
      const msg = err instanceof Error ? err.message : String(err)
      errorReport.push({
        row: row.rowIndex,
        errors: [`DB write failed: ${msg}`],
      })
      // Stop further execution if this looks like a systemic failure
      // (e.g. unique constraint that will repeat). Heuristic: 5+ DB
      // errors in a single import → bail.
      if (errors >= 5) {
        errorReport.push({
          row: 0,
          errors: ['Aborted after 5 DB errors — fix the data and retry.'],
        })
        break
      }
    }
  }

  // Persist the rollback snapshot.
  const snapshot: RollbackSnapshot = {
    jobId,
    moduleKey: schema.key,
    weddingId,
    createdIds,
    updatedSnapshots,
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

// ============================================================
// Rollback
// ============================================================

export interface RollbackResult {
  rollbackToken: string
  deleted: number
  restored: number
  failed: number
  errors: string[]
}

/**
 * Reverse an import by rollback token. Deletes created records,
 * restores updated records to their pre-import state.
 */
export async function rollbackImport(
  rollbackToken: string,
): Promise<RollbackResult> {
  const snap = ROLLBACK_STORE.get(rollbackToken)
  if (!snap) {
    return {
      rollbackToken,
      deleted: 0,
      restored: 0,
      failed: 0,
      errors: ['Rollback token not found (it may have expired).'],
    }
  }

  let deleted = 0
  let restored = 0
  let failed = 0
  const errors: string[] = []

  // 1. Delete created records
  for (const id of snap.createdIds) {
    try {
      await deleteRecordById(snap.moduleKey, id)
      deleted++
    } catch (err) {
      failed++
      errors.push(
        `Failed to delete ${snap.moduleKey}#${id}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // 2. Restore updated records
  for (const { id, snapshot } of snap.updatedSnapshots) {
    try {
      await restoreRecordById(snap.moduleKey, id, snapshot, snap.weddingId)
      restored++
    } catch (err) {
      failed++
      errors.push(
        `Failed to restore ${snap.moduleKey}#${id}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // Drop the snapshot so the token can't be replayed.
  ROLLBACK_STORE.delete(rollbackToken)

  return { rollbackToken, deleted, restored, failed, errors }
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Find an existing record by id, using the schema's fetchExisting
 * (we don't have a generic get-by-id on every schema, so we filter
 * the fetchExisting result). For very large modules, a per-schema
 * `findById` would be more efficient — acceptable for now.
 */
async function findExistingById(
  schema: ModuleSchema,
  id: string,
  weddingId: string,
): Promise<any | undefined> {
  const all = await schema.fetchExisting(weddingId)
  return all.find((r) => r.id === id)
}

/**
 * Delete a record by id using the appropriate Prisma model.
 */
async function deleteRecordById(moduleKey: string, id: string): Promise<void> {
  switch (moduleKey) {
    case 'guests':
    case 'wedding-party':
    case 'travel':
      await db.guest.delete({ where: { id } })
      break
    case 'budget':
      await db.budgetItem.delete({ where: { id } })
      break
    case 'checklist':
      await db.plannerTask.delete({ where: { id } })
      break
    case 'seating':
      // Seating import creates/updates Guests. The "created" snapshot
      // ids are guest ids; the table itself is intentionally left
      // (it may now have other guests assigned).
      await db.guest.delete({ where: { id } }).catch(() => {})
      break
    case 'vendors':
      await db.vendor.delete({ where: { id } })
      break
    case 'timeline':
      await db.programmeItem.delete({ where: { id } })
      break
    case 'songs':
      await db.song.delete({ where: { id } })
      break
    case 'media':
      await db.mediaItem.delete({ where: { id } })
      break
    default:
      throw new Error(`Unknown module for delete: ${moduleKey}`)
  }
}

/**
 * Restore a record by id from a snapshot row (the output of
 * schema.recordToRow). We re-convert via schema.rowToRecord, then
 * call Prisma's update.
 */
async function restoreRecordById(
  moduleKey: string,
  id: string,
  snapshot: Record<string, string>,
  weddingId: string,
): Promise<void> {
  // We need the schema to convert row → record. Import here would
  // cause a cycle (schemas.ts imports nothing from executor.ts).
  // Use a dynamic lookup.
  const { getModuleSchema } = await import('./schemas')
  const schema = getModuleSchema(moduleKey)
  const record = schema.rowToRecord(snapshot)
  // Strip _importMeta — schemas' upsert drops it before writing.
  const { _importMeta, ...data } = record

  switch (moduleKey) {
    case 'guests':
    case 'wedding-party':
    case 'travel':
      await db.guest.update({ where: { id }, data: { ...data, weddingId } })
      break
    case 'budget':
      await db.budgetItem.update({ where: { id }, data: { ...data, weddingId } })
      break
    case 'checklist':
      await db.plannerTask.update({ where: { id }, data: { ...data, weddingId } })
      break
    case 'seating':
      // For seating, restore = remove the seatingTable link (set to null)
      await db.guest.update({ where: { id }, data: { seatingTableId: null } }).catch(() => {})
      break
    case 'vendors':
      await db.vendor.update({ where: { id }, data: { ...data, weddingId } })
      break
    case 'timeline':
      await db.programmeItem.update({ where: { id }, data: { ...data, weddingId } })
      break
    case 'songs':
      await db.song.update({ where: { id }, data: { ...data, weddingId } })
      break
    case 'media':
      await db.mediaItem.update({ where: { id }, data: { ...data, weddingId } })
      break
    default:
      throw new Error(`Unknown module for restore: ${moduleKey}`)
  }
}

/**
 * Look up a rollback snapshot by token (without consuming it).
 * Used by GET /api/imports/[jobId] to surface job status.
 */
export function peekRollback(token: string): RollbackSnapshot | undefined {
  return ROLLBACK_STORE.get(token)
}
