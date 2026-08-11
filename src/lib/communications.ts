import 'server-only'

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  isDashboardRole,
  readAppSession,
} from '@/lib/app-session'
import {
  canCreateCommunicationType,
  communicationMessagePolicy,
  defaultConversationTypeForRoles,
  isCommunicationConversationType,
  normalizeCommunicationBody,
  normalizeParticipantIds,
  type CommunicationActorRole,
  type CommunicationConversationType,
} from '@/lib/communications-policy'

export class CommunicationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export interface CommunicationActor {
  userId: string
  email: string
  name: string
  role: CommunicationActorRole
  coupleId: string | null
  activeWeddingId: string
}

interface ConversationRow {
  id: string
  kind: 'DIRECT' | 'GROUP'
  type: CommunicationConversationType
  title: string | null
  weddingId: string | null
  status: 'OPEN' | 'ARCHIVED' | 'CLOSED'
  createdAt: Date
  lastVisibleMessageAt: Date | null
  lastMessageBody: string | null
  lastMessageSenderUserId: string | null
  lastMessageSenderName: string | null
  lastReadAt: Date | null
  unreadCount: bigint | number
  participants: Prisma.JsonValue
}

interface MessageRow {
  id: string
  conversationId: string
  senderUserId: string | null
  senderName: string | null
  senderRole: string | null
  messageType: 'USER' | 'SYSTEM' | 'SUGGESTED' | 'INTERNAL_NOTE'
  visibility: 'PARTICIPANTS' | 'STAFF_ONLY'
  body: string
  replyToMessageId: string | null
  createdAt: Date
  editedAt: Date | null
}

interface MembershipRow {
  conversationId: string
  type: CommunicationConversationType
  status: 'OPEN' | 'ARCHIVED' | 'CLOSED'
  weddingId: string | null
}

interface ReusedConversationRow {
  id: string
}

interface PlannerDirectoryRow {
  userId: string
  email: string
  userName: string | null
  businessName: string
}

export interface CommunicationContact {
  id: string
  name: string
  email: string
  role: CommunicationActorRole
  defaultType: CommunicationConversationType
  context: 'wedding' | 'wewed'
}

export interface CreateCommunicationConversationInput {
  participantIds?: unknown
  type?: unknown
  title?: unknown
  weddingId?: unknown
  initialMessage?: unknown
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const title = value.trim()
  if (!title) return null
  if (title.length > 120) {
    throw new CommunicationError('Conversation title must be 120 characters or fewer.')
  }
  return title
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const result = value.trim()
  return result || null
}

function asCount(value: bigint | number | null | undefined): number {
  if (typeof value === 'bigint') return Number(value)
  return typeof value === 'number' ? value : 0
}

function asParticipantArray(value: Prisma.JsonValue): Array<{
  userId: string
  name: string
  email: string
  role: string
}> {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const item = entry as Record<string, unknown>
    if (
      typeof item.userId !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.email !== 'string' ||
      typeof item.role !== 'string'
    ) return []
    return [{
      userId: item.userId,
      name: item.name,
      email: item.email,
      role: item.role,
    }]
  })
}

async function listRegisteredPlannerDirectory(
  userIds?: string[],
): Promise<PlannerDirectoryRow[]> {
  if (userIds && userIds.length === 0) return []
  const userFilter = userIds
    ? Prisma.sql`AND u."id" IN (${Prisma.join(userIds)})`
    : Prisma.sql``

  return db.$queryRaw<PlannerDirectoryRow[]>(Prisma.sql`
    SELECT DISTINCT ON (u."id")
      u."id" AS "userId",
      u."email",
      u."name" AS "userName",
      ba."name" AS "businessName"
    FROM public."User" u
    JOIN public."BusinessAccountMember" bam
      ON bam."userId" = u."id"
      AND bam."status" = 'active'
    JOIN public."BusinessAccount" ba
      ON ba."id" = bam."businessAccountId"
      AND ba."type" = 'planning_company'
      AND ba."status" = 'active'
      AND ba."onboardingStatus" = 'complete'
    WHERE u."isActive" = true
      AND u."role" = 'planner'
      ${userFilter}
    ORDER BY
      u."id",
      CASE WHEN ba."ownerUserId" = u."id" THEN 0 ELSE 1 END,
      ba."createdAt" ASC,
      ba."id" ASC
  `)
}

