import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { actorCanEditNote } from './access'
import { getNote, writeAudit } from './store'
import { NotebookConflictError, NotebookForbiddenError, type NotebookActor } from './types'

export const NOTEBOOK_MANUAL_CHECKPOINT_MARKER = 'manual-checkpoint-v1'

/**
 * NotebookNote.version remains the conflict-safe internal revision counter.
 * Ordinary editor PATCHes should not also become user-facing history points.
 */
export async function discardNotebookAutosaveVersion(
  actor: NotebookActor,
  noteId: string,
  revision: number,
): Promise<void> {
  const note = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  if (!Number.isInteger(revision) || revision < 1 || revision > note.version) return

  await db.$executeRawUnsafe(
    `DELETE FROM wewed_notebook."NotebookNoteVersion"
      WHERE "noteId" = $1
        AND version = $2
        AND source = 'USER'`,
    noteId,
    revision,
  )
}

export async function createNotebookCheckpoint(
  actor: NotebookActor,
  noteId: string,
  expectedVersion: number,
): Promise<{ checkpointed: boolean; revision: number }> {
  const note = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  if (!Number.isInteger(expectedVersion) || expectedVersion !== note.version) {
    throw new NotebookConflictError('The note changed before the checkpoint was saved. Wait for autosave, then try again.')
  }

  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO wewed_notebook."NotebookNoteVersion"
      (id, "noteId", version, title, "contentJson", "contentText", source,
       "createdByUserId", "providerName", "modelName", "promptVersion")
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,'SYSTEM',$7,NULL,NULL,$8)
     ON CONFLICT ("noteId", version) DO UPDATE SET
       title = EXCLUDED.title,
       "contentJson" = EXCLUDED."contentJson",
       "contentText" = EXCLUDED."contentText",
       source = 'SYSTEM',
       "createdByUserId" = EXCLUDED."createdByUserId",
       "providerName" = NULL,
       "modelName" = NULL,
       "promptVersion" = EXCLUDED."promptVersion",
       "createdAt" = CURRENT_TIMESTAMP
     WHERE wewed_notebook."NotebookNoteVersion".source = 'USER'
     RETURNING id`,
    randomUUID(),
    noteId,
    note.version,
    note.title,
    JSON.stringify({ format: 'markdown', value: note.contentText }),
    note.contentText,
    actor.session.userId,
    NOTEBOOK_MANUAL_CHECKPOINT_MARKER,
  )

  const checkpointed = rows.length === 1
  await writeAudit(actor, noteId, checkpointed ? 'NOTE_CHECKPOINT_SAVED' : 'NOTE_CHECKPOINT_ALREADY_PROTECTED', {
    revision: note.version,
  })
  return { checkpointed, revision: note.version }
}
