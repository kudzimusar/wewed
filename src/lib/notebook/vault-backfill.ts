import 'server-only'

import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  createVaultLink,
  prepareVaultUpload,
  registerPreparedVaultObject,
  removePreparedVaultUpload,
  WEWED_VAULT_BUCKET,
  type PreparedVaultUpload,
} from '@/lib/vault/core'

const MAX_BACKFILL_BATCH = 25

type LegacyNotebookAttachment = {
  id: string
  noteId: string
  weddingId: string
  storageBucket: string
  storageKey: string
  fileName: string
  mimeType: string
  sizeBytes: bigint | number
  createdByUserId: string
}

export type NotebookVaultBackfillResult = {
  weddingId: string
  eligibleBefore: number
  processed: number
  migrated: number
  skipped: number
  failed: number
  cleanupWarnings: number
  remaining: number
  items: Array<{
    attachmentId: string
    status: 'migrated' | 'skipped' | 'failed'
    vaultObjectId?: string
    quarantined?: boolean
    cleanupWarning?: boolean
    reason?: string
  }>
}

export async function countLegacyWeddingNotebookAttachments(weddingId: string): Promise<number> {
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint | number }>>(
    `SELECT count(*) AS count
       FROM wewed_notebook."NotebookAttachment" a
       JOIN wewed_notebook."NotebookNote" n ON n.id = a."noteId"
      WHERE n."weddingId" = $1
        AND n."deletedAt" IS NULL
        AND a."deletedAt" IS NULL
        AND a."vaultObjectId" IS NULL`,
    weddingId,
  )
  return Number(rows[0]?.count ?? 0)
}

async function listLegacyWeddingNotebookAttachments(
  weddingId: string,
  limit: number,
): Promise<LegacyNotebookAttachment[]> {
  return db.$queryRawUnsafe<LegacyNotebookAttachment[]>(
    `SELECT
        a.id,
        a."noteId",
        n."weddingId",
        a."storageBucket",
        a."storageKey",
        a."fileName",
        a."mimeType",
        a."sizeBytes",
        a."createdByUserId"
       FROM wewed_notebook."NotebookAttachment" a
       JOIN wewed_notebook."NotebookNote" n ON n.id = a."noteId"
      WHERE n."weddingId" = $1
        AND n."deletedAt" IS NULL
        AND a."deletedAt" IS NULL
        AND a."vaultObjectId" IS NULL
      ORDER BY a."createdAt" ASC, a.id ASC
      LIMIT $2`,
    weddingId,
    limit,
  )
}

async function legacyAttachmentStillEligible(
  tx: Prisma.TransactionClient,
  attachmentId: string,
  weddingId: string,
): Promise<boolean> {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT a.id
       FROM wewed_notebook."NotebookAttachment" a
       JOIN wewed_notebook."NotebookNote" n ON n.id = a."noteId"
      WHERE a.id = $1
        AND n."weddingId" = $2
        AND n."deletedAt" IS NULL
        AND a."deletedAt" IS NULL
        AND a."vaultObjectId" IS NULL
      FOR UPDATE OF a`,
    attachmentId,
    weddingId,
  )
  return rows.length === 1
}

export async function backfillWeddingNotebookAttachments(input: {
  weddingId: string
  actorUserId: string
  limit?: number
}): Promise<NotebookVaultBackfillResult> {
  const limit = Math.min(Math.max(input.limit ?? MAX_BACKFILL_BATCH, 1), MAX_BACKFILL_BATCH)
  const eligibleBefore = await countLegacyWeddingNotebookAttachments(input.weddingId)
  const legacy = await listLegacyWeddingNotebookAttachments(input.weddingId, limit)
  const supabase = createSupabaseServiceClient()
  const items: NotebookVaultBackfillResult['items'] = []
  let migrated = 0
  let skipped = 0
  let failed = 0
  let cleanupWarnings = 0

  for (const attachment of legacy) {
    let prepared: PreparedVaultUpload | null = null
    try {
      const downloaded = await supabase.storage
        .from(attachment.storageBucket)
        .download(attachment.storageKey)
      if (downloaded.error || !downloaded.data) {
        throw new Error('Legacy private binary could not be read.')
      }

      const bytes = await downloaded.data.arrayBuffer()
      const file = new File([bytes], attachment.fileName, { type: attachment.mimeType })
      prepared = await prepareVaultUpload({
        file,
        weddingId: attachment.weddingId,
        actorId: attachment.createdByUserId,
        source: 'notebook_legacy_backfill',
        category: 'planner_note',
        metadata: {
          noteId: attachment.noteId,
          legacyAttachmentId: attachment.id,
          legacyStorageBucket: attachment.storageBucket,
          legacyStorageKey: attachment.storageKey,
          backfilledByUserId: input.actorUserId,
        },
      })

      const committed = await db.$transaction(async (tx) => {
        if (!await legacyAttachmentStillEligible(tx, attachment.id, attachment.weddingId)) {
          return false
        }
        await registerPreparedVaultObject(prepared!, tx)
        await createVaultLink({
          vaultObjectId: prepared!.id,
          weddingId: attachment.weddingId,
          entityType: 'notebook_note',
          entityId: attachment.noteId,
          linkRole: 'attachment',
          actorId: input.actorUserId,
          tx,
        })
        await tx.$executeRawUnsafe(
          `UPDATE wewed_notebook."NotebookAttachment"
              SET "storageBucket"=$2,
                  "storageKey"=$3,
                  "vaultObjectId"=$4,
                  status=$5
            WHERE id=$1`,
          attachment.id,
          WEWED_VAULT_BUCKET,
          prepared!.objectKey,
          prepared!.id,
          prepared!.distributable ? 'READY' : 'QUARANTINED',
        )
        return true
      })

      if (!committed) {
        await removePreparedVaultUpload(prepared)
        skipped += 1
        items.push({ attachmentId: attachment.id, status: 'skipped', reason: 'Attachment was already migrated or changed concurrently.' })
        continue
      }

      let cleanupWarning = false
      const removed = await supabase.storage
        .from(attachment.storageBucket)
        .remove([attachment.storageKey])
      if (removed.error) {
        cleanupWarning = true
        cleanupWarnings += 1
      }
      migrated += 1
      items.push({
        attachmentId: attachment.id,
        status: 'migrated',
        vaultObjectId: prepared.id,
        quarantined: !prepared.distributable,
        cleanupWarning,
      })
    } catch (error) {
      if (prepared) await removePreparedVaultUpload(prepared)
      failed += 1
      items.push({
        attachmentId: attachment.id,
        status: 'failed',
        reason: error instanceof Error ? error.message : 'Notebook Vault backfill failed.',
      })
    }
  }

  return {
    weddingId: input.weddingId,
    eligibleBefore,
    processed: legacy.length,
    migrated,
    skipped,
    failed,
    cleanupWarnings,
    remaining: await countLegacyWeddingNotebookAttachments(input.weddingId),
    items,
  }
}
