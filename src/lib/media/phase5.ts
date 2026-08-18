import 'server-only'

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import sharp from 'sharp'
import { db } from '@/lib/db'
import {
  createVaultLink,
  prepareVaultUpload,
  registerPreparedVaultObject,
  removePreparedVaultUpload,
  type PreparedVaultUpload,
} from '@/lib/vault/core'

export type MediaPublicationState = 'PRIVATE' | 'PUBLISHED' | 'UNPUBLISHED'
export type MediaPrivacyState = 'PRIVATE' | 'WEDDING_MEMBERS' | 'INVITED_GUESTS' | 'PUBLIC'
export type MediaSourceType = 'COUPLE' | 'GUEST' | 'PLANNER' | 'VENDOR' | 'SYSTEM' | 'LEGACY'
export type WeddingArchiveState = 'ACTIVE_PLANNING' | 'LIVE_EVENT' | 'POST_WEDDING' | 'ARCHIVED'

export class Phase5MediaError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 500 = 400,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'Phase5MediaError'
  }
}

type ManagedMediaRow = {
  id: string
  weddingId: string
  mediaItemId: string
  originalVaultObjectId: string | null
  provenanceState: 'VAULT_MANAGED' | 'LEGACY_EXTERNAL' | 'BACKFILL_PENDING' | 'BACKFILL_FAILED'
  sourceType: MediaSourceType
  sourceActorId: string | null
  sourceUrl: string | null
  publicationState: MediaPublicationState
  privacyState: MediaPrivacyState
  rightsState: string
  moderationState: string
  archiveState: 'ACTIVE' | 'ARCHIVED'
  archivedAt: Date | null
}

type ManagedContentRow = {
  weddingId: string
  mediaItemId: string
  publicationState: MediaPublicationState
  privacyState: MediaPrivacyState
  archiveState: 'ACTIVE' | 'ARCHIVED'
  objectKey: string
  filename: string
  storageState: string
  scanState: string
  deletedAt: Date | null
}

type ArchiveRow = {
  weddingId: string
  lifecycleState: WeddingArchiveState
  retentionPolicy: string
  retentionUntil: Date | null
  exportEnabled: boolean
  archivedAt: Date | null
  updatedAt: Date
}

const ARCHIVE_ORDER: WeddingArchiveState[] = [
  'ACTIVE_PLANNING',
  'LIVE_EVENT',
  'POST_WEDDING',
  'ARCHIVED',
]

function cleanCaption(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.trim().slice(0, 500) || null
}

function controlledMediaUrl(mediaItemId: string, variant?: 'thumbnail'): string {
  const suffix = variant ? `?variant=${variant}` : ''
  return `/api/media/${encodeURIComponent(mediaItemId)}/content${suffix}`
}

async function createImageThumbnail(file: File): Promise<{ file: File; width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return null
  const input = Buffer.from(await file.arrayBuffer())
  const output = await sharp(input)
    .rotate()
    .resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true })
  const derivativeFile = new File(
    [new Uint8Array(output.data)],
    `${file.name.replace(/\.[^.]+$/, '') || 'wedding-media'}-thumbnail.webp`,
    { type: 'image/webp' },
  )
  return {
    file: derivativeFile,
    width: output.info.width,
    height: output.info.height,
  }
}

