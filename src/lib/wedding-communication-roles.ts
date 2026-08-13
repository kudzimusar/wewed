import 'server-only'

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  defaultConversationTypeForRoles,
  type CommunicationActorRole,
  type CommunicationConversationType,
} from '@/lib/communications-policy'
import type { CommunicationActor } from '@/lib/communications'

type WeddingMembershipRole = 'owner' | 'planner' | 'coordinator' | 'viewer'

interface WeddingRoleRecord {
  userId: string
  email: string
  personalName: string
  globalRole: CommunicationActorRole
  membershipRole: WeddingMembershipRole | null
  effectiveRole: CommunicationActorRole
  sameCouple: boolean
}

interface CommunicationContactLike {
  id: string
  name: string
  email: string
  role: CommunicationActorRole
  defaultType: CommunicationConversationType
  context: 'wedding' | 'wewed'
}

interface ConversationParticipantLike {
  userId: string
  name: string
  email: string
  role: string
}

interface CommunicationConversationLike {
  id: string
  kind: 'DIRECT' | 'GROUP'
  type: CommunicationConversationType
  weddingId: string | null
  lastMessageSenderName: string | null
  participants: ConversationParticipantLike[]
  [key: string]: unknown
}

interface CommunicationMessageLike {
  senderUserId: string | null
  senderName: string | null
  senderRole: string | null
  [key: string]: unknown
}

function isCommunicationActorRole(value: string): value is CommunicationActorRole {
  return ['admin', 'couple', 'planner', 'vendor'].includes(value)
}

export function effectiveWeddingCommunicationRole(input: {
  globalRole: CommunicationActorRole
  membershipRole?: WeddingMembershipRole | null
  sameCouple?: boolean
}): CommunicationActorRole {
  if (input.globalRole === 'admin' || input.globalRole === 'vendor') {
    return input.globalRole
  }
  if (input.membershipRole === 'owner' || input.sameCouple) return 'couple'
  if (input.membershipRole === 'planner' || input.membershipRole === 'coordinator') {
    return 'planner'
  }
  return input.globalRole
}

async function loadWeddingRoleRecords(
  weddingId: string,
  userIds: string[],
): Promise<Map<string, WeddingRoleRecord>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueUserIds.length === 0) return new Map()

  const [wedding, users, memberships] = await Promise.all([
    db.wedding.findUnique({
      where: { id: weddingId },
      select: { coupleId: true },
    }),
    db.user.findMany({
      where: { id: { in: uniqueUserIds }, isActive: true },
      select: { id: true, email: true, name: true, role: true, coupleId: true },
    }),
    db.weddingMembership.findMany({
      where: {
        weddingId,
        userId: { in: uniqueUserIds },
        status: 'active',
      },
      select: { userId: true, role: true },
    }),
  ])

  if (!wedding) return new Map()
  const membershipByUserId = new Map(
    memberships.map((membership) => [
      membership.userId,
      membership.role as WeddingMembershipRole,
    ]),
  )

  const records = new Map<string, WeddingRoleRecord>()
  for (const user of users) {
    if (!isCommunicationActorRole(user.role)) continue
    const membershipRole = membershipByUserId.get(user.id) ?? null
    const sameCouple = Boolean(user.coupleId && user.coupleId === wedding.coupleId)
    records.set(user.id, {
      userId: user.id,
      email: user.email,
      personalName: user.name?.trim() || user.email,
      globalRole: user.role,
      membershipRole,
      effectiveRole: effectiveWeddingCommunicationRole({
        globalRole: user.role,
        membershipRole,
        sameCouple,
      }),
      sameCouple,
    })
  }
  return records
}

function recordHasWeddingCoupleAuthority(record: WeddingRoleRecord | undefined): boolean {
  return Boolean(
    record
    && record.effectiveRole === 'couple'
    && (record.membershipRole === 'owner' || record.sameCouple),
  )
}

