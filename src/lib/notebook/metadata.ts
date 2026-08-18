import 'server-only'

import { db } from '@/lib/db'
import { actorCanEditNote } from './access'
import { getNote, writeAudit } from './store'
import { NotebookForbiddenError, type NotebookActor } from './types'

const MAX_TAGS = 50
const MAX_TAG_LENGTH = 80

export function normalizeNotebookTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/^#+/, '').slice(0, MAX_TAG_LENGTH))
    .filter(Boolean)))
    .slice(0, MAX_TAGS)
}

export async function setNotebookTags(
  actor: NotebookActor,
  noteId: string,
  value: unknown,
): Promise<string[]> {
  const note = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  const tags = normalizeNotebookTags(value)
  await db.$executeRawUnsafe(
    `UPDATE wewed_notebook."NotebookNote"
        SET tags=$2::jsonb, "updatedByUserId"=$3, "updatedAt"=CURRENT_TIMESTAMP
      WHERE id=$1 AND "deletedAt" IS NULL`,
    noteId,
    JSON.stringify(tags),
    actor.session.userId,
  )
  await writeAudit(actor, noteId, 'TAGS_UPDATED', { tagCount: tags.length })
  return tags
}
