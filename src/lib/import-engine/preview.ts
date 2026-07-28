/**
 * wewed — Import/Export Engine — Preview Generator
 * ============================================================
 * Given a parsed file (rows + headers) + a module schema, builds
 * an ImportPreview: per-row action (create/update/skip/invalid),
 * counts, field mapping, unmapped columns, missing required fields.
 *
 * This is the step between "user uploaded a file" and "user
 * confirms the import". The preview is sent to the frontend so
 * the couple can review every row before any DB writes happen.
 *
 * Action logic per row:
 *   1. Validate → if errors, action='invalid'
 *   2. If row has the uniqueKey set:
 *      a. Find existing record with matching uniqueKey value
 *         → action='update' (or 'skip' if no differences)
 *         → if values differ on required fields, mark 'conflict' (still update)
 *      b. No match → action='create'
 *   3. If row has no uniqueKey:
 *      → action='create' (or 'invalid' if required-field check fails)
 *   4. Duplicate rows (same uniqueKey appears twice in the file itself):
 *      → second+ occurrence marked 'skip' with warning
 */

import type {
  ImportPreview,
  ImportRow,
  ModuleSchema,
  ParsedFile,
} from './types'
import { applyMapping, autoMap, findMissingRequired, findUnmappedColumns } from './mapper'
import { validateRow } from './validator'
import { fileFingerprint } from './parser'

/** Normalize a string for duplicate comparison (trim, lowercase). */
function norm(v: string | undefined | null): string {
  return (v ?? '').toString().trim().toLowerCase()
}

/**
 * Compare a mapped row (string values) against an existing record.
 * Returns true if they have meaningful differences (i.e. would update).
 */
function rowDiffersFromRecord(
  mapped: Record<string, string>,
  schema: ModuleSchema,
  existing: any,
): boolean {
  const existingRow = schema.recordToRow(existing)
  // Compare on every field the user provided a value for.
  for (const field of schema.fields) {
    const newVal = (mapped[field.key] ?? '').toString().trim()
    if (!newVal) continue // user didn't specify this field — don't touch it
    const oldVal = (existingRow[field.key] ?? '').toString().trim()
    if (norm(newVal) !== norm(oldVal)) return true
  }
  return false
}

/**
 * Build the import preview.
 *
 * @param parsed     output of parseFile()
 * @param schema     module schema (guests, budget, etc.)
 * @param weddingId  the wedding these records belong to
 * @param fileName   the original file name (for display in the UI)
 */
export async function generatePreview(
  parsed: ParsedFile,
  schema: ModuleSchema,
  weddingId: string,
  fileName: string,
): Promise<ImportPreview> {
  const { headers, rows } = parsed

  // 1. Auto-map columns → fields
  const fieldMapping = autoMap(headers, schema)
  const mappedRows = applyMapping(rows, fieldMapping)
  const unmappedColumns = findUnmappedColumns(headers, fieldMapping)
  const missingRequired = findMissingRequired(schema, fieldMapping)

  // 2. Fetch existing records (one DB call per preview — acceptable)
  let existing: any[] = []
  try {
    existing = await schema.fetchExisting(weddingId)
  } catch (err) {
    // Don't fail the whole preview if fetch fails — just surface as a warning.
    console.warn(`[import-engine] fetchExisting failed for ${schema.key}:`, err)
  }

  // Build a lookup by uniqueKey value → existing record
  const existingByKey = new Map<string, any>()
  if (schema.uniqueKey) {
    for (const rec of existing) {
      const row = schema.recordToRow(rec)
      const k = norm(row[schema.uniqueKey])
      if (k) existingByKey.set(k, rec)
    }
  }

  // Track uniqueKey values already seen in this file (intra-file duplicate detection)
  const seenInFile = new Set<string>()

  const importRows: ImportRow[] = []
  let newRecords = 0
  let updateRecords = 0
  let duplicateRecords = 0
  let conflictingRecords = 0
  let skippedRecords = 0
  let invalidRows = 0
  let validRows = 0

  mappedRows.forEach((mapped, idx) => {
    const raw = rows[idx]
    const rowIndex = idx + 2 // 1-based, accounting for header row (row 1)
    const { errors, warnings } = validateRow(mapped, schema)

    let action: ImportRow['action'] = 'create'
    let existingId: string | undefined
    const rowWarnings = [...warnings]

    if (errors.length > 0) {
      action = 'invalid'
      invalidRows++
    } else {
      validRows++
      // Check intra-file duplicate
      if (schema.uniqueKey) {
        const kv = norm(mapped[schema.uniqueKey])
        if (kv) {
          if (seenInFile.has(kv)) {
            action = 'skip'
            rowWarnings.push('Duplicate row within this file — will be skipped')
            duplicateRecords++
            skippedRecords++
          } else {
            seenInFile.add(kv)
            // Check existing DB record
            const match = existingByKey.get(kv)
            if (match) {
              existingId = match.id
              const differs = rowDiffersFromRecord(mapped, schema, match)
              if (differs) {
                action = 'update'
                updateRecords++
                // Heuristic: if a required field would change, mark as conflict
                const requiredFields = schema.fields.filter((f) => f.required)
                let conflict = false
                const existingRow = schema.recordToRow(match)
                for (const f of requiredFields) {
                  const nv = (mapped[f.key] ?? '').toString().trim()
                  const ov = (existingRow[f.key] ?? '').toString().trim()
                  if (nv && ov && norm(nv) !== norm(ov)) {
                    conflict = true
                    break
                  }
                }
                if (conflict) {
                  conflictingRecords++
                  rowWarnings.push(
                    'This update changes a required field — review carefully',
                  )
                }
              } else {
                action = 'skip'
                rowWarnings.push('No changes from existing record — will be skipped')
                skippedRecords++
              }
            } else {
              action = 'create'
              newRecords++
            }
          }
        } else {
          // No uniqueKey value — can't dedupe, treat as create.
          action = 'create'
          newRecords++
        }
      } else {
        // No uniqueKey defined — every valid row is a create.
        action = 'create'
        newRecords++
      }
    }

    importRows.push({
      rowIndex,
      raw,
      mapped,
      action,
      errors,
      warnings: rowWarnings,
      existingId,
    })
  })

  return {
    fileName,
    moduleKey: schema.key,
    templateVersion: schema.version,
    totalRows: mappedRows.length,
    validRows,
    invalidRows,
    newRecords,
    updateRecords,
    duplicateRecords,
    conflictingRecords,
    skippedRecords,
    rows: importRows,
    fieldMapping,
    unmappedColumns,
    missingRequired,
    generatedAt: new Date().toISOString(),
    fileFingerprint: fileFingerprint(parsed),
  }
}