function plannerDirectoryMap(rows: PlannerDirectoryRow[]) {
  return new Map(rows.map((row) => [row.userId, row]))
}

export async function requireCommunicationActor(
  request: NextRequest,
): Promise<CommunicationActor> {
  const session = readAppSession(request)
  if (!session) throw new CommunicationError('Authentication required.', 401)

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      coupleId: true,
      isActive: true,
    },
  })

  if (
    !user ||
    !user.isActive ||
    !isDashboardRole(user.role) ||
    user.role !== session.role ||
    user.email.toLowerCase() !== session.email.toLowerCase() ||
    user.coupleId !== session.coupleId
  ) {
    throw new CommunicationError('Authentication required.', 401)
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name?.trim() || user.email,
    role: user.role,
    coupleId: user.coupleId,
    activeWeddingId: session.activeWeddingId,
  }
}

export async function listCommunicationContacts(
  actor: CommunicationActor,
): Promise<CommunicationContact[]> {
  const plannerDirectory = await listRegisteredPlannerDirectory()
  const plannersByUserId = plannerDirectoryMap(plannerDirectory)

  if (actor.role === 'admin') {
    const users = await db.user.findMany({
      where: {
        id: { not: actor.userId },
        isActive: true,
        role: { in: ['admin', 'couple', 'planner'] },
      },
      select: { id: true, email: true, name: true, role: true },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
      take: 250,
    })

    return users.flatMap((user) => {
      if (!isDashboardRole(user.role)) return []
      const plannerIdentity = plannersByUserId.get(user.id)
      return [{
        id: user.id,
        name: plannerIdentity?.businessName.trim() || user.name?.trim() || user.email,
        email: user.email,
        role: user.role,
        defaultType: defaultConversationTypeForRoles(actor.role, user.role),
        context: 'wewed' as const,
      }]
    })
  }

  const wedding = await db.wedding.findUnique({
    where: { id: actor.activeWeddingId },
    select: { id: true, coupleId: true },
  })

  const memberships = wedding
    ? await db.weddingMembership.findMany({
        where: {
          weddingId: wedding.id,
          status: 'active',
          user: { isActive: true },
        },
        select: {
          user: { select: { id: true, email: true, name: true, role: true } },
        },
      })
    : []
  const coupleUsers = wedding
    ? await db.user.findMany({
        where: {
          coupleId: wedding.coupleId,
          isActive: true,
        },
        select: { id: true, email: true, name: true, role: true },
      })
    : []
  const admins = await db.user.findMany({
    where: { isActive: true, role: 'admin' },
    select: { id: true, email: true, name: true, role: true },
    take: 25,
  })

  const contacts = new Map<string, CommunicationContact>()
  for (const user of [
    ...memberships.map((membership) => membership.user),
    ...coupleUsers,
    ...admins,
  ]) {
    if (user.id === actor.userId || !isDashboardRole(user.role)) continue
    const plannerIdentity = plannersByUserId.get(user.id)
    contacts.set(user.id, {
      id: user.id,
      name: plannerIdentity?.businessName.trim() || user.name?.trim() || user.email,
      email: user.email,
      role: user.role,
      defaultType: defaultConversationTypeForRoles(actor.role, user.role),
      context: user.role === 'admin' ? 'wewed' : 'wedding',
    })
  }

  if (actor.role === 'planner') {
    for (const planner of plannerDirectory) {
      if (planner.userId === actor.userId) continue
      const existing = contacts.get(planner.userId)
      if (existing) {
        contacts.set(planner.userId, {
          ...existing,
          name: planner.businessName.trim() || planner.userName?.trim() || planner.email,
          role: 'planner',
          defaultType: 'DIRECT',
        })
        continue
      }
      contacts.set(planner.userId, {
        id: planner.userId,
        name: planner.businessName.trim() || planner.userName?.trim() || planner.email,
        email: planner.email,
        role: 'planner',
        defaultType: 'DIRECT',
        context: 'wewed',
      })
    }
  }

  return Array.from(contacts.values()).sort((a, b) => {
    if (a.context !== b.context) return a.context === 'wewed' ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

export async function listCommunicationConversations(actor: CommunicationActor) {
  const staff = actor.role === 'admin'
  const rows = await db.$queryRaw<ConversationRow[]>(Prisma.sql`
    SELECT
      c."id",
      c."kind",
      c."type",
      c."title",
      c."weddingId",
      c."status",
      c."createdAt",
      p."lastReadAt",
      visible_last."createdAt" AS "lastVisibleMessageAt",
      visible_last."body" AS "lastMessageBody",
      visible_last."senderUserId" AS "lastMessageSenderUserId",
      visible_last."senderName" AS "lastMessageSenderName",
      (
        SELECT COUNT(*)
        FROM wewed_communications."CommunicationMessage" unread
        WHERE unread."conversationId" = c."id"
          AND unread."deletedAt" IS NULL
          AND unread."createdAt" > COALESCE(p."lastReadAt", TIMESTAMPTZ 'epoch')
          AND unread."senderUserId" IS DISTINCT FROM ${actor.userId}
          AND (unread."visibility" = 'PARTICIPANTS' OR ${staff})
      ) AS "unreadCount",
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'userId', member."userId",
            'name', COALESCE(NULLIF(btrim(u."name"), ''), u."email"),
            'email', u."email",
            'role', u."role"
          )
          ORDER BY COALESCE(NULLIF(btrim(u."name"), ''), u."email")
        )
        FROM wewed_communications."CommunicationParticipant" member
        JOIN public."User" u ON u."id" = member."userId"
        WHERE member."conversationId" = c."id"
          AND member."leftAt" IS NULL
      ), '[]'::jsonb) AS "participants"
    FROM wewed_communications."CommunicationParticipant" p
    JOIN wewed_communications."CommunicationConversation" c
      ON c."id" = p."conversationId"
    LEFT JOIN LATERAL (
      SELECT
        message."body",
        message."createdAt",
        message."senderUserId",
        COALESCE(NULLIF(btrim(sender."name"), ''), sender."email", 'Wewed') AS "senderName"
      FROM wewed_communications."CommunicationMessage" message
      LEFT JOIN public."User" sender ON sender."id" = message."senderUserId"
      WHERE message."conversationId" = c."id"
        AND message."deletedAt" IS NULL
        AND (message."visibility" = 'PARTICIPANTS' OR ${staff})
      ORDER BY message."createdAt" DESC, message."id" DESC
      LIMIT 1
    ) visible_last ON TRUE
    WHERE p."userId" = ${actor.userId}
      AND p."leftAt" IS NULL
      AND p."archivedAt" IS NULL
    ORDER BY COALESCE(visible_last."createdAt", c."createdAt") DESC, c."id" DESC
    LIMIT 200
  `)

  const participantUserIds = Array.from(new Set(rows.flatMap((row) =>
    asParticipantArray(row.participants).map((participant) => participant.userId),
  )))
  const plannerIdentities = plannerDirectoryMap(
    await listRegisteredPlannerDirectory(participantUserIds),
  )

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    type: row.type,
    title: row.title,
    weddingId: row.weddingId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    lastMessageAt: row.lastVisibleMessageAt?.toISOString() ?? null,
    lastMessageBody: row.lastMessageBody,
    lastMessageSenderName: row.lastMessageSenderUserId
      ? plannerIdentities.get(row.lastMessageSenderUserId)?.businessName.trim()
        || row.lastMessageSenderName
      : row.lastMessageSenderName,
    lastReadAt: row.lastReadAt?.toISOString() ?? null,
    unreadCount: asCount(row.unreadCount),
    participants: asParticipantArray(row.participants).map((participant) => {
      const planner = plannerIdentities.get(participant.userId)
      if (!planner) return participant
      return {
        ...participant,
        name: planner.businessName.trim() || planner.userName?.trim() || planner.email,
        role: 'planner',
      }
    }),
  }))
}

