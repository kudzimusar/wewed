/**
 * wewed — Import/Export Engine — Type Definitions
 * ============================================================
 * Core contracts shared by every import/export module.
 *
 * Treat all spreadsheet content as untrusted input. Formula cells are never
 * executable values, every lookup is scoped to the active wedding, and any
 * module that needs relational rollback must provide exact snapshot hooks.
 */

export type ModuleKey =
  | 'guests'
  | 'budget'
  | 'checklist'
  | 'seating'
  | 'vendors'
  | 'timeline'
  | 'songs'
  | 'wedding-party'
  | 'travel'
  | 'media'
  | 'contributions'

export type FieldType =
  | 'string'
  | 'number'
  | 'currency'
  | 'date'
  | 'email'
  | 'phone'
  | 'enum'
  | 'boolean'

export interface FieldDefinition {
  key: string
  label: string
  required: boolean
  type: FieldType
  allowedValues?: string[]
  description?: string
  example?: string
  sensitive?: boolean
}

export interface ExistingRecordMatch {
  record?: any
  error?: string
  warning?: string
}

export interface ImportExecutionContext {
  actorId?: string
  /** Prisma transaction client supplied by the executor for atomic row writes. */
  db?: any
}

export interface PreviewBatchRow {
  rowIndex: number
  mapped: Record<string, string>
}

export interface ModuleSchema {
  key: ModuleKey
  name: string
  description: string
  version: string
  fields: FieldDefinition[]
  rowToRecord: (row: Record<string, string>) => any
  recordToRow: (record: any) => Record<string, string>
  validateRow: (row: Record<string, string>) => string[]
  /** Optional active-wedding reference validation performed per row. */
  validateReferences?: (
    row: Record<string, string>,
    weddingId: string,
  ) => Promise<string[]>
  /** Optional whole-file validation for capacity and other relational invariants. */
  validateBatch?: (
    rows: PreviewBatchRow[],
    existingRecords: any[],
    weddingId: string,
  ) => Promise<Map<number, string[]>>
  uniqueKey?: string
  rowIdentity?: (row: Record<string, string>) => string | null
  matchExisting?: (
    row: Record<string, string>,
    existingRecords: any[],
  ) => ExistingRecordMatch
  /** Override generic blank-preserving comparison where blank is an explicit value. */
  rowDiffers?: (row: Record<string, string>, existingRecord: any) => boolean
  fetchExisting: (weddingId: string) => Promise<any[]>
  upsert: (
    weddingId: string,
    record: any,
    existing?: any,
    context?: ImportExecutionContext,
  ) => Promise<any>
  captureRollbackSnapshot?: (
    weddingId: string,
    existing: any,
    record: any,
  ) => Promise<any>
  deleteCreated?: (
    weddingId: string,
    id: string,
    context?: ImportExecutionContext,
  ) => Promise<void>
  restoreUpdated?: (
    weddingId: string,
    id: string,
    snapshot: any,
    context?: ImportExecutionContext,
  ) => Promise<void>
}

export type RowAction = 'create' | 'update' | 'skip' | 'invalid'

export interface ImportRow {
  rowIndex: number
  raw: Record<string, string>
  mapped: Record<string, string>
  action: RowAction
  errors: string[]
  warnings: string[]
  existingId?: string
}

export interface ImportPreview {
  fileName: string
  moduleKey: ModuleKey
  templateVersion: string
  totalRows: number
  validRows: number
  invalidRows: number
  newRecords: number
  updateRecords: number
  duplicateRecords: number
  conflictingRecords: number
  skippedRecords: number
  rows: ImportRow[]
  fieldMapping: Record<string, string>
  unmappedColumns: string[]
  missingRequired: string[]
  generatedAt: string
  fileFingerprint: string
  /** Original parser state retained so adjusted mappings cannot erase formulas. */
  sourceHeaders?: string[]
  sourceRowNumbers?: number[]
  sourceFormulaCells?: ParsedFormulaCell[]
  sourceRawRowCount?: number
  sourceFirstSheetName?: string
}

export interface ImportErrorEntry {
  row: number
  errors: string[]
}

export interface ImportResult {
  jobId: string
  moduleKey: ModuleKey
  created: number
  updated: number
  skipped: number
  errors: number
  errorReport: ImportErrorEntry[]
  rollbackToken: string
  executedAt: string
}

export interface ParsedFormulaCell {
  rowIndex: number
  column: string
  address: string
}

export interface ParsedFile {
  headers: string[]
  rows: Record<string, string>[]
  rowNumbers?: number[]
  formulaCells?: ParsedFormulaCell[]
  firstSheetName?: string
  rawRowCount: number
}

export interface RollbackSnapshot {
  jobId: string
  moduleKey: ModuleKey
  weddingId: string
  createdIds: string[]
  updatedSnapshots: Array<{ id: string; snapshot: any }>
  executedAt: string
}
