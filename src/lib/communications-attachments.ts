import 'server-only'

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  CommunicationError,
  type CommunicationActor,
} from '@/lib/communications'
import {
  communicationMessagePolicy,
  normalizeCommunicationBody,
} from '@/lib/communications-policy'
import {
  createVaultLink,
  prepareVaultUpload,
  registerPreparedVaultObject,
  removePreparedVaultUpload,
  signedVaultDownload,
  vaultObjectIsDistributable,
  type PreparedVaultUpload,
} from '@/lib/vault/core'

const MAX_ATTACHMENTS_PER_MESSAGE = 5

type ConversationAttachmentContext = {
  conversationId: string
  type: string
  status: 'OPEN' | 'ARCHIVED' | 'CLOSED'
  weddingId: string | null
}

type AttachmentRow = {
  id: string
  messageId: string
  conversationId: string
  vaultObjectId: string
  weddingId: string
  caption: string | null
  position: number
  originalFilename: string
  displayName: string
  mimeType: string
  byteSize: bigint | number
  storageState: string
  scanState: string
  createdAt: Date
}

export type CommunicationAttachment = {
  id: string
  messageId: string
  vaultObjectId: string
  filename: string
  displayName: string
  mimeType: string
  byteSize: number
  caption: string | null
  position: number
  state: 'available' | 'quarantined'
  createdAt: string
}

async function requireAttachmentContext(
  actor: CommunicationActor,
  conversationId: string,
  tx: Prisma.TransactionClient | typeof db = db,
): Promise<ConversationAttachmentContext> {
  const rows = await tx.$queryRaw<ConversationAttachmentContext[]>(Prisma.sql`
    SELECT
      c."id" AS "conversationId",
      c."type",
      c."status",
      c."weddingId"
    FROM wewed_communications."CommunicationParticipant" p
    JOIN wewed_communications."CommunicationConversation" c
      ON c."id" = p."conversationId"
    WHERE p."conversationId" = ${conversationId}
      AND p."userId" = ${actor.userId}
      AND p."leftAt" IS NULL
    LIMIT 1
  `)
  const context = rows[0]
  if (!context) throw new CommunicationError('Conversation not found.', 404)
  if (!context.weddingId) {
    throw new CommunicationError(
      'Attachments currently require a wedding-linked conversation so the file can be governed in the wedding Vault.',
      400,
    )
  }
  return context
}

function messageBodyForAttachments(body: unknown, files: File[]): string {
  const normalized = normalizeCommunicationBody(body)
  if (normalized) return normalized
  if (files.length === 1) return `Shared ${files[0].name}`.slice(0, 4000)
  return `Shared ${files.length} files`
}

function cleanCaption(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const caption = value.trim()
  if (!caption) return null
  if (caption.length > 500) throw new CommunicationError('Attachment captions must be 500 characters or fewer.')
  return caption
}

function asAttachment(row: AttachmentRow): CommunicationAttachment {
  const available = vaultObjectIsDistributable({
    storageState: row.storageState,
    scanState: row.scanState,
  })
  return {
    id: row.id,
    messageId: row.messageId,
    vaultObjectId: row.vaultObjectId,
    filename: row.originalFilename,
    displayName: row.displayName,
    mimeType: row.mimeType,
    byteSize: typeof row.byteSize === 'bigint' ? Number(row.byteSize) : row.byteSize,
    caption: row.caption,
    position: row.position,
    state: available ? 'available' : 'quarantined',
    createdAt: row.createdAt.toISOString(),
  }
}