async function requireMembership(
  actor: CommunicationActor,
  conversationId: string,
  tx: Prisma.TransactionClient | typeof db = db,
): Promise<MembershipRow> {
  const rows = await tx.$queryRaw<MembershipRow[]>(Prisma.sql`
    SELECT
      c."id" AS "conversationId",
      c."type",
      c."status",
      c."weddingId"
    FROM wewed_communications."CommunicationParticipant" participant
    JOIN wewed_communications."CommunicationConversation" c
      ON c."id" = participant."conversationId"
    WHERE participant."conversationId" = ${conversationId}
      AND participant."userId" = ${actor.userId}
      AND participant."leftAt" IS NULL
    LIMIT 1
  `)
  const row = rows[0]
  if (!row) throw new CommunicationError('Conversation not found.', 404)
  return row
}

async function userCanAccessWedding(userId: string, weddingId: string): Promise<boolean> {
  const wedding = await db.wedding.findUnique({
    where: { id: weddingId },
    select: { coupleId: true },
  })
  if (!wedding) return false

  const [user, membership] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { coupleId: true, isActive: true },
    }),
    db.weddingMembership.findUnique({
      where: { userId_weddingId: { userId, weddingId } },
      select: { status: true },
    }),
  ])

  return Boolean(
    user?.isActive &&
    (user.coupleId === wedding.coupleId || membership?.status === 'active'),
  )
}