export async function normalizeWeddingCommunicationContacts(
  actor: CommunicationActor,
  contacts: CommunicationContactLike[],
): Promise<CommunicationContactLike[]> {
  if (!actor.activeWeddingId || contacts.length === 0) return contacts

  const weddingContacts = contacts.filter((contact) => contact.context === 'wedding')
  if (weddingContacts.length === 0) return contacts

  const records = await loadWeddingRoleRecords(actor.activeWeddingId, [
    actor.userId,
    ...weddingContacts.map((contact) => contact.id),
  ])
  const actorRole = records.get(actor.userId)?.effectiveRole ?? actor.role

  return contacts.map((contact) => {
    if (contact.context !== 'wedding') return contact
    const target = records.get(contact.id)
    if (!target) return contact
    return {
      ...contact,
      name: target.effectiveRole === 'planner' ? contact.name : target.personalName,
      role: target.effectiveRole,
      defaultType: defaultConversationTypeForRoles(actorRole, target.effectiveRole),
    }
  })
}

async function loadLastMessageSenderIds(conversationIds: string[]) {
  if (conversationIds.length === 0) return new Map<string, string | null>()
  const rows = await db.$queryRaw<Array<{
    conversationId: string
    senderUserId: string | null
  }>>(Prisma.sql`
    SELECT DISTINCT ON (message."conversationId")
      message."conversationId" AS "conversationId",
      message."senderUserId" AS "senderUserId"
    FROM wewed_communications."CommunicationMessage" message
    WHERE message."conversationId" IN (${Prisma.join(conversationIds)})
      AND message."deletedAt" IS NULL
      AND message."visibility" = 'PARTICIPANTS'
    ORDER BY message."conversationId", message."createdAt" DESC, message."id" DESC
  `)
  return new Map(rows.map((row) => [row.conversationId, row.senderUserId]))
}

export async function normalizeWeddingCommunicationConversations<T extends CommunicationConversationLike>(
  conversations: T[],
): Promise<T[]> {
  const weddingConversations = conversations.filter((conversation) => conversation.weddingId)
  if (weddingConversations.length === 0) return conversations

  const byWedding = new Map<string, T[]>()
  for (const conversation of weddingConversations) {
    const weddingId = conversation.weddingId
    if (!weddingId) continue
    const current = byWedding.get(weddingId) ?? []
    current.push(conversation)
    byWedding.set(weddingId, current)
  }

  const roleMaps = new Map<string, Map<string, WeddingRoleRecord>>()
  await Promise.all(Array.from(byWedding.entries()).map(async ([weddingId, rows]) => {
    const userIds = rows.flatMap((row) => row.participants.map((participant) => participant.userId))
    roleMaps.set(weddingId, await loadWeddingRoleRecords(weddingId, userIds))
  }))
  const lastSenders = await loadLastMessageSenderIds(weddingConversations.map((row) => row.id))

  return conversations.map((conversation) => {
    const weddingId = conversation.weddingId
    if (!weddingId) return conversation
    const roles = roleMaps.get(weddingId)
    if (!roles) return conversation

    const participants = conversation.participants.map((participant) => {
      const record = roles.get(participant.userId)
      if (!record) return participant
      return {
        ...participant,
        name: record.effectiveRole === 'planner' ? participant.name : record.personalName,
        email: record.email,
        role: record.effectiveRole,
      }
    })
    const coupleDirect =
      conversation.kind === 'DIRECT'
      && participants.length === 2
      && participants.every((participant) => participant.role === 'couple')

    const lastSenderId = lastSenders.get(conversation.id) ?? null
    const lastSender = lastSenderId ? roles.get(lastSenderId) : null
    const lastMessageSenderName = lastSender && lastSender.effectiveRole !== 'planner'
      ? lastSender.personalName
      : conversation.lastMessageSenderName

    return {
      ...conversation,
      type: coupleDirect && conversation.type === 'PLANNER_CLIENT'
        ? 'DIRECT'
        : conversation.type,
      participants,
      lastMessageSenderName,
    }
  })
}