export async function ingestWeddingMedia(input: {
  weddingId: string
  actorId?: string | null
  uploaderId?: string | null
  sourceType: Exclude<MediaSourceType, 'LEGACY'>
  file: File
  caption?: unknown
  moment?: string | null
}) {
  const mediaItemId = `media-${randomUUID()}`
  const mediaAssetId = `media-asset-${randomUUID()}`
  let original: PreparedVaultUpload | null = null
  let derivative: PreparedVaultUpload | null = null

  try {
    original = await prepareVaultUpload({
      file: input.file,
      weddingId: input.weddingId,
      actorId: input.actorId ?? null,
      source: 'wedding_media_original',
      category: 'wedding_media',
      metadata: { mediaItemId, sourceType: input.sourceType },
    })

    const thumbnail = await createImageThumbnail(input.file)
    if (thumbnail) {
      derivative = await prepareVaultUpload({
        file: thumbnail.file,
        weddingId: input.weddingId,
        actorId: input.actorId ?? null,
        source: 'wedding_media_derivative',
        category: 'wedding_media_thumbnail',
        metadata: { mediaItemId, derivativeType: 'THUMBNAIL' },
      })
    }

    const media = await db.$transaction(async (tx) => {
      await registerPreparedVaultObject(original!, tx)
      const created = await tx.mediaItem.create({
        data: {
          id: mediaItemId,
          type: input.file.type.startsWith('video/') ? 'video' : 'photo',
          url: controlledMediaUrl(mediaItemId),
          thumbnailUrl: derivative ? controlledMediaUrl(mediaItemId, 'thumbnail') : null,
          caption: cleanCaption(input.caption),
          moment: input.moment || 'candid',
          isCurated: false,
          isHero: false,
          uploaderId: input.uploaderId ?? null,
          uploadedAt: new Date(),
          weddingId: input.weddingId,
        },
      })

      await createVaultLink({
        vaultObjectId: original!.id,
        weddingId: input.weddingId,
        entityType: 'media_item',
        entityId: mediaItemId,
        linkRole: 'media_original',
        actorId: input.actorId ?? null,
        tx,
      })

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO wewed_media."MediaAsset" (
          "id", "weddingId", "mediaItemId", "originalVaultObjectId", "provenanceState",
          "sourceType", "sourceActorId", "ingestedAt", "publicationState", "privacyState",
          "rightsState", "moderationState"
        ) VALUES (
          ${mediaAssetId}, ${input.weddingId}, ${mediaItemId}, ${original!.id}, 'VAULT_MANAGED',
          ${input.sourceType}, ${input.actorId ?? null}, CURRENT_TIMESTAMP, 'PRIVATE',
          ${input.sourceType === 'GUEST' ? 'INVITED_GUESTS' : 'WEDDING_MEMBERS'},
          ${input.sourceType === 'GUEST' ? 'UNKNOWN' : 'DECLARED_AUTHORIZED'},
          ${input.sourceType === 'GUEST' ? 'PENDING' : 'NOT_REQUIRED'}
        )
      `)

      if (derivative && thumbnail) {
        await registerPreparedVaultObject(derivative, tx)
        await createVaultLink({
          vaultObjectId: derivative.id,
          weddingId: input.weddingId,
          entityType: 'media_item',
          entityId: mediaItemId,
          linkRole: 'media_thumbnail',
          actorId: input.actorId ?? null,
          tx,
        })
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO wewed_media."MediaDerivative" (
            "id", "mediaAssetId", "weddingId", "vaultObjectId", "derivativeType", "status", "width", "height"
          ) VALUES (
            ${`media-derivative-${randomUUID()}`}, ${mediaAssetId}, ${input.weddingId}, ${derivative.id},
            'THUMBNAIL', 'READY', ${thumbnail.width}, ${thumbnail.height}
          )
        `)
      }

      return created
    })

    return {
      ...media,
      uploadedAt: media.uploadedAt?.toISOString() ?? null,
      governance: {
        provenanceState: 'VAULT_MANAGED' as const,
        publicationState: 'PRIVATE' as const,
        privacyState: input.sourceType === 'GUEST' ? 'INVITED_GUESTS' as const : 'WEDDING_MEMBERS' as const,
        originalVaultObjectId: original.id,
        thumbnailReady: Boolean(derivative),
      },
    }
  } catch (error) {
    if (derivative) await removePreparedVaultUpload(derivative)
    if (original) await removePreparedVaultUpload(original)
    throw error
  }
}

export async function getMediaGovernance(mediaItemId: string): Promise<ManagedMediaRow | null> {
  const rows = await db.$queryRaw<ManagedMediaRow[]>(Prisma.sql`
    SELECT "id", "weddingId", "mediaItemId", "originalVaultObjectId", "provenanceState",
           "sourceType", "sourceActorId", "sourceUrl", "publicationState", "privacyState",
           "rightsState", "moderationState", "archiveState", "archivedAt"
    FROM wewed_media."MediaAsset"
    WHERE "mediaItemId"=${mediaItemId}
    LIMIT 1
  `)
  return rows[0] ?? null
}