async function findReusableDirectConversation(input: {
  actorUserId: string
  targetUserId: string
  type: CommunicationConversationType
  weddingId: string | null
}): Promise<string | null> {
  const rows = await db.$queryRaw<ReusedConversationRow[]>(Prisma.sql`
    SELECT c."id"
    FROM wewed_communications."CommunicationConversation" c
    WHERE c."kind" = 'DIRECT'
      AND c."type" = ${input.type}
      AND c."status" = 'OPEN'
      AND c."weddingId" IS NOT DISTINCT FROM ${input.weddingId}
      AND EXISTS (
        SELECT 1
        FROM wewed_communications."CommunicationParticipant" p
        WHERE p."conversationId" = c."id"
          AND p."userId" = ${input.actorUserId}
          AND p."leftAt" IS NULL
      )
      AND EXISTS (
        SELECT 1
        FROM wewed_communications."CommunicationParticipant" p
        WHERE p."conversationId" = c."id"
          AND p."userId" = ${input.targetUserId}
          AND p."leftAt" IS NULL
      )
      AND (
        SELECT COUNT(*)
        FROM wewed_communications."CommunicationParticipant" p
        WHERE p."conversationId" = c."id"
          AND p."leftAt" IS NULL
      ) = 2
    ORDER BY c."createdAt" ASC
    LIMIT 1
  `)
  return rows[0]?.id ?? null
}