export async function sendCommunicationAttachments(input: {
  actor: CommunicationActor
  conversationId: string
  files: File[]
  body?: unknown
  internalNote?: boolean
  captions?: unknown[]
}): Promise<{ messageId: string; attachments: CommunicationAttachment[] }> {
  const files = input.files.filter((file) => file instanceof File && file.size > 0)
  if (files.length === 0) throw new CommunicationError('Choose at least one file.')
  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new CommunicationError(`Attach at most ${MAX_ATTACHMENTS_PER_MESSAGE} files to one message.`)
  }

  const context = await requireAttachmentContext(input.actor, input.conversationId)
  if (context.status !== 'OPEN') throw new CommunicationError('This conversation is not open for new messages.', 409)
  const policy = communicationMessagePolicy({
    role: input.actor.role,
    internalNote: Boolean(input.internalNote),
  })
  const body = messageBodyForAttachments(input.body, files)
  const captions = Array.from({ length: files.length }, (_, index) => cleanCaption(input.captions?.[index]))
  const prepared: PreparedVaultUpload[] = []

  try {
    for (let index = 0; index < files.length; index += 1) {
      prepared.push(await prepareVaultUpload({
        file: files[index],
        weddingId: context.weddingId!,
        actorId: input.actor.userId,
        source: 'communication_attachment',
        category: 'communications_attachment',
        metadata: {
          conversationId: input.conversationId,
          position: index,
          visibility: policy.visibility,
        },
      }))
    }

    const messageId = randomUUID()
    const now = new Date()
    await db.$transaction(async (tx) => {
      // Re-check membership/state inside the same transaction that establishes the evidence links.
      const txContext = await requireAttachmentContext(input.actor, input.conversationId, tx)
      if (txContext.status !== 'OPEN' || txContext.weddingId !== context.weddingId) {
        throw new CommunicationError('Conversation access changed before the attachment could be sent.', 409)
      }

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO wewed_communications."CommunicationMessage"
          ("id", "conversationId", "senderUserId", "messageType", "visibility", "body", "createdAt", "updatedAt")
        VALUES (
          ${messageId}, ${input.conversationId}, ${input.actor.userId},
          ${policy.messageType}, ${policy.visibility}, ${body}, ${now}, ${now}
        )
      `)

      for (let index = 0; index < prepared.length; index += 1) {
        const object = prepared[index]
        await registerPreparedVaultObject(object, tx)
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO wewed_communications."CommunicationAttachment"
            ("id", "messageId", "conversationId", "vaultObjectId", "weddingId", "caption", "position", "createdByUserId", "createdAt")
          VALUES (
            ${randomUUID()}, ${messageId}, ${input.conversationId}, ${object.id},
            ${context.weddingId}, ${captions[index]}, ${index}, ${input.actor.userId}, ${now}
          )
        `)
        await createVaultLink({
          vaultObjectId: object.id,
          weddingId: context.weddingId!,
          entityType: 'communication_message',
          entityId: messageId,
          linkRole: 'attachment',
          actorId: input.actor.userId,
          tx,
        })
        await createVaultLink({
          vaultObjectId: object.id,
          weddingId: context.weddingId!,
          entityType: 'communication_conversation',
          entityId: input.conversationId,
          linkRole: 'attachment',
          actorId: input.actor.userId,
          tx,
        })
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE wewed_communications."CommunicationConversation"
        SET "lastMessageAt" = ${now}, "updatedAt" = ${now}
        WHERE "id" = ${input.conversationId}
      `)
      await tx.$executeRaw(Prisma.sql`
        UPDATE wewed_communications."CommunicationParticipant"
        SET "lastReadAt" = ${now}, "updatedAt" = ${now}
        WHERE "conversationId" = ${input.conversationId}
          AND "userId" = ${input.actor.userId}
          AND "leftAt" IS NULL
      `)

      const recipients = await tx.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
        SELECT "userId"
        FROM wewed_communications."CommunicationParticipant"
        WHERE "conversationId" = ${input.conversationId}
          AND "userId" <> ${input.actor.userId}
          AND "leftAt" IS NULL
      `)
      for (const recipient of recipients) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO wewed_communications."CommunicationDelivery"
            ("id", "messageId", "recipientUserId", "channel", "status", "provider")
          VALUES (${randomUUID()}, ${messageId}, ${recipient.userId}, 'IN_APP', 'DELIVERED', 'wewed')
          ON CONFLICT ("messageId", "recipientUserId", "channel") DO NOTHING
        `)
      }

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO wewed_communications."CommunicationEvent"
          ("id", "conversationId", "messageId", "actorUserId", "eventType", "metadata")
        VALUES (
          ${randomUUID()}, ${input.conversationId}, ${messageId}, ${input.actor.userId},
          'message_sent',
          ${JSON.stringify({
            messageType: policy.messageType,
            visibility: policy.visibility,
            bodyLength: body.length,
            recipientCount: recipients.length,
            attachmentCount: prepared.length,
            quarantinedCount: prepared.filter((item) => !item.distributable).length,
          })}::jsonb
        )
      `)
    })

    const attachments = await listCommunicationAttachments(input.actor, input.conversationId, [messageId])
    return { messageId, attachments: attachments[messageId] ?? [] }
  } catch (error) {
    await Promise.all(prepared.map((object) => removePreparedVaultUpload(object)))
    throw error
  }
}

export async function listCommunicationAttachments(
  actor: CommunicationActor,
  conversationId: string,
  messageIds?: string[],
): Promise<Record<string, CommunicationAttachment[]>> {
  await requireAttachmentContext(actor, conversationId)
  const staff = actor.role === 'admin'
  const messageFilter = messageIds && messageIds.length > 0
    ? Prisma.sql`AND a."messageId" IN (${Prisma.join(messageIds)})`
    : Prisma.sql``
  const rows = await db.$queryRaw<AttachmentRow[]>(Prisma.sql`
    SELECT
      a."id", a."messageId", a."conversationId", a."vaultObjectId", a."weddingId",
      a."caption", a."position", a."createdAt",
      v."originalFilename", v."displayName", v."mimeType", v."byteSize",
      v."storageState", v."scanState"
    FROM wewed_communications."CommunicationAttachment" a
    JOIN wewed_communications."CommunicationMessage" m ON m."id" = a."messageId"
    JOIN public."VaultObject" v
      ON v."id" = a."vaultObjectId"
      AND v."weddingId" = a."weddingId"
    WHERE a."conversationId" = ${conversationId}
      AND m."deletedAt" IS NULL
      AND (m."visibility" = 'PARTICIPANTS' OR ${staff})
      AND v."deletedAt" IS NULL
      ${messageFilter}
    ORDER BY m."createdAt" ASC, a."position" ASC, a."id" ASC
  `)
  const grouped: Record<string, CommunicationAttachment[]> = {}
  for (const row of rows) {
    ;(grouped[row.messageId] ??= []).push(asAttachment(row))
  }
  return grouped
}

