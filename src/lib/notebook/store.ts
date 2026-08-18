import 'server-only'

import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  actorCanCreateInWedding,
  actorCanEditNote,
  actorCanReadNote,
  buildAuthorizedNoteWhere,
  getActorInternalAccountId,
} from './access'
import {
  NOTE_TYPES,
  NOTE_VISIBILITIES,
  NotebookConflictError,
  NotebookForbiddenError,
  NotebookNotFoundError,
  NotebookValidationError,
  type NotebookActor,
  type NotebookEntityLink,
  type NotebookNoteRow,
  type NotebookNoteType,
  type NotebookSuggestion,
  type NotebookVersion,
  type NotebookVisibility,
} from './types'

const MAX_TITLE_LENGTH = 300
const MAX_NOTE_CHARACTERS = 2_000_000
const MAX_TAGS = 50
const MAX_TAG_LENGTH = 80

function normalizeTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim() : ''
  return (title || 'Untitled note').slice(0, MAX_TITLE_LENGTH)
}

function normalizeContent(value: unknown): string {
  const content = typeof value === 'string' ? value : ''
  if (content.length > MAX_NOTE_CHARACTERS) {
    throw new NotebookValidationError(
      `A single note cannot exceed ${MAX_NOTE_CHARACTERS.toLocaleString()} characters. Split it into additional pages instead.`,
    )
  }
  return content
}

function contentJson(contentText: string): string {
  return JSON.stringify({ format: 'markdown', value: contentText })
}

function normalizeVisibility(value: unknown): NotebookVisibility {
  if (typeof value === 'string' && NOTE_VISIBILITIES.includes(value as NotebookVisibility)) {
    return value as NotebookVisibility
  }
  return 'PRIVATE'
}

function normalizeNoteType(value: unknown): NotebookNoteType {
  if (typeof value === 'string' && NOTE_TYPES.includes(value as NotebookNoteType)) {
    return value as NotebookNoteType
  }
  return 'GENERAL'
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim().slice(0, MAX_TAG_LENGTH))
        .filter(Boolean),
    ),
  ).slice(0, MAX_TAGS)
}

async function audit(
  tx: Prisma.TransactionClient | typeof db,
  actor: NotebookActor,
  noteId: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO wewed_notebook."NotebookAuditEvent"
      (id, "noteId", "actorUserId", action, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    randomUUID(),
    noteId,
    actor.session.userId,
    action,
    JSON.stringify(metadata),
  )
}

export async function listNotes(
  actor: NotebookActor,
  filters: {
    query?: string | null
    weddingId?: string | null
    noteType?: string | null
    pinned?: boolean
    archived?: boolean
    deleted?: boolean
    limit?: number
  } = {},
): Promise<NotebookNoteRow[]> {
  const access = buildAuthorizedNoteWhere(actor)
  const params = [...access.params]
  const where = [access.clause]
  const add = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }

  if (!filters.deleted) where.push('n."deletedAt" IS NULL')
  if (!filters.archived) where.push('n."archivedAt" IS NULL')

  if (filters.weddingId) {
    if (!actor.accessibleWeddingIds.includes(filters.weddingId) && actor.session.userId !== filters.weddingId) {
      // Ownership is still enforced by the access clause; this prevents using a foreign wedding as a discovery oracle.
      if (!actor.platformAdmin) throw new NotebookForbiddenError('Wedding scope is not accessible.')
    }
    where.push(`n."weddingId" = ${add(filters.weddingId)}`)
  }
  if (filters.noteType && NOTE_TYPES.includes(filters.noteType as NotebookNoteType)) {
    where.push(`n."noteType" = ${add(filters.noteType)}`)
  }
  if (filters.pinned) where.push('n."isPinned" = TRUE')
  if (filters.query?.trim()) {
    const q = filters.query.trim().slice(0, 500)
    where.push(
      `to_tsvector('simple', coalesce(n.title,'') || ' ' || coalesce(n."contentText",'')) @@ plainto_tsquery('simple', ${add(q)})`,
    )
  }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500)
  params.push(limit)

  return db.$queryRawUnsafe<NotebookNoteRow[]>(
    `SELECT n.*,
            (SELECT ns.role
               FROM wewed_notebook."NotebookShare" ns
              WHERE ns."noteId" = n.id
                AND ns."userId" = $1
                AND ns."revokedAt" IS NULL
              LIMIT 1) AS "shareRole"
       FROM wewed_notebook."NotebookNote" n
      WHERE ${where.join(' AND ')}
      ORDER BY n."isPinned" DESC, n."updatedAt" DESC
      LIMIT $${params.length}`,
    ...params,
  )
}