export async function getWeddingMediaGovernance(weddingId: string): Promise<Map<string, ManagedMediaRow>> {
  const rows = await db.$queryRaw<ManagedMediaRow[]>(Prisma.sql`
    SELECT "id", "weddingId", "mediaItemId", "originalVaultObjectId", "provenanceState",
           "sourceType", "sourceActorId", "sourceUrl", "publicationState", "privacyState",
           "rightsState", "moderationState", "archiveState", "archivedAt"
    FROM wewed_media."MediaAsset"
    WHERE "weddingId"=${weddingId}
  `)
  return new Map(rows.map((row) => [row.mediaItemId, row]))
}

export function mediaGovernanceAllowsAccess(
  governance: ManagedMediaRow | null,
  accessKind: 'public' | 'couple_owner' | 'wedding_member' | 'invited_guest' | null,
): boolean {
  if (!governance) return true // Legacy compatibility: preserve the classic wedding presentation until backfilled.
  if (governance.archiveState === 'ARCHIVED') return false
  if (accessKind === 'couple_owner' || accessKind === 'wedding_member') return true
  if (accessKind === 'invited_guest') {
    return governance.privacyState === 'INVITED_GUESTS' || governance.privacyState === 'PUBLIC'
  }
  return governance.publicationState === 'PUBLISHED' && governance.privacyState === 'PUBLIC'
}

export async function resolveManagedMediaContent(input: {
  mediaItemId: string
  variant?: 'thumbnail' | null
}): Promise<ManagedContentRow | null> {
  const derivativeJoin = input.variant === 'thumbnail'
    ? Prisma.sql`JOIN wewed_media."MediaDerivative" d ON d."mediaAssetId"=a."id" AND d."derivativeType"='THUMBNAIL' AND d."status"='READY' JOIN public."VaultObject" v ON v."id"=d."vaultObjectId" AND v."weddingId"=a."weddingId"`
    : Prisma.sql`JOIN public."VaultObject" v ON v."id"=a."originalVaultObjectId" AND v."weddingId"=a."weddingId"`

  const rows = await db.$queryRaw<ManagedContentRow[]>(Prisma.sql`
    SELECT a."weddingId", a."mediaItemId", a."publicationState", a."privacyState", a."archiveState",
           v."objectKey", v."originalFilename" AS "filename", v."storageState", v."scanState", v."deletedAt"
    FROM wewed_media."MediaAsset" a
    ${derivativeJoin}
    WHERE a."mediaItemId"=${input.mediaItemId}
    LIMIT 1
  `)
  return rows[0] ?? null
}

export async function updateManagedMediaPresentation(input: {
  mediaItemId: string
  weddingId: string
  actorId: string
  publicationState?: MediaPublicationState
  privacyState?: MediaPrivacyState
  rightsState?: 'UNKNOWN' | 'DECLARED_AUTHORIZED' | 'LICENSED' | 'CONSENTED' | 'RESTRICTED'
  moderationState?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED'
}) {
  const current = await getMediaGovernance(input.mediaItemId)
  if (!current || current.weddingId !== input.weddingId) throw new Phase5MediaError('Managed media was not found.', 404)
  const publication = input.publicationState ?? current.publicationState
  const privacy = input.privacyState ?? current.privacyState
  const rights = input.rightsState ?? current.rightsState
  const moderation = input.moderationState ?? current.moderationState

  await db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_media."MediaAsset"
      SET "publicationState"=${publication}, "privacyState"=${privacy}, "rightsState"=${rights}, "moderationState"=${moderation}
      WHERE "mediaItemId"=${input.mediaItemId} AND "weddingId"=${input.weddingId}
    `)
    if (input.publicationState) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO wewed_media."ArchiveEvent" ("id", "weddingId", "eventType", "actorId", "metadata")
        VALUES (${`archive-event-${randomUUID()}`}, ${input.weddingId},
          ${input.publicationState === 'PUBLISHED' ? 'MEDIA_PUBLISHED' : 'MEDIA_UNPUBLISHED'},
          ${input.actorId}, ${JSON.stringify({ mediaItemId: input.mediaItemId })}::jsonb)
      `)
    }
  })

  return getMediaGovernance(input.mediaItemId)
}