export async function getCommunicationAttachmentDownload(
  actor: CommunicationActor,
  attachmentId: string,
): Promise<{ signedUrl: string; filename: string }> {
  const rows = await db.$queryRaw<Array<AttachmentRow & { visibility: string; objectKey: string; deletedAt: Date | null }>>(Prisma.sql`
    SELECT
      a."id", a."messageId", a."conversationId", a."vaultObjectId", a."weddingId",
      a."caption", a."position", a."createdAt",
      m."visibility",
      v."objectKey", v."originalFilename", v."displayName", v."mimeType", v."byteSize",
      v."storageState", v."scanState", v."deletedAt"
    FROM wewed_communications."CommunicationAttachment" a
    JOIN wewed_communications."CommunicationMessage" m ON m."id" = a."messageId"
    JOIN public."VaultObject" v
      ON v."id" = a."vaultObjectId"
      AND v."weddingId" = a."weddingId"
    WHERE a."id" = ${attachmentId}
      AND m."deletedAt" IS NULL
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) throw new CommunicationError('Attachment not found.', 404)
  await requireAttachmentContext(actor, row.conversationId)
  if (row.visibility === 'STAFF_ONLY' && actor.role !== 'admin') {
    throw new CommunicationError('Attachment not found.', 404)
  }
  const distributable = vaultObjectIsDistributable(row)
  if (!distributable) throw new CommunicationError('This attachment is quarantined and cannot be opened yet.', 423)
  return {
    signedUrl: await signedVaultDownload({
      objectKey: row.objectKey,
      filename: row.originalFilename,
      distributable,
    }),
    filename: row.originalFilename,
  }
}

const PROMOTION_ROLES = new Set([
  'wedding_document',
  'vendor_document',
  'service_engagement_document',
  'invoice',
  'receipt',
  'payment_proof',
  'evidence',
  'couple_media',
])

export async function promoteCommunicationAttachment(input: {
  actor: CommunicationActor
  attachmentId: string
  entityType: string
  entityId: string
  linkRole: string
}): Promise<void> {
  if (!PROMOTION_ROLES.has(input.linkRole)) throw new CommunicationError('Unsupported Vault promotion role.')
  const rows = await db.$queryRaw<Array<{ vaultObjectId: string; weddingId: string; conversationId: string; visibility: string }>>(Prisma.sql`
    SELECT a."vaultObjectId", a."weddingId", a."conversationId", m."visibility"
    FROM wewed_communications."CommunicationAttachment" a
    JOIN wewed_communications."CommunicationMessage" m ON m."id" = a."messageId"
    WHERE a."id" = ${input.attachmentId} AND m."deletedAt" IS NULL
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) throw new CommunicationError('Attachment not found.', 404)
  await requireAttachmentContext(input.actor, row.conversationId)
  if (row.visibility === 'STAFF_ONLY' && input.actor.role !== 'admin') {
    throw new CommunicationError('Attachment not found.', 404)
  }

  // Entity-specific authorization is deliberately narrow in Phase 1.
  if (input.entityType === 'service_engagement') {
    const engagement = await db.serviceEngagement.findFirst({
      where: { id: input.entityId, weddingId: row.weddingId },
      select: { id: true },
    })
    if (!engagement) throw new CommunicationError('Service engagement not found in this wedding.', 404)
  } else if (input.entityType === 'vendor') {
    const vendor = await db.vendor.findFirst({
      where: { id: input.entityId, weddingId: row.weddingId },
      select: { id: true },
    })
    if (!vendor) throw new CommunicationError('Vendor not found in this wedding.', 404)
  } else if (input.entityType !== 'wedding') {
    throw new CommunicationError('This promotion target is not available yet.')
  } else if (input.entityId !== row.weddingId) {
    throw new CommunicationError('Wedding promotion target does not match the attachment wedding.', 403)
  }

  await createVaultLink({
    vaultObjectId: row.vaultObjectId,
    weddingId: row.weddingId,
    entityType: input.entityType,
    entityId: input.entityId,
    linkRole: input.linkRole,
    actorId: input.actor.userId,
  })
}
