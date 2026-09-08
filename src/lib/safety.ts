import 'server-only'

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  CommunicationError,
  type CommunicationActor,
} from '@/lib/communications'
import {
  normalizeAiReportArea,
  normalizeAiSnapshot,
  normalizeOptionalSafetyText,
  normalizeSafetyReason,
  SafetyInputError,
} from '@/lib/safety-policy'

type SafetyReportSubject = 'COMMUNICATION_MESSAGE' | 'COMMUNICATION_USER' | 'AI_OUTPUT'

interface ReportableMessageRow {
  senderUserId: string | null
  body: string
}

async function createModerationCase({
  reportId,
  requesterEmail,
  subject,
  reason,
  details,
  contentSnapshot,
  sourceArea,
  conversationId,
  messageId,
  targetUserId,
}: {
  reportId: string
  requesterEmail: string | null
  subject: SafetyReportSubject
  reason: string
  details: string | null
  contentSnapshot: string | null
  sourceArea: string | null
  conversationId: string | null
  messageId: string | null
  targetUserId: string | null
}) {
  const caseId = randomUUID()
  const description = [
    `Safety report: ${reportId}`,
    `Subject: ${subject}`,
    `Reason: ${reason}`,
    sourceArea ? `Area: ${sourceArea}` : null,
    conversationId ? `Conversation: ${conversationId}` : null,
    messageId ? `Message: ${messageId}` : null,
    targetUserId ? `Reported user: ${targetUserId}` : null,
    details ? `Reporter details: ${details}` : null,
    contentSnapshot ? `Content snapshot:\n${contentSnapshot}` : null,
  ].filter((line): line is string => Boolean(line)).join('\n')

  await db.$executeRaw(Prisma.sql`
    INSERT INTO wewed_admin."SupportCase" (
      "id", "businessAccountId", "title", "description", "category", "priority",
      "status", "requesterEmail", "assignedToUserId"
    ) VALUES (
      ${caseId}, ${null}, ${`Safety report: ${reason}`}, ${description},
      'trust_and_safety', ${reason === 'VIOLENCE' || reason === 'DANGEROUS' ? 'urgent' : 'high'},
      'open', ${requesterEmail}, ${null}
    )
  `)
}

function requiredId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CommunicationError(`${label} is required.`)
  }
  const id = value.trim()
  if (id.length > 200) throw new CommunicationError(`${label} is invalid.`)
  return id
}

function subjectType(value: unknown): SafetyReportSubject {
  if (
    value !== 'COMMUNICATION_MESSAGE' &&
    value !== 'COMMUNICATION_USER' &&
    value !== 'AI_OUTPUT'
  ) {
    throw new CommunicationError('Choose content or a person to report.')
  }
  return value
}