export async function getNote(
  actor: NotebookActor,
  noteId: string,
  includeDeleted = false,
): Promise<NotebookNoteRow> {
  const access = buildAuthorizedNoteWhere(actor, 2)
  const rows = await db.$queryRawUnsafe<NotebookNoteRow[]>(
    `SELECT n.*,
            (SELECT ns.role
               FROM wewed_notebook."NotebookShare" ns
              WHERE ns."noteId" = n.id
                AND ns."userId" = $2
                AND ns."revokedAt" IS NULL
              LIMIT 1) AS "shareRole"
       FROM wewed_notebook."NotebookNote" n
      WHERE n.id = $1
        AND ${access.clause}
        ${includeDeleted ? '' : 'AND n."deletedAt" IS NULL'}
      LIMIT 1`,
    noteId,
    ...access.params,
  )

  const note = rows[0]
  if (!note || !actorCanReadNote(actor, note)) throw new NotebookNotFoundError()
  return note
}

export async function createNote(
  actor: NotebookActor,
  input: {
    title?: unknown
    contentText?: unknown
    weddingId?: unknown
    noteType?: unknown
    visibility?: unknown
    contextType?: unknown
    isPinned?: unknown
    tags?: unknown
  },
): Promise<NotebookNoteRow> {
  const id = randomUUID()
  const title = normalizeTitle(input.title)
  const text = normalizeContent(input.contentText)
  const weddingId = typeof input.weddingId === 'string' && input.weddingId ? input.weddingId : null
  const visibility = normalizeVisibility(input.visibility)
  const noteType = normalizeNoteType(input.noteType)
  const contextType = typeof input.contextType === 'string' ? input.contextType.slice(0, 80) : 'personal'
  const isPinned = input.isPinned === true
  const tags = normalizeTags(input.tags)

  if (weddingId && !actorCanCreateInWedding(actor, weddingId)) {
    throw new NotebookForbiddenError('You cannot create notes in that wedding workspace.')
  }
  if (visibility === 'WEDDING_TEAM' && !weddingId) {
    throw new NotebookValidationError('Wedding-team notes require a wedding context.')
  }
  if (visibility === 'ADMIN_INTERNAL' && !actor.platformAdmin) {
    throw new NotebookForbiddenError('Admin-internal notes require Wewed staff access.')
  }

  const adminAccountId = visibility === 'ADMIN_INTERNAL' ? await getActorInternalAccountId(actor) : null

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_notebook."NotebookNote"
        (id, "ownerUserId", "weddingId", "adminAccountId", "contextType", title,
         "contentJson", "contentText", "noteType", visibility, "isPinned",
         "createdByUserId", "updatedByUserId")
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$2,$2)`,
      id,
      actor.session.userId,
      weddingId,
      adminAccountId,
      contextType,
      title,
      contentJson(text),
      text,
      noteType,
      visibility,
      isPinned,
    )

    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_notebook."NotebookNoteVersion"
        (id, "noteId", version, title, "contentJson", "contentText", source, "createdByUserId")
       VALUES ($1,$2,1,$3,$4::jsonb,$5,'USER',$6)`,
      randomUUID(),
      id,
      title,
      contentJson(text),
      text,
      actor.session.userId,
    )

    if (tags.length > 0) {
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_notebook."NotebookEntityLink"
          (id, "noteId", "entityType", "entityId", "labelSnapshot", "createdByUserId")
         VALUES ($1,$2,'tag',$3,$3,$4)`,
        randomUUID(),
        id,
        `tags:${JSON.stringify(tags)}`,
        actor.session.userId,
      )
    }
    await audit(tx, actor, id, 'NOTE_CREATED', { weddingId, visibility, noteType })
  })

  return getNote(actor, id)
}

export async function updateNote(
  actor: NotebookActor,
  noteId: string,
  input: {
    expectedVersion: number
    title?: unknown
    contentText?: unknown
    weddingId?: unknown
    visibility?: unknown
    noteType?: unknown
    contextType?: unknown
    isPinned?: unknown
    archived?: unknown
  },
  versionSource: 'USER' | 'AI' | 'RESTORE' | 'SYSTEM' = 'USER',
  aiMeta?: { provider?: string; model?: string; promptVersion?: string },
): Promise<NotebookNoteRow> {
  const current = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, current)) throw new NotebookForbiddenError()
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new NotebookValidationError('expectedVersion is required for conflict-safe saving.')
  }

  const title = input.title === undefined ? current.title : normalizeTitle(input.title)
  const text = input.contentText === undefined ? current.contentText : normalizeContent(input.contentText)
  const weddingId =
    input.weddingId === undefined
      ? current.weddingId
      : typeof input.weddingId === 'string' && input.weddingId
        ? input.weddingId
        : null
  const visibility =
    input.visibility === undefined ? current.visibility : normalizeVisibility(input.visibility)
  const noteType = input.noteType === undefined ? current.noteType : normalizeNoteType(input.noteType)
  const contextType =
    input.contextType === undefined
      ? current.contextType
      : typeof input.contextType === 'string'
        ? input.contextType.slice(0, 80)
        : current.contextType
  const isPinned = input.isPinned === undefined ? current.isPinned : input.isPinned === true
  const archivedAt =
    input.archived === undefined
      ? current.archivedAt
      : input.archived
        ? new Date()
        : null

  if (weddingId && !actorCanCreateInWedding(actor, weddingId)) {
    throw new NotebookForbiddenError('You cannot move this note to that wedding workspace.')
  }
  if (visibility === 'WEDDING_TEAM' && !weddingId) {
    throw new NotebookValidationError('Wedding-team notes require a wedding context.')
  }
  if (visibility === 'ADMIN_INTERNAL' && !actor.platformAdmin) {
    throw new NotebookForbiddenError('Admin-internal notes require Wewed staff access.')
  }

  const nextVersion = input.expectedVersion + 1
  const adminAccountId =
    visibility === 'ADMIN_INTERNAL' ? await getActorInternalAccountId(actor) : null

  await db.$transaction(async (tx) => {
    const changed = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE wewed_notebook."NotebookNote"
          SET title = $3,
              "contentJson" = $4::jsonb,
              "contentText" = $5,
              "weddingId" = $6,
              "adminAccountId" = $7,
              visibility = $8,
              "noteType" = $9,
              "contextType" = $10,
              "isPinned" = $11,
              "archivedAt" = $12,
              version = $13,
              "updatedByUserId" = $14,
              "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND version = $2 AND "deletedAt" IS NULL
        RETURNING id`,
      noteId,
      input.expectedVersion,
      title,
      contentJson(text),
      text,
      weddingId,
      adminAccountId,
      visibility,
      noteType,
      contextType,
      isPinned,
      archivedAt,
      nextVersion,
      actor.session.userId,
    )

    if (changed.length !== 1) throw new NotebookConflictError()

    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_notebook."NotebookNoteVersion"
        (id, "noteId", version, title, "contentJson", "contentText", source,
         "createdByUserId", "providerName", "modelName", "promptVersion")
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)`,
      randomUUID(),
      noteId,
      nextVersion,
      title,
      contentJson(text),
      text,
      versionSource,
      actor.session.userId,
      aiMeta?.provider ?? null,
      aiMeta?.model ?? null,
      aiMeta?.promptVersion ?? null,
    )

    await tx.$executeRawUnsafe(
      `UPDATE wewed_notebook."NotebookAiDerivation"
          SET stale = TRUE
        WHERE "noteId" = $1 AND "sourceVersion" < $2 AND stale = FALSE`,
      noteId,
      nextVersion,
    )
    await tx.$executeRawUnsafe(
      `UPDATE wewed_notebook."NotebookSuggestion"
          SET status = 'STALE', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "noteId" = $1 AND "sourceVersion" < $2 AND status IN ('PENDING','APPROVED')`,
      noteId,
      nextVersion,
    )
    await audit(tx, actor, noteId, 'NOTE_UPDATED', {
      fromVersion: input.expectedVersion,
      toVersion: nextVersion,
      source: versionSource,
    })
  })

  return getNote(actor, noteId)
}

export async function deleteNote(actor: NotebookActor, noteId: string): Promise<void> {
  const note = await getNote(actor, noteId)
  if (note.ownerUserId !== actor.session.userId) {
    throw new NotebookForbiddenError('Only the note owner can move a note to trash.')
  }
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE wewed_notebook."NotebookNote"
          SET "deletedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND "deletedAt" IS NULL`,
      noteId,
    )
    await audit(tx, actor, noteId, 'NOTE_TRASHED')
  })
}

