import 'server-only'

import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { readAppSession } from '@/lib/app-session'
import { isWewedPlatformAdministrator } from '@/lib/business-access'
import { listAccessibleWeddings } from '@/lib/wedding-access'
import type { NotebookActor, NotebookNoteRow } from './types'

export async function getNotebookActor(request: NextRequest): Promise<NotebookActor | null> {
  const session = readAppSession(request)
  if (!session) return null

  const platformAdmin = await isWewedPlatformAdministrator(session.userId)
  const weddings = platformAdmin
    ? []
    : await listAccessibleWeddings(session.userId, session.role)

  const accessibleWeddingIds = weddings
    .filter((wedding) => wedding.membershipStatus === 'active')
    .map((wedding) => wedding.id)

  const editableWeddingIds = weddings
    .filter(
      (wedding) =>
        wedding.membershipStatus === 'active' &&
        (wedding.permissions.includes('*') || wedding.permissions.includes('planner.edit')),
    )
    .map((wedding) => wedding.id)

  return {
    session,
    platformAdmin,
    weddings,
    accessibleWeddingIds,
    editableWeddingIds,
  }
}

export function actorCanCreateInWedding(actor: NotebookActor, weddingId: string): boolean {
  return actor.editableWeddingIds.includes(weddingId)
}

export function actorCanReadNote(actor: NotebookActor, note: NotebookNoteRow): boolean {
  if (note.ownerUserId === actor.session.userId) return true
  if (note.shareRole === 'VIEWER' || note.shareRole === 'EDITOR') return true

  if (
    note.weddingId &&
    actor.accessibleWeddingIds.includes(note.weddingId) &&
    (note.visibility === 'WEDDING_TEAM' || note.visibility === 'SHARED')
  ) {
    return true
  }

  return note.visibility === 'ADMIN_INTERNAL' && actor.platformAdmin
}

export function actorCanEditNote(actor: NotebookActor, note: NotebookNoteRow): boolean {
  if (note.ownerUserId === actor.session.userId) return true
  if (note.shareRole === 'EDITOR') return true

  return Boolean(
    note.weddingId &&
      actor.editableWeddingIds.includes(note.weddingId) &&
      (note.visibility === 'WEDDING_TEAM' || note.visibility === 'SHARED'),
  )
}

export async function getActorInternalAccountId(actor: NotebookActor): Promise<string | null> {
  if (!actor.platformAdmin) return null

  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT ba.id
       FROM public."BusinessAccountMember" bam
       JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
      WHERE bam."userId" = $1
        AND bam.status = 'active'
        AND ba.status = 'active'
        AND ba.type = 'wewed_internal'
      ORDER BY bam."createdAt" ASC
      LIMIT 1`,
    actor.session.userId,
  )

  return rows[0]?.id ?? null
}

export function buildAuthorizedNoteWhere(actor: NotebookActor, firstParam = 1): {
  clause: string
  params: unknown[]
} {
  const params: unknown[] = [actor.session.userId]
  const userParam = `$${firstParam}`
  const clauses = [
    `n."ownerUserId" = ${userParam}`,
    `EXISTS (
       SELECT 1 FROM wewed_notebook."NotebookShare" ns
        WHERE ns."noteId" = n.id
          AND ns."userId" = ${userParam}
          AND ns."revokedAt" IS NULL
     )`,
  ]

  if (actor.accessibleWeddingIds.length > 0) {
    const weddingParams = actor.accessibleWeddingIds.map((weddingId, index) => {
      params.push(weddingId)
      return `$${firstParam + index + 1}`
    })
    clauses.push(
      `(n.visibility IN ('WEDDING_TEAM','SHARED') AND n."weddingId" IN (${weddingParams.join(',')}))`,
    )
  }

  if (actor.platformAdmin) clauses.push(`n.visibility = 'ADMIN_INTERNAL'`)

  return { clause: `(${clauses.join(' OR ')})`, params }
}
