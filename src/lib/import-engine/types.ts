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
  /** Internal field name, for example `fullName`. */
  key: string
  /** Human-readable worksheet label. */
  label: string
  required: boolean
  type: FieldType
  allowedValues?: string[]
  description?: string
  example?: string
  sensitive?: boolean
}

export interface ExistingRecordMatch {
  /** Existing active-wedding record selected for an update. */
  record?: any
  /** Deterministic matching failure, such as an unknown ID or ambiguous name. */
  error?: string
  /** Non-blocking matching context surfaced in the import preview. */
  warning?: string
}

export interface ImportExecutionContext {
  /** Authenticated actor used for dependent audit/pipeline synchronization. */
  actorId?: string
}

/**
 * A fully defined worksheet module. Legacy modules can rely on the generic
 * executor. Production planner worksheet modules provide the optional exact
 * snapshot/delete/restore hooks so rollback is wedding-scoped and lossless.
 */
export interface ModuleSchema {
  key: ModuleKey
  name: string
  description: string
  version: string
  fields: FieldDefinition[]
  rowToRecord: (row: Record<string, string>) => any
  recordToRow: (record: any) => Record<string, string>
  validateRow: (row: Record<string, string>) => string[]
  uniqueKey?: string
  rowIdentity?: (row: Record<string, string>) => string | null
  matchExisting?: (
    row: Record<string, string>,
    existingRecords: any[],
  ) => ExistingRecordMatch
  fetchExisting: (weddingId: string) => Promise<any[]>
  upsert: (
    weddingId: string,
    record: any,
    existing?: any,
    context?: ImportExecutionContext,
  ) => Promise<any>
  /** Capture exact pre-import state. Called before the row write. */
  captureRollbackSnapshot?: (
    weddingId: string,
    existing: any,
    record: any,
  ) => Promise<any>
  /** Delete one record created by this job, explicitly scoped to the wedding. */
  deleteCreated?: (
    weddingId: string,
    id: string,
    context?: ImportExecutionContext,
  ) => Promise<void>
  /** Restore exact pre-import state, explicitly scoped to the wedding. */
  restoreUpdated?: (
    weddingId: string,
    id: string,
    snapshot: any,
    context?: ImportExecutionContext,
  ) => Promise<void>
}

export type RowAction = 'create' | 'update' | 'skip' | 'invalid'

export interface ImportRow {
  /** Actual 1-based row number in the source workbook. */
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
