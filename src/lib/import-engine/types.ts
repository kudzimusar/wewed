/**
 * wewed — Import/Export Engine — Type Definitions
 * ============================================================
 * Core type contracts shared by every import/export module.
 * The engine is data-driven: schemas describe how to parse,
 * validate, and persist rows for any of the 10 worksheet modules.
 *
 * Treat ALL spreadsheet cell content as untrusted input. Never
 * execute spreadsheet formulas. Always escape on render.
 *
 * NOTE on persistence: ImportJob / ImportRollback models are
 * referenced here for rollback support. They will be added to
 * the Prisma schema separately (Phase 2). The executor falls
 * back to an in-memory token store when those models are not
 * yet present, so the engine is usable today and forward-compatible.
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
  /** internal field name (e.g. "fullName") */
  key: string
  /** human label (e.g. "Full Name") */
  label: string
  required: boolean
  type: FieldType
  /** for enum type — allowed values */
  allowedValues?: string[]
  /** field instruction shown in template instructions sheet */
  description?: string
  /** example value used in the template example row */
  example?: string
  /** marks private data (phone, email, dietary, etc.) — surfaces a warning on import */
  sensitive?: boolean
}

export interface ExistingRecordMatch {
  /** The existing active-wedding record selected for an update. */
  record?: any
  /** A deterministic matching failure, such as an ambiguous name. */
  error?: string
  /** Non-blocking matching context surfaced in the import preview. */
  warning?: string
}

/**
 * A fully-defined worksheet module. The engine is generic over
 * ModuleSchema; the 10 module instances live in schemas.ts.
 */
export interface ModuleSchema {
  key: ModuleKey
  name: string
  description: string
  /** template version (e.g. "1.0.0") — bump when fields change */
  version: string
  fields: FieldDefinition[]
  /** Convert a parsed, mapped row to a DB record object */
  rowToRecord: (row: Record<string, string>) => any
  /** Convert a DB record to an export row (string values) */
  recordToRow: (record: any) => Record<string, string>
  /** Validate a row → list of errors (empty = valid) */
  validateRow: (row: Record<string, string>) => string[]
  /** Field key used for default duplicate detection (e.g. "email" or "taskId") */
  uniqueKey?: string
  /**
   * Optional stable identity for duplicate detection within one file.
   * Used by modules such as Guests that support ID, email and name fallbacks.
   */
  rowIdentity?: (row: Record<string, string>) => string | null
  /**
   * Optional deterministic existing-record matcher. It receives only records
   * already scoped to the active wedding by fetchExisting.
   */
  matchExisting?: (
    row: Record<string, string>,
    existingRecords: any[],
  ) => ExistingRecordMatch
  /** Fetch existing records for this module + wedding */
  fetchExisting: (weddingId: string) => Promise<any[]>
  /** Create or update a record. `existing` is the matched existing record (if any) */
  upsert: (weddingId: string, record: any, existing?: any) => Promise<any>
}

export type RowAction = 'create' | 'update' | 'skip' | 'invalid'

export interface ImportRow {
  /** 1-based row index from the source file (header is row 0) */
  rowIndex: number
  /** raw source row (original column names → values) */
  raw: Record<string, string>
  /** mapped row (internal field keys → values) */
  mapped: Record<string, string>
  action: RowAction
  errors: string[]
  warnings: string[]
  /** id of the existing record if action = update */
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
  /** source column → internal field key */
  fieldMapping: Record<string, string>
  /** source columns that didn't match any schema field */
  unmappedColumns: string[]
  /** required fields with no source column mapping to them */
  missingRequired: string[]
  /** ISO timestamp the preview was generated */
  generatedAt: string
  /** SHA-256-ish fingerprint of the parsed file (for job-id stability) */
  fileFingerprint: string
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
  /** token to reverse this import (passed to DELETE /api/imports/[jobId]) */
  rollbackToken: string
  /** ISO timestamp of execution */
  executedAt: string
}

/**
 * Parsed file shape returned by the parser.
 * Headers are trimmed + de-duplicated; rows are string-keyed.
 */
export interface ParsedFile {
  headers: string[]
  rows: Record<string, string>[]
  /** row count BEFORE empty-row filtering, for telemetry */
  rawRowCount: number
}

/**
 * Lightweight in-memory store for rollback tokens.
 * Used until the ImportJob/ImportRollback Prisma models exist.
 * Keys: rollbackToken → { jobId, moduleKey, weddingId, createdIds[], updatedSnapshots[] }.
 */
export interface RollbackSnapshot {
  jobId: string
  moduleKey: ModuleKey
  weddingId: string
  /** record ids created by this import (DELETE on rollback) */
  createdIds: string[]
  /** { id, snapshot: <previous record JSON> } for updated records (RESTORE on rollback) */
  updatedSnapshots: Array<{ id: string; snapshot: any }>
  executedAt: string
}