export async function restoreDeletedNote(actor: NotebookActor, noteId: string): Promise<NotebookNoteRow> {
  const note = await getNote(actor, noteId, true)
  if (note.ownerUserId !== actor.session.userId) {
    throw new NotebookForbiddenError('Only the note owner can restore a trashed note.')
  }
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE wewed_notebook."NotebookNote"
          SET "deletedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1`,
      noteId,
    )
    await audit(tx, actor, noteId, 'NOTE_RESTORED_FROM_TRASH')
  })
  return getNote(actor, noteId)
}

export async function listVersions(actor: NotebookActor, noteId: string): Promise<NotebookVersion[]> {
  await getNote(actor, noteId)
  return db.$queryRawUnsafe<NotebookVersion[]>(
    `SELECT * FROM wewed_notebook."NotebookNoteVersion"
      WHERE "noteId" = $1
      ORDER BY version DESC`,
    noteId,
  )
}

export async function restoreVersion(
  actor: NotebookActor,
  noteId: string,
  version: number,
  expectedVersion: number,
): Promise<NotebookNoteRow> {
  const note = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  const versions = await db.$queryRawUnsafe<NotebookVersion[]>(
    `SELECT * FROM wewed_notebook."NotebookNoteVersion"
      WHERE "noteId" = $1 AND version = $2 LIMIT 1`,
    noteId,
    version,
  )
  const source = versions[0]
  if (!source) throw new NotebookNotFoundError('Requested note version was not found.')
  return updateNote(
    actor,
    noteId,
    {
      expectedVersion,
      title: source.title,
      contentText: source.contentText,
    },
    'RESTORE',
  )
}