async function insertEvent(
  tx: Prisma.TransactionClient,
  input: {
    conversationId?: string | null
    messageId?: string | null
    actorUserId?: string | null
    eventType: string
    metadata?: Record<string, unknown>
  },
) {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO wewed_communications."CommunicationEvent"
      ("id", "conversationId", "messageId", "actorUserId", "eventType", "metadata")
    VALUES (
      ${randomUUID()},
      ${input.conversationId ?? null},
      ${input.messageId ?? null},
      ${input.actorUserId ?? null},
      ${input.eventType},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
  `)
}

async function insertMessage(
  tx: Prisma.TransactionClient,
  actor: CommunicationActor,
  conversationId: string,
  body: string,
  internalNote: boolean,
) {
  const policy = communicationMessagePolicy({ role: actor.role, internalNote })
  const messageId = randomUUID()
  const now = new Date()

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO wewed_communications."CommunicationMessage"
      ("id", "conversationId", "senderUserId", "messageType", "visibility", "body", "createdAt", "updatedAt")
    VALUES (
      ${messageId},
      ${conversationId},
      ${actor.userId},
      ${policy.messageType},
      ${policy.visibility},
      ${body},
      ${now},
      ${now}
    )
  `)

  await tx.$executeRaw(Prisma.sql`
    UPDATE wewed_communications."CommunicationConversation"
    SET "lastMessageAt" = ${now}, "updatedAt" = ${now}
    WHERE "id" = ${conversationId}
  `)
  await tx.$executeRaw(Prisma.sql`
    UPDATE wewed_communications."CommunicationParticipant"
    SET "lastReadAt" = ${now}, "updatedAt" = ${now}
    WHERE "conversationId" = ${conversationId}
      AND "userId" = ${actor.userId}
      AND "leftAt" IS NULL
  `)

  const recipients = await tx.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
    SELECT "userId"
    FROM wewed_communications."CommunicationParticipant"
    WHERE "conversationId" = ${conversationId}
      AND "userId" <> ${actor.userId}
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

  await insertEvent(tx, {
    conversationId,
    messageId,
    actorUserId: actor.userId,
    eventType: 'message_sent',
    metadata: {
      messageType: policy.messageType,
      visibility: policy.visibility,
      bodyLength: body.length,
      recipientCount: recipients.length,
    },
  })

  return messageId
}