export async function normalizeWeddingCommunicationMessages<T extends CommunicationMessageLike>(
  conversationId: string,
  messages: T[],
): Promise<T[]> {
  if (messages.length === 0) return messages
  const conversation = await db.$queryRaw<Array<{ weddingId: string | null }>>(Prisma.sql`
    SELECT "weddingId" AS "weddingId"
    FROM wewed_communications."CommunicationConversation"
    WHERE "id" = ${conversationId}
    LIMIT 1
  `)
  const weddingId = conversation[0]?.weddingId ?? null
  if (!weddingId) return messages

  const senderIds = Array.from(new Set(messages.flatMap((message) =>
    message.senderUserId ? [message.senderUserId] : [],
  )))
  const roles = await loadWeddingRoleRecords(weddingId, senderIds)

  return messages.map((message) => {
    if (!message.senderUserId) return message
    const sender = roles.get(message.senderUserId)
    if (!sender) return message
    return {
      ...message,
      senderName: sender.effectiveRole === 'planner' ? message.senderName : sender.personalName,
      senderRole: sender.effectiveRole,
    }
  })
}

async function reclassifyExistingCoupleDirectThread(input: {
  actorUserId: string
  targetUserId: string
  weddingId: string
}) {
  const stale = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT c."id"
    FROM wewed_communications."CommunicationConversation" c
    WHERE c."kind" = 'DIRECT'
      AND c."type" = 'PLANNER_CLIENT'
      AND c."status" = 'OPEN'
      AND c."weddingId" = ${input.weddingId}
      AND EXISTS (
        SELECT 1 FROM wewed_communications."CommunicationParticipant" p
        WHERE p."conversationId" = c."id"
          AND p."userId" = ${input.actorUserId}
          AND p."leftAt" IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM wewed_communications."CommunicationParticipant" p
        WHERE p."conversationId" = c."id"
          AND p."userId" = ${input.targetUserId}
          AND p."leftAt" IS NULL
      )
      AND (
        SELECT COUNT(*) FROM wewed_communications."CommunicationParticipant" p
        WHERE p."conversationId" = c."id" AND p."leftAt" IS NULL
      ) = 2
  `)
  if (stale.length === 0) return

  const now = new Date()
  await db.$transaction(async (tx) => {
    for (const conversation of stale) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE wewed_communications."CommunicationConversation"
        SET "type" = 'DIRECT', "updatedAt" = ${now}
        WHERE "id" = ${conversation.id}
          AND "type" = 'PLANNER_CLIENT'
      `)
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO wewed_communications."CommunicationEvent"
          ("id", "conversationId", "actorUserId", "eventType", "metadata")
        VALUES (
          ${randomUUID()}, ${conversation.id}, ${input.actorUserId},
          'conversation_reclassified',
          ${JSON.stringify({
            from: 'PLANNER_CLIENT',
            to: 'DIRECT',
            reason: 'shared_wedding_couple_authority',
          })}::jsonb
        )
      `)
    }
  })
}

export async function prepareWeddingScopedConversationCreation(
  actor: CommunicationActor,
  input: Record<string, unknown>,
): Promise<{ actor: CommunicationActor; input: Record<string, unknown> }> {
  const participantIds = Array.isArray(input.participantIds)
    ? input.participantIds.filter((value): value is string => typeof value === 'string')
    : []
  if (!actor.activeWeddingId || participantIds.length !== 1) {
    return { actor, input }
  }

  const targetUserId = participantIds[0]
  const records = await loadWeddingRoleRecords(actor.activeWeddingId, [actor.userId, targetUserId])
  const actorRecord = records.get(actor.userId)
  const targetRecord = records.get(targetUserId)

  if (!recordHasWeddingCoupleAuthority(actorRecord) || !recordHasWeddingCoupleAuthority(targetRecord)) {
    return { actor, input }
  }

  await reclassifyExistingCoupleDirectThread({
    actorUserId: actor.userId,
    targetUserId,
    weddingId: actor.activeWeddingId,
  })

  return {
    actor: { ...actor, role: 'couple' },
    input: { ...input, type: 'DIRECT', weddingId: actor.activeWeddingId },
  }
}
