import type { AppSession } from '@/lib/app-session'
import type { AccessibleWedding } from '@/lib/wedding-access'

export const NOTE_VISIBILITIES = [
  'PRIVATE',
  'WEDDING_TEAM',
  'SELECTED_USERS',
  'ADMIN_INTERNAL',
  'SHARED',
] as const
export type NotebookVisibility = (typeof NOTE_VISIBILITIES)[number]

export const NOTE_TYPES = ['GENERAL', 'MEETING', 'VOICE', 'QUICK'] as const
export type NotebookNoteType = (typeof NOTE_TYPES)[number]

export const NOTE_AI_OPERATIONS = [
  'IMPROVE',
  'GRAMMAR',
  'SHORTEN',
  'EXPAND',
  'PROFESSIONAL',
  'CHECKLIST',
  'STRUCTURE_MEETING',
  'SUMMARY',
  'ANALYZE_MEETING',
  'TITLE_TAGS_ENTITIES',
  'SUGGEST_ACTIONS',
  'FREEFORM',
] as const
export type NotebookAiOperation = (typeof NOTE_AI_OPERATIONS)[number]

export interface NotebookActor {
  session: AppSession
  platformAdmin: boolean
  weddings: AccessibleWedding[]
  accessibleWeddingIds: string[]
  editableWeddingIds: string[]
}

export interface NotebookNoteRow {
  id: string
  ownerUserId: string
  weddingId: string | null
  adminAccountId: string | null
  contextType: string
  title: string
  contentJson: unknown
  contentText: string
  noteType: NotebookNoteType
  visibility: NotebookVisibility
  isPinned: boolean
  archivedAt: Date | null
  deletedAt: Date | null
  version: number
  createdByUserId: string
  updatedByUserId: string
  createdAt: Date
  updatedAt: Date
  shareRole?: 'VIEWER' | 'EDITOR' | null
}

export interface NotebookEntityLink {
  id: string
  noteId: string
  entityType: string
  entityId: string
  labelSnapshot: string | null
  createdAt: Date
}

export interface NotebookVersion {
  id: string
  noteId: string
  version: number
  title: string
  contentJson: unknown
  contentText: string
  source: 'USER' | 'AI' | 'RESTORE' | 'SYSTEM'
  providerName: string | null
  modelName: string | null
  promptVersion: string | null
  createdByUserId: string
  createdAt: Date
}

export interface NotebookSuggestion {
  id: string
  noteId: string
  sourceVersion: number
  targetType: string
  actionType: string
  payload: Record<string, unknown>
  rationale: string | null
  evidence: string | null
  confidence: number | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'FAILED' | 'STALE'
  idempotencyKey: string
  resultJson: unknown
  failureCode: string | null
  failureMessage: string | null
  createdAt: Date
  updatedAt: Date
}

export class NotebookConflictError extends Error {
  constructor(message = 'This note changed in another session. Reload before saving again.') {
    super(message)
    this.name = 'NotebookConflictError'
  }
}

export class NotebookForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this Notebook action.') {
    super(message)
    this.name = 'NotebookForbiddenError'
  }
}

export class NotebookNotFoundError extends Error {
  constructor(message = 'Notebook note not found.') {
    super(message)
    this.name = 'NotebookNotFoundError'
  }
}

export class NotebookValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotebookValidationError'
  }
}
