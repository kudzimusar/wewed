/**
 * wewed — Import/Export Engine — Preview Generator
 * ============================================================
 * Builds a duplicate-aware, validated preview before any spreadsheet rows are written.
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

function norm(value: string | undefined | null): string {
  return (value ?? '').toString().trim().toLowerCase()
}

function rowDiffersFromRecord(
  mapped: Record<string, string>,
  schema: ModuleSchema,
  existing: any,
): boolean {
  const existingRow = schema.recordToRow(existing)
  for (const field of schema.fields) {
    const newValue = (mapped[field.key] ?? '').toString().trim()
    if (!newValue) continue
    const oldValue = (existingRow[field.key] ?? '').toString().trim()
    if (norm(newValue) !== norm(oldValue)) return true
  }
  return false
}

export async function generatePreview(
  parsed: ParsedFile,
  schema: ModuleSchema,
  weddingId: string,
  fileName: string,
  mappingOverrides: Record<string, string> = {},
): Promise<ImportPreview> {
  const { headers, rows } = parsed
  const automaticMapping = autoMap(headers, schema)
  const validTargets = new Set(schema.fields.map((field) => field.key))
  const overrides = Object.fromEntries(
    Object.entries(mappingOverrides).filter(
      ([source, target]) => headers.includes(source) && (!target || validTargets.has(target)),
    ),
  )
  const fieldMapping = { ...automaticMapping, ...overrides }
  const mappedRows = applyMapping(rows, fieldMapping)
  const unmappedColumns = findUnmappedColumns(headers, fieldMapping)
  const missingRequired = findMissingRequired(schema, fieldMapping)

  let existing: any[] = []
  try {
    existing = await schema.fetchExisting(weddingId)
  } catch (error) {
    console.warn(`[import-engine] fetchExisting failed for ${schema.key}:`, error)
  }

  const existingByKey = new Map<string, any>()
  if (schema.uniqueKey) {
    for (const record of existing) {
      const row = schema.recordToRow(record)
      const key = norm(row[schema.uniqueKey])
      if (key) existingByKey.set(key, record)
    }
  }

  const seenInFile = new Set<string>()
  const importRows: ImportRow[] = []
  let newRecords = 0
  let updateRecords = 0
  let duplicateRecords = 0
  let conflictingRecords = 0
  let skippedRecords = 0
  let invalidRows = 0
  let validRows = 0

  mappedRows.forEach((mapped, index) => {
    const raw = rows[index]
    const rowIndex = index + 2
    const { errors, warnings } = validateRow(mapped, schema)
    let action: ImportRow['action'] = 'create'
    let existingId: string | undefined
    const rowWarnings = [...warnings]

    if (errors.length > 0) {
      action = 'invalid'
      invalidRows += 1
    } else {
      validRows += 1
      if (schema.uniqueKey) {
        const key = norm(mapped[schema.uniqueKey])
        if (key) {
          if (seenInFile.has(key)) {
            action = 'skip'
            rowWarnings.push('Duplicate row within this file — will be skipped')
            duplicateRecords += 1
            skippedRecords += 1
          } else {
            seenInFile.add(key)
            const match = existingByKey.get(key)
            if (match) {
              existingId = match.id
              if (rowDiffersFromRecord(mapped, schema, match)) {
                action = 'update'
                updateRecords += 1
                const existingRow = schema.recordToRow(match)
                const conflict = schema.fields
                  .filter((field) => field.required)
                  .some((field) => {
                    const next = (mapped[field.key] ?? '').toString().trim()
                    const previous = (existingRow[field.key] ?? '').toString().trim()
                    return next && previous && norm(next) !== norm(previous)
                  })
                if (conflict) {
                  conflictingRecords += 1
                  rowWarnings.push('This update changes a required field — review carefully')
                }
              } else {
                action = 'skip'
                rowWarnings.push('No changes from existing record — will be skipped')
                skippedRecords += 1
              }
            } else {
              newRecords += 1
            }
          }
        } else {
          newRecords += 1
        }
      } else {
        newRecords += 1
      }
    }

    importRows.push({ rowIndex, raw, mapped, action, errors, warnings: rowWarnings, existingId })
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
