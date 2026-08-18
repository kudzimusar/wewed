import 'server-only'

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { countLegacyWeddingNotebookAttachments } from '@/lib/notebook/vault-backfill'

export async function getWeddingVaultStatus(weddingId: string) {
  const [objectRows, communicationRows, notebookRows, legacyNotebookAttachments] = await Promise.all([
    db.$queryRaw<Array<{
      total: bigint | number
      available: bigint | number
      quarantined: bigint | number
      legalHolds: bigint | number
      archived: bigint | number
    }>>(Prisma.sql`
      SELECT
        count(*) AS total,
        count(*) FILTER (
          WHERE "deletedAt" IS NULL
            AND "storageState" = 'stored_private'
            AND "scanState" = 'content_validated'
        ) AS available,
        count(*) FILTER (
          WHERE "deletedAt" IS NULL
            AND ("storageState" = 'quarantined' OR "scanState" = 'external_scan_required')
        ) AS quarantined,
        count(*) FILTER (WHERE "deletedAt" IS NULL AND "legalHold" = true) AS "legalHolds",
        count(*) FILTER (WHERE "deletedAt" IS NULL AND "archivedAt" IS NOT NULL) AS archived
      FROM public."VaultObject"
      WHERE "weddingId" = ${weddingId}
    `),
    db.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
      SELECT count(*) AS count
      FROM wewed_communications."CommunicationAttachment"
      WHERE "weddingId" = ${weddingId}
    `),
    db.$queryRaw<Array<{ total: bigint | number; vaultBacked: bigint | number; quarantined: bigint | number }>>(Prisma.sql`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE a."vaultObjectId" IS NOT NULL) AS "vaultBacked",
        count(*) FILTER (WHERE a.status = 'QUARANTINED') AS quarantined
      FROM wewed_notebook."NotebookAttachment" a
      JOIN wewed_notebook."NotebookNote" n ON n.id = a."noteId"
      WHERE n."weddingId" = ${weddingId}
        AND a."deletedAt" IS NULL
        AND n."deletedAt" IS NULL
    `),
    countLegacyWeddingNotebookAttachments(weddingId),
  ])

  const objects = objectRows[0]
  const notebook = notebookRows[0]
  return {
    weddingId,
    objects: {
      total: Number(objects?.total ?? 0),
      available: Number(objects?.available ?? 0),
      quarantined: Number(objects?.quarantined ?? 0),
      legalHolds: Number(objects?.legalHolds ?? 0),
      archived: Number(objects?.archived ?? 0),
    },
    communications: {
      attachments: Number(communicationRows[0]?.count ?? 0),
    },
    notebook: {
      attachments: Number(notebook?.total ?? 0),
      vaultBacked: Number(notebook?.vaultBacked ?? 0),
      quarantined: Number(notebook?.quarantined ?? 0),
      legacyEligibleForBackfill: legacyNotebookAttachments,
    },
  }
}