export async function archiveMediaItem(input: { mediaItemId: string; weddingId: string; actorId: string }) {
  const media = await db.mediaItem.findUnique({ where: { id: input.mediaItemId } })
  if (!media || media.weddingId !== input.weddingId) throw new Phase5MediaError('Media was not found.', 404)
  const current = await getMediaGovernance(input.mediaItemId)

  await db.$transaction(async (tx) => {
    if (current) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE wewed_media."MediaAsset"
        SET "publicationState"='UNPUBLISHED', "privacyState"='PRIVATE', "archiveState"='ARCHIVED', "archivedAt"=CURRENT_TIMESTAMP
        WHERE "mediaItemId"=${input.mediaItemId} AND "weddingId"=${input.weddingId}
      `)
      if (current.originalVaultObjectId) {
        await tx.vaultObject.update({
          where: { id: current.originalVaultObjectId },
          data: { archivedAt: new Date() },
        })
        const derivatives = await tx.$queryRaw<Array<{ vaultObjectId: string }>>(Prisma.sql`
          SELECT d."vaultObjectId" FROM wewed_media."MediaDerivative" d WHERE d."mediaAssetId"=${current.id}
        `)
        for (const derivative of derivatives) {
          await tx.vaultObject.update({ where: { id: derivative.vaultObjectId }, data: { archivedAt: new Date() } })
        }
      }
    } else {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO wewed_media."MediaAsset" (
          "id", "weddingId", "mediaItemId", "provenanceState", "sourceType", "sourceUrl",
          "publicationState", "privacyState", "rightsState", "moderationState", "archiveState", "archivedAt"
        ) VALUES (
          ${`media-asset-${randomUUID()}`}, ${input.weddingId}, ${input.mediaItemId}, 'LEGACY_EXTERNAL', 'LEGACY', ${media.url},
          'UNPUBLISHED', 'PRIVATE', 'UNKNOWN', 'NOT_REQUIRED', 'ARCHIVED', CURRENT_TIMESTAMP
        )
      `)
    }
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO wewed_media."ArchiveEvent" ("id", "weddingId", "eventType", "actorId", "metadata")
      VALUES (${`archive-event-${randomUUID()}`}, ${input.weddingId}, 'MEDIA_ARCHIVED', ${input.actorId}, ${JSON.stringify({ mediaItemId: input.mediaItemId })}::jsonb)
    `)
  })
  return { mediaItemId: input.mediaItemId, archived: true, destructiveDelete: false }
}

async function ensureWeddingArchive(weddingId: string): Promise<void> {
  const wedding = await db.wedding.findUnique({ where: { id: weddingId }, select: { lifecycle: true } })
  if (!wedding) throw new Phase5MediaError('Wedding was not found.', 404)
  const initial: WeddingArchiveState = wedding.lifecycle === 'during'
    ? 'LIVE_EVENT'
    : wedding.lifecycle === 'after'
      ? 'POST_WEDDING'
      : 'ACTIVE_PLANNING'
  await db.$executeRaw(Prisma.sql`
    INSERT INTO wewed_media."WeddingArchive" ("weddingId", "lifecycleState")
    VALUES (${weddingId}, ${initial})
    ON CONFLICT ("weddingId") DO NOTHING
  `)
}

export async function getWeddingArchiveSummary(weddingId: string) {
  await ensureWeddingArchive(weddingId)
  const archiveRows = await db.$queryRaw<ArchiveRow[]>(Prisma.sql`
    SELECT "weddingId", "lifecycleState", "retentionPolicy", "retentionUntil", "exportEnabled", "archivedAt", "updatedAt"
    FROM wewed_media."WeddingArchive" WHERE "weddingId"=${weddingId}
  `)
  const counts = await db.$queryRaw<Array<{
    managed: bigint
    published: bigint
    archived: bigint
    backfillPending: bigint
    held: bigint
  }>>(Prisma.sql`
    SELECT
      (SELECT count(*) FROM wewed_media."MediaAsset" a WHERE a."weddingId"=${weddingId} AND a."provenanceState"='VAULT_MANAGED') AS managed,
      (SELECT count(*) FROM wewed_media."MediaAsset" a WHERE a."weddingId"=${weddingId} AND a."publicationState"='PUBLISHED' AND a."archiveState"='ACTIVE') AS published,
      (SELECT count(*) FROM wewed_media."MediaAsset" a WHERE a."weddingId"=${weddingId} AND a."archiveState"='ARCHIVED') AS archived,
      (SELECT count(*) FROM wewed_media."MediaBackfillRecord" b WHERE b."weddingId"=${weddingId} AND b."status"='DISCOVERED') AS "backfillPending",
      (SELECT count(*) FROM public."VaultObject" v WHERE v."weddingId"=${weddingId} AND v."legalHold"=true AND EXISTS (
        SELECT 1 FROM wewed_media."MediaAsset" a WHERE a."originalVaultObjectId"=v."id"
        UNION ALL SELECT 1 FROM wewed_media."MediaDerivative" d WHERE d."vaultObjectId"=v."id"
      )) AS held
  `)
  const row = archiveRows[0]
  const count = counts[0]
  return {
    ...row,
    retentionUntil: row.retentionUntil?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    counts: {
      managed: Number(count?.managed ?? 0),
      published: Number(count?.published ?? 0),
      archived: Number(count?.archived ?? 0),
      backfillPending: Number(count?.backfillPending ?? 0),
      held: Number(count?.held ?? 0),
    },
  }
}

export async function transitionWeddingArchive(input: {
  weddingId: string
  actorId: string
  targetState: WeddingArchiveState
}) {
  await ensureWeddingArchive(input.weddingId)
  const current = await getWeddingArchiveSummary(input.weddingId)
  if (!ARCHIVE_ORDER.includes(input.targetState)) throw new Phase5MediaError('Unsupported archive lifecycle state.', 400, 'targetState')
  const currentIndex = ARCHIVE_ORDER.indexOf(current.lifecycleState)
  const targetIndex = ARCHIVE_ORDER.indexOf(input.targetState)
  if (targetIndex !== currentIndex + 1) {
    throw new Phase5MediaError('Archive lifecycle moves forward one governed state at a time.', 409, 'targetState')
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_media."WeddingArchive" SET "lifecycleState"=${input.targetState}
      WHERE "weddingId"=${input.weddingId}
    `)
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO wewed_media."ArchiveEvent" ("id", "weddingId", "eventType", "actorId", "fromState", "toState")
      VALUES (${`archive-event-${randomUUID()}`}, ${input.weddingId}, 'LIFECYCLE_TRANSITION', ${input.actorId}, ${current.lifecycleState}, ${input.targetState})
    `)
  })
  return getWeddingArchiveSummary(input.weddingId)
}

export async function buildCoupleExportManifest(input: { weddingId: string; actorId: string }) {
  const wedding = await db.wedding.findUnique({
    where: { id: input.weddingId },
    select: { id: true, slug: true, title: true, date: true },
  })
  if (!wedding) throw new Phase5MediaError('Wedding was not found.', 404)
  await ensureWeddingArchive(input.weddingId)
  const archive = await getWeddingArchiveSummary(input.weddingId)
  if (!archive.exportEnabled) throw new Phase5MediaError('Wedding archive export is disabled by policy.', 403)

  const media = await db.mediaItem.findMany({
    where: { weddingId: input.weddingId },
    orderBy: [{ uploadedAt: 'asc' }, { createdAt: 'asc' }],
  })
  const governance = await getWeddingMediaGovernance(input.weddingId)

  await db.$executeRaw(Prisma.sql`
    INSERT INTO wewed_media."ArchiveEvent" ("id", "weddingId", "eventType", "actorId", "metadata")
    VALUES (${`archive-event-${randomUUID()}`}, ${input.weddingId}, 'EXPORT_REQUESTED', ${input.actorId}, ${JSON.stringify({ itemCount: media.length })}::jsonb)
  `)

  return {
    format: 'wewed-wedding-media-manifest-v1',
    generatedAt: new Date().toISOString(),
    wedding: { id: wedding.id, slug: wedding.slug, title: wedding.title, date: wedding.date.toISOString() },
    archive: {
      lifecycleState: archive.lifecycleState,
      retentionPolicy: archive.retentionPolicy,
      retentionUntil: archive.retentionUntil,
    },
    media: media.map((item) => {
      const governed = governance.get(item.id)
      return {
        id: item.id,
        type: item.type,
        caption: item.caption,
        moment: item.moment,
        uploadedAt: item.uploadedAt?.toISOString() ?? null,
        provenanceState: governed?.provenanceState ?? 'LEGACY_EXTERNAL',
        archiveState: governed?.archiveState ?? 'ACTIVE',
        downloadPath: governed?.provenanceState === 'VAULT_MANAGED' ? controlledMediaUrl(item.id) : null,
        legacySourceUrl: governed?.provenanceState === 'VAULT_MANAGED' ? null : item.url,
      }
    }),
  }
}
