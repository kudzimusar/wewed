/**
 * Builds a duplicate-aware, reference-aware and formula-safe preview before any
 * spreadsheet row can be written.
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
  if (schema.rowDiffers) return schema.rowDiffers(mapped, existing)
  const existingRow = schema.recordToRow(existing)
  for (const field of schema.fields) {
    const newValue = (mapped[field.key] ?? '').toString().trim()
    // Blank update cells preserve existing data. Clearing requires an explicit,
    // governed module contract rather than an ambiguous empty spreadsheet cell.
    if (!newValue) continue
    const oldValue = (existingRow[field.key] ?? '').toString().trim()
    if (norm(newValue) !== norm(oldValue)) return true
  }
  return false
}

function defaultIdentity(
  mapped: Record<string, string>,
  schema: ModuleSchema,
): string | null {
  if (!schema.uniqueKey) return null
  const value = norm(mapped[schema.uniqueKey])
  return value ? `${schema.uniqueKey}:${value}` : null
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

  // Failing closed avoids converting a read outage into duplicate creates.
  const existing = await schema.fetchExisting(weddingId)
  const rowNumbers = parsed.rowNumbers ?? mappedRows.map((_row, index) => index + 2)
  const formulaRowNumbers = new Set((parsed.formulaCells ?? []).map((cell) => cell.rowIndex))
  const batchCandidates = mappedRows
    .map((mapped, index) => ({ rowIndex: rowNumbers[index], mapped }))
    .filter(({ rowIndex, mapped }) => !formulaRowNumbers.has(rowIndex) && validateRow(mapped, schema).errors.length === 0)
  const batchErrors = schema.validateBatch
    ? await schema.validateBatch(batchCandidates, existing, weddingId)
    : new Map<number, string[]>()

  const existingByKey = new Map<string, any>()
  if (schema.uniqueKey && !schema.matchExisting) {
    for (const record of existing) {
      const row = schema.recordToRow(record)
      const key = norm(row[schema.uniqueKey])
      if (key) existingByKey.set(key, record)
    }
  }

  const seenInFile = new Set<string>()
  const targetedExistingIds = new Set<string>()
  const importRows: ImportRow[] = []
  let newRecords = 0
  let updateRecords = 0
  let duplicateRecords = 0
  let conflictingRecords = 0
  let skippedRecords = 0
  let invalidRows = 0
  let validRows = 0

  const dataRowNumbers = new Set(rowNumbers)

  for (let index = 0; index < mappedRows.length; index += 1) {
    const mapped = mappedRows[index]
    const raw = rows[index]
    const rowIndex = rowNumbers[index]
    const validation = validateRow(mapped, schema)
    const formulaErrors = (parsed.formulaCells ?? [])
      .filter((cell) => cell.rowIndex === rowIndex)
      .map((cell) => `Formula detected in "${cell.column}" (${cell.address}). Replace it with a plain value.`)
    const referenceErrors = validation.errors.length === 0 && formulaErrors.length === 0 && schema.validateReferences
      ? await schema.validateReferences(mapped, weddingId)
      : []
    const rowErrors = [
      ...validation.errors,
      ...formulaErrors,
      ...referenceErrors,
      ...(batchErrors.get(rowIndex) ?? []),
    ]
    const rowWarnings = [...validation.warnings]
    let action: ImportRow['action'] = 'create'
    let existingId: string | undefined

    const identity = schema.rowIdentity?.(mapped) ?? defaultIdentity(mapped, schema)
    if (rowErrors.length === 0 && identity) {
      if (seenInFile.has(identity)) {
        action = 'skip'
        rowWarnings.push('Duplicate row within this file — will be skipped')
        duplicateRecords += 1
        skippedRecords += 1
      } else {
        seenInFile.add(identity)
      }
    }

    let match: any | undefined
    if (rowErrors.length === 0 && action !== 'skip') {
      if (schema.matchExisting) {
        const matched = schema.matchExisting(mapped, existing)
        if (matched.error) rowErrors.push(matched.error)
        if (matched.warning) rowWarnings.push(matched.warning)
        match = matched.record
      } else if (schema.uniqueKey) {
        const key = norm(mapped[schema.uniqueKey])
        if (key) match = existingByKey.get(key)
      }
      if (match?.id && targetedExistingIds.has(match.id)) {
        rowErrors.push('Another row in this file already targets this existing record. Keep one row and retry.')
      }
    }

    if (rowErrors.length > 0) {
      action = 'invalid'
      invalidRows += 1
    } else {
      validRows += 1
      if (action !== 'skip') {
        if (match) {
          existingId = match.id
          targetedExistingIds.add(match.id)
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
          action = 'create'
          newRecords += 1
        }
      }
    }

    importRows.push({
      rowIndex,
      raw,
      mapped,
      action,
      errors: rowErrors,
      warnings: rowWarnings,
      existingId,
    })
  }

  const formulaOnlyRows = new Map<number, string[]>()
  for (const cell of parsed.formulaCells ?? []) {
    if (dataRowNumbers.has(cell.rowIndex)) continue
    const errors = formulaOnlyRows.get(cell.rowIndex) ?? []
    errors.push(`Formula detected in "${cell.column}" (${cell.address}). Replace it with a plain value.`)
    formulaOnlyRows.set(cell.rowIndex, errors)
  }
  for (const [rowIndex, errors] of [...formulaOnlyRows.entries()].sort(([left], [right]) => left - right)) {
    importRows.push({
      rowIndex,
      raw: {},
      mapped: {},
      action: 'invalid',
      errors,
      warnings: [],
    })
    invalidRows += 1
  }

  return {
    fileName,
    moduleKey: schema.key,
    templateVersion: schema.version,
    totalRows: importRows.length,
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
    sourceHeaders: [...parsed.headers],
    sourceRowNumbers: [...rowNumbers],
    sourceFormulaCells: [...(parsed.formulaCells ?? [])],
    sourceRawRowCount: parsed.rawRowCount,
    sourceFirstSheetName: parsed.firstSheetName,
  }
}