export async function listLinks(actor: NotebookActor, noteId: string): Promise<NotebookEntityLink[]> {
  await getNote(actor, noteId)
  return db.$queryRawUnsafe<NotebookEntityLink[]>(
    `SELECT * FROM wewed_notebook."NotebookEntityLink"
      WHERE "noteId" = $1 AND "entityType" <> 'tag'
      ORDER BY "createdAt" ASC`,
    noteId,
  )
}

export async function addLink(
  actor: NotebookActor,
  noteId: string,
  input: { entityType: string; entityId: string; labelSnapshot?: string | null },
): Promise<void> {
  const note = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  const entityType = input.entityType.trim().slice(0, 80)
  const entityId = input.entityId.trim().slice(0, 300)
  if (!entityType || !entityId) throw new NotebookValidationError('Entity type and ID are required.')
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_notebook."NotebookEntityLink"
      (id, "noteId", "entityType", "entityId", "labelSnapshot", "createdByUserId")
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT ("noteId", "entityType", "entityId")
     DO UPDATE SET "labelSnapshot" = EXCLUDED."labelSnapshot"`,
    randomUUID(),
    noteId,
    entityType,
    entityId,
    input.labelSnapshot?.slice(0, 500) ?? null,
    actor.session.userId,
  )
}

export async function removeLink(
  actor: NotebookActor,
  noteId: string,
  linkId: string,
): Promise<void> {
  const note = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  await db.$executeRawUnsafe(
    `DELETE FROM wewed_notebook."NotebookEntityLink" WHERE id = $1 AND "noteId" = $2`,
    linkId,
    noteId,
  )
}

export async function upsertShare(
  actor: NotebookActor,
  noteId: string,
  input: { userId: string; role: 'VIEWER' | 'EDITOR' },
): Promise<void> {
  const note = await getNote(actor, noteId)
  if (note.ownerUserId !== actor.session.userId) {
    throw new NotebookForbiddenError('Only the note owner can manage sharing.')
  }
  if (input.userId === actor.session.userId) return
  const users = await db.user.findMany({ where: { id: input.userId, isActive: true }, select: { id: true } })
  if (users.length !== 1) throw new NotebookValidationError('Share recipient is not an active Wewed user.')

  await db.$executeRawUnsafe(
    `INSERT INTO wewed_notebook."NotebookShare"
      (id, "noteId", "userId", role, "createdByUserId")
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT ("noteId", "userId")
     DO UPDATE SET role = EXCLUDED.role, "revokedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP`,
    randomUUID(),
    noteId,
    input.userId,
    input.role,
    actor.session.userId,
  )
}