export async function createCommunicationConversation(
  actor: CommunicationActor,
  input: CreateCommunicationConversationInput,
) {
  const participantIds = normalizeParticipantIds(actor.userId, input.participantIds)
  if (participantIds.length === 0) {
    throw new CommunicationError('Choose at least one participant.')
  }

  const targets = await db.user.findMany({
    where: {
      id: { in: participantIds },
      isActive: true,
      role: { in: ['admin', 'couple', 'planner'] },
    },
    select: { id: true, email: true, name: true, role: true },
  })
  if (targets.length !== participantIds.length) {
    throw new CommunicationError('One or more participants are unavailable.', 400)
  }
  const typedTargets = targets.flatMap((target) =>
    isDashboardRole(target.role) ? [{ ...target, role: target.role }] : [],
  )
  if (typedTargets.length !== participantIds.length) {
    throw new CommunicationError('One or more participants are unavailable.', 400)
  }

  const requestedType = isCommunicationConversationType(input.type)
    ? input.type
    : typedTargets.length === 1
      ? defaultConversationTypeForRoles(actor.role, typedTargets[0].role)
      : 'WEDDING'

  if (!canCreateCommunicationType(actor.role, requestedType)) {
    throw new CommunicationError('This conversation type is not available to your role.', 403)
  }

  const targetAdmins = typedTargets.filter((target) => target.role === 'admin')
  const plannerDirect = actor.role === 'planner'
    && typedTargets.length === 1
    && typedTargets[0].role === 'planner'
    && requestedType === 'DIRECT'
  let weddingId = stringOrNull(input.weddingId)

  if (actor.role === 'admin') {
    if (requestedType === 'INTERNAL' && targetAdmins.length !== typedTargets.length) {
      throw new CommunicationError('Internal conversations can contain Wewed administrators only.', 403)
    }
    if (weddingId) {
      const exists = await db.wedding.findUnique({ where: { id: weddingId }, select: { id: true } })
      if (!exists) throw new CommunicationError('Wedding context was not found.', 404)
    }
  } else if (targetAdmins.length > 0) {
    if (targetAdmins.length !== typedTargets.length || requestedType !== 'SUPPORT') {
      throw new CommunicationError('Wewed staff can be contacted through a support conversation.', 403)
    }
    weddingId = actor.activeWeddingId || null
    if (weddingId && !(await userCanAccessWedding(actor.userId, weddingId))) weddingId = null
  } else if (plannerDirect) {
    const registeredPlanners = await listRegisteredPlannerDirectory([
      actor.userId,
      typedTargets[0].id,
    ])
    if (registeredPlanners.length !== 2) {
      throw new CommunicationError(
        'Planner-to-planner conversations require active registered planner accounts.',
        403,
      )
    }
    weddingId = null
  } else {
    weddingId = actor.activeWeddingId
    if (!weddingId || !(await userCanAccessWedding(actor.userId, weddingId))) {
      throw new CommunicationError('An active wedding context is required.', 403)
    }
    for (const target of typedTargets) {
      if (!(await userCanAccessWedding(target.id, weddingId))) {
        throw new CommunicationError('Participants must share access to the active wedding.', 403)
      }
    }
    if (typedTargets.length > 1 && requestedType !== 'WEDDING') {
      throw new CommunicationError('Multi-party user conversations must use the wedding type.', 400)
    }
  }

  const kind = typedTargets.length === 1 ? 'DIRECT' : 'GROUP'
  if (kind === 'DIRECT') {
    const reusable = await findReusableDirectConversation({
      actorUserId: actor.userId,
      targetUserId: typedTargets[0].id,
      type: requestedType,
      weddingId,
    })
    if (reusable) return { id: reusable, reused: true }
  }

  const title = cleanTitle(input.title)
  const initialBody = normalizeCommunicationBody(input.initialMessage)
  const conversationId = randomUUID()
  const now = new Date()

  await db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO wewed_communications."CommunicationConversation"
        ("id", "kind", "type", "title", "weddingId", "createdByUserId", "status", "createdAt", "updatedAt")
      VALUES (
        ${conversationId}, ${kind}, ${requestedType}, ${title}, ${weddingId},
        ${actor.userId}, 'OPEN', ${now}, ${now}
      )
    `)

    const allParticipants = [actor.userId, ...typedTargets.map((target) => target.id)]
    for (const userId of allParticipants) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO wewed_communications."CommunicationParticipant"
          ("id", "conversationId", "userId", "role", "joinedAt", "lastReadAt", "createdAt", "updatedAt")
        VALUES (
          ${randomUUID()}, ${conversationId}, ${userId},
          ${userId === actor.userId ? 'ADMIN' : 'MEMBER'},
          ${now}, ${userId === actor.userId ? now : null}, ${now}, ${now}
        )
      `)
    }

    if (weddingId) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO wewed_communications."CommunicationEntityLink"
          ("id", "conversationId", "entityType", "entityId", "metadata")
        VALUES (${randomUUID()}, ${conversationId}, 'wedding', ${weddingId}, '{}'::jsonb)
        ON CONFLICT ("conversationId", "entityType", "entityId") DO NOTHING
      `)
    }

    await insertEvent(tx, {
      conversationId,
      actorUserId: actor.userId,
      eventType: 'conversation_created',
      metadata: {
        kind,
        type: requestedType,
        participantCount: allParticipants.length,
        hasWeddingContext: Boolean(weddingId),
      },
    })

    if (initialBody) {
      await insertMessage(tx, actor, conversationId, initialBody, false)
    }
  })

  return { id: conversationId, reused: false }
}

export async function listCommunicationMessages(
  actor: CommunicationActor,
  conversationId: string,
) {
  await requireMembership(actor, conversationId)
  const staff = actor.role === 'admin'
  const rows = await db.$queryRaw<MessageRow[]>(Prisma.sql`
    SELECT
      message."id",
      message."conversationId",
      message."senderUserId",
      COALESCE(NULLIF(btrim(sender."name"), ''), sender."email", 'Wewed') AS "senderName",
      sender."role" AS "senderRole",
      message."messageType",
      message."visibility",
      message."body",
      message."replyToMessageId",
      message."createdAt",
      message."editedAt"
    FROM wewed_communications."CommunicationMessage" message
    LEFT JOIN public."User" sender ON sender."id" = message."senderUserId"
    WHERE message."conversationId" = ${conversationId}
      AND message."deletedAt" IS NULL
      AND (message."visibility" = 'PARTICIPANTS' OR ${staff})
    ORDER BY message."createdAt" ASC, message."id" ASC
    LIMIT 500
  `)

  const senderUserIds = Array.from(new Set(rows.flatMap((row) =>
    row.senderUserId ? [row.senderUserId] : [],
  )))
  const plannerIdentities = plannerDirectoryMap(
    await listRegisteredPlannerDirectory(senderUserIds),
  )

  return rows.map((row) => ({
    ...row,
    senderName: row.senderUserId
      ? plannerIdentities.get(row.senderUserId)?.businessName.trim() || row.senderName
      : row.senderName,
    senderRole: row.senderUserId && plannerIdentities.has(row.senderUserId)
      ? 'planner'
      : row.senderRole,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
  }))
}

export async function sendCommunicationMessage(
  actor: CommunicationActor,
  conversationId: string,
  input: { body?: unknown; internalNote?: unknown },
) {
  const body = normalizeCommunicationBody(input.body)
  if (!body) throw new CommunicationError('Message content is required.')
  const internalNote = input.internalNote === true

  return db.$transaction(async (tx) => {
    const membership = await requireMembership(actor, conversationId, tx)
    if (membership.status !== 'OPEN') {
      throw new CommunicationError('This conversation is not open for replies.', 409)
    }
    try {
      const messageId = await insertMessage(tx, actor, conversationId, body, internalNote)
      return { id: messageId }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Only Wewed administrators')) {
        throw new CommunicationError(error.message, 403)
      }
      throw error
    }
  })
}

export async function markCommunicationRead(
  actor: CommunicationActor,
  conversationId: string,
) {
  const now = new Date()
  await db.$transaction(async (tx) => {
    await requireMembership(actor, conversationId, tx)
    await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationParticipant"
      SET "lastReadAt" = ${now}, "updatedAt" = ${now}
      WHERE "conversationId" = ${conversationId}
        AND "userId" = ${actor.userId}
        AND "leftAt" IS NULL
    `)
    await insertEvent(tx, {
      conversationId,
      actorUserId: actor.userId,
      eventType: 'conversation_read',
      metadata: {},
    })
  })
  return { readAt: now.toISOString() }
}

export async function getCommunicationUnread(actor: CommunicationActor) {
  const staff = actor.role === 'admin'
  const rows = await db.$queryRaw<Array<{
    conversationCount: bigint | number
    messageCount: bigint | number
  }>>(Prisma.sql`
    SELECT
      COUNT(DISTINCT CASE WHEN unread."id" IS NOT NULL THEN participant."conversationId" END) AS "conversationCount",
      COUNT(unread."id") AS "messageCount"
    FROM wewed_communications."CommunicationParticipant" participant
    LEFT JOIN wewed_communications."CommunicationMessage" unread
      ON unread."conversationId" = participant."conversationId"
      AND unread."deletedAt" IS NULL
      AND unread."createdAt" > COALESCE(participant."lastReadAt", TIMESTAMPTZ 'epoch')
      AND unread."senderUserId" IS DISTINCT FROM ${actor.userId}
      AND (unread."visibility" = 'PARTICIPANTS' OR ${staff})
    WHERE participant."userId" = ${actor.userId}
      AND participant."leftAt" IS NULL
      AND participant."archivedAt" IS NULL
  `)
  return {
    conversationCount: asCount(rows[0]?.conversationCount),
    messageCount: asCount(rows[0]?.messageCount),
  }
}