export async function createSafetyReport(
  actor: CommunicationActor,
  input: Record<string, unknown>,
) {
  try {
    const subject = subjectType(input.subjectType)
    const reason = normalizeSafetyReason(input.reason)
    const details = normalizeOptionalSafetyText(input.details, 1000, 'Details')
    const reportId = randomUUID()
    let conversationId: string | null = null
    let messageId: string | null = null
    let targetUserId: string | null = null
    let sourceArea: string | null = null
    let sourceId: string | null = null
    let contentSnapshot: string | null = null

    if (subject === 'COMMUNICATION_MESSAGE') {
      conversationId = requiredId(input.conversationId, 'Conversation')
      messageId = requiredId(input.messageId, 'Message')
      const rows = await db.$queryRaw<ReportableMessageRow[]>(Prisma.sql`
        SELECT message."senderUserId", message."body"
        FROM wewed_communications."CommunicationParticipant" reporter
        JOIN wewed_communications."CommunicationMessage" message
          ON message."conversationId" = reporter."conversationId"
         AND message."id" = ${messageId}
         AND message."deletedAt" IS NULL
        WHERE reporter."conversationId" = ${conversationId}
          AND reporter."userId" = ${actor.userId}
          AND reporter."leftAt" IS NULL
          AND (message."visibility" = 'PARTICIPANTS' OR ${actor.role === 'admin'})
        LIMIT 1
      `)
      const message = rows[0]
      if (!message) throw new CommunicationError('Message not found.', 404)
      if (message.senderUserId === actor.userId) {
        throw new CommunicationError('You cannot report your own message.')
      }
      targetUserId = message.senderUserId
      contentSnapshot = message.body
      sourceArea = 'MESSAGES'
    } else if (subject === 'COMMUNICATION_USER') {
      conversationId = requiredId(input.conversationId, 'Conversation')
      targetUserId = requiredId(input.targetUserId, 'Person')
      if (targetUserId === actor.userId) {
        throw new CommunicationError('You cannot report yourself.')
      }
      const rows = await db.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`
        SELECT true AS "allowed"
        FROM wewed_communications."CommunicationParticipant" reporter
        JOIN wewed_communications."CommunicationParticipant" target
          ON target."conversationId" = reporter."conversationId"
         AND target."userId" = ${targetUserId}
         AND target."leftAt" IS NULL
        WHERE reporter."conversationId" = ${conversationId}
          AND reporter."userId" = ${actor.userId}
          AND reporter."leftAt" IS NULL
        LIMIT 1
      `)
      if (!rows[0]) throw new CommunicationError('Person not found in this conversation.', 404)
      sourceArea = 'MESSAGES'
    } else {
      sourceArea = normalizeAiReportArea(input.sourceArea)
      sourceId = normalizeOptionalSafetyText(input.sourceId, 200, 'Source ID')
      contentSnapshot = normalizeAiSnapshot(input.contentSnapshot)
    }

    await db.$executeRaw(Prisma.sql`
      INSERT INTO wewed_safety."SafetyReport" (
        "id", "reporterUserId", "reporterFingerprint", "subjectType", "conversationId", "messageId",
        "targetUserId", "sourceArea", "sourceId", "reason", "details",
        "contentSnapshot", "metadata", "status"
      ) VALUES (
        ${reportId}, ${actor.userId}, ${null}, ${subject}, ${conversationId}, ${messageId},
        ${targetUserId}, ${sourceArea}, ${sourceId}, ${reason}, ${details},
        ${contentSnapshot}, '{}'::jsonb, 'OPEN'
      )
    `)

    await createModerationCase({
      reportId,
      requesterEmail: actor.email,
      subject,
      reason,
      details,
      contentSnapshot,
      sourceArea,
      conversationId,
      messageId,
      targetUserId,
    })

    return { id: reportId, status: 'OPEN' as const }
  } catch (error) {
    if (error instanceof SafetyInputError) {
      throw new CommunicationError(error.message)
    }
    throw error
  }
}

export async function createAnonymousAiSafetyReport(
  reporterFingerprint: string,
  input: Record<string, unknown>,
) {
  try {
    if (input.subjectType !== 'AI_OUTPUT') {
      throw new CommunicationError('Sign in to report messages or people.', 401)
    }
    const reportId = randomUUID()
    const reason = normalizeSafetyReason(input.reason)
    const details = normalizeOptionalSafetyText(input.details, 1000, 'Details')
    const sourceArea = normalizeAiReportArea(input.sourceArea)
    const sourceId = normalizeOptionalSafetyText(input.sourceId, 200, 'Source ID')
    const contentSnapshot = normalizeAiSnapshot(input.contentSnapshot)
    await db.$executeRaw(Prisma.sql`
      INSERT INTO wewed_safety."SafetyReport" (
        "id", "reporterUserId", "reporterFingerprint", "subjectType", "sourceArea",
        "sourceId", "reason", "details", "contentSnapshot", "metadata", "status"
      ) VALUES (
        ${reportId}, ${null}, ${reporterFingerprint}, 'AI_OUTPUT', ${sourceArea},
        ${sourceId}, ${reason}, ${details}, ${contentSnapshot}, '{}'::jsonb, 'OPEN'
      )
    `)
    await createModerationCase({
      reportId,
      requesterEmail: null,
      subject: 'AI_OUTPUT',
      reason,
      details,
      contentSnapshot,
      sourceArea,
      conversationId: null,
      messageId: null,
      targetUserId: null,
    })
    return { id: reportId, status: 'OPEN' as const }
  } catch (error) {
    if (error instanceof SafetyInputError) throw new CommunicationError(error.message)
    throw error
  }
}
