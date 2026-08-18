import type { NotebookActor, NotebookNoteRow } from './types'

export function notebookActorCanRead(actor: NotebookActor, note: NotebookNoteRow): boolean {
  if (note.ownerUserId === actor.session.userId) return true
  if (note.shareRole === 'VIEWER' || note.shareRole === 'EDITOR') return true
  if (
    note.weddingId &&
    actor.accessibleWeddingIds.includes(note.weddingId) &&
    (note.visibility === 'WEDDING_TEAM' || note.visibility === 'SHARED')
  ) return true
  return note.visibility === 'ADMIN_INTERNAL' && actor.platformAdmin
}

export function notebookActorCanEdit(actor: NotebookActor, note: NotebookNoteRow): boolean {
  if (note.ownerUserId === actor.session.userId) return true
  if (note.shareRole === 'EDITOR') return true
  return Boolean(
    note.weddingId &&
    actor.editableWeddingIds.includes(note.weddingId) &&
    (note.visibility === 'WEDDING_TEAM' || note.visibility === 'SHARED'),
  )
}