export async function revokeShare(actor: NotebookActor, noteId: string, userId: string): Promise<void> {
  const note = await getNote(actor, noteId)
  if (note.ownerUserId !== actor.session.userId) {
    throw new NotebookForbiddenError('Only the note owner can manage sharing.')
  }
  await db.$executeRawUnsafe(
    `UPDATE wewed_notebook."NotebookShare"
        SET "revokedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "noteId" = $1 AND "userId" = $2`,
    noteId,
    userId,
  )
}

export async function listShares(
  actor: NotebookActor,
  noteId: string,
): Promise<Array<{ userId: string; role: string; email: string; name: string | null }>> {
  const note = await getNote(actor, noteId)
  if (note.ownerUserId !== actor.session.userId && !actorCanEditNote(actor, note)) {
    throw new NotebookForbiddenError()
  }
  return db.$queryRawUnsafe(
    `SELECT ns."userId", ns.role, u.email, u.name
       FROM wewed_notebook."NotebookShare" ns
       JOIN public."User" u ON u.id = ns."userId"
      WHERE ns."noteId" = $1 AND ns."revokedAt" IS NULL
      ORDER BY u.email ASC`,
    noteId,
  )
}

export async function listSuggestions(actor: NotebookActor, noteId: string): Promise<NotebookSuggestion[]> {
  await getNote(actor, noteId)
  return db.$queryRawUnsafe<NotebookSuggestion[]>(
    `SELECT * FROM wewed_notebook."NotebookSuggestion"
      WHERE "noteId" = $1
      ORDER BY CASE status WHEN 'PENDING' THEN 0 WHEN 'FAILED' THEN 1 ELSE 2 END,
               "createdAt" DESC`,
    noteId,
  )
}

export async function rejectSuggestion(
  actor: NotebookActor,
  noteId: string,
  suggestionId: string,
): Promise<void> {
  const note = await getNote(actor, noteId)
  if (!actorCanEditNote(actor, note)) throw new NotebookForbiddenError()
  await db.$executeRawUnsafe(
    `UPDATE wewed_notebook."NotebookSuggestion"
        SET status = 'REJECTED', "reviewedByUserId" = $3,
            "reviewedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "noteId" = $2 AND status IN ('PENDING','FAILED')`,
    suggestionId,
    noteId,
    actor.session.userId,
  )
}

export async function writeAudit(
  actor: NotebookActor,
  noteId: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await audit(db, actor, noteId, action, metadata)
}
