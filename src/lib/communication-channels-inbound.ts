import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { isDashboardRole } from '@/lib/app-session'
import {
  ingestInboundCommunicationReply,
  normalizeCommunicationEndpoint,
} from '@/lib/communication-channels'
import {
  CommunicationError,
  sendCommunicationMessage,
  type CommunicationActor,
} from '@/lib/communications'
import { normalizeCommunicationBody } from '@/lib/communications-policy'

interface ActiveInboundConversation {
  deliveryId: string
  conversationId: string
  userId: string
  email: string
  name: string | null
  role: string
  coupleId: string | null
  weddingId: string | null
}

/**
 * Inbound WhatsApp routing is deliberately fail-closed.
 *
 * A contextual reply keeps using exact Meta provider-message correlation.
 * A non-context text is accepted only when the verified endpoint has exactly
 * one Wewed conversation with processed inbound WhatsApp activity in the
 * previous 24 hours and the endpoint owner remains an active participant.
 */
export async function ingestInboundWhatsAppMessage(input: {
  provider: string
  providerEventId: string
  fromAddress: string
  replyToProviderMessageId: string | null
  body: unknown
}) {
  if (input.replyToProviderMessageId) {
    return ingestInboundCommunicationReply({
      provider: input.provider,
      channel: 'WHATSAPP',
      providerEventId: input.providerEventId,
      fromAddress: input.fromAddress,
      replyToProviderMessageId: input.replyToProviderMessageId,
      body: input.body,
    })
  }

  const normalizedBody = normalizeCommunicationBody(input.body)
  if (!normalizedBody) throw new CommunicationError('Inbound message content is required.')
  const endpointAddress = normalizeCommunicationEndpoint('WHATSAPP', input.fromAddress).normalizedAddress
  const eventHash = createHash('sha256').update(normalizedBody).digest('hex')

  const candidates = await db.$queryRaw<ActiveInboundConversation[]>(Prisma.sql`
    SELECT DISTINCT ON (inbound_message."conversationId")
      anchor_delivery."id" AS "deliveryId",
      inbound_message."conversationId",
      endpoint."userId",
      user_account."email",
      user_account."name",
      user_account."role",
      user_account."coupleId",
      conversation."weddingId"
    FROM wewed_communications."CommunicationProviderEvent" provider_event
    JOIN wewed_communications."CommunicationMessage" inbound_message
      ON inbound_message."id" = provider_event."messageId"
    JOIN wewed_communications."CommunicationDelivery" anchor_delivery
      ON anchor_delivery."id" = provider_event."deliveryId"
    JOIN wewed_communications."CommunicationEndpoint" endpoint
      ON endpoint."id" = anchor_delivery."endpointId"
      AND endpoint."userId" = anchor_delivery."recipientUserId"
      AND endpoint."status" = 'VERIFIED'
    JOIN public."User" user_account
      ON user_account."id" = endpoint."userId"
      AND user_account."isActive" = true
    JOIN wewed_communications."CommunicationConversation" conversation
      ON conversation."id" = inbound_message."conversationId"
    JOIN wewed_communications."CommunicationParticipant" participant
      ON participant."conversationId" = conversation."id"
      AND participant."userId" = endpoint."userId"
      AND participant."leftAt" IS NULL
    WHERE provider_event."provider" = ${input.provider}
      AND provider_event."channel" = 'WHATSAPP'
      AND provider_event."direction" = 'INBOUND'
      AND provider_event."status" = 'PROCESSED'
      AND provider_event."createdAt" >= now() - interval '24 hours'
      AND endpoint."normalizedAddress" = ${endpointAddress}
    ORDER BY inbound_message."conversationId", provider_event."createdAt" DESC
  `)

  if (candidates.length !== 1) {
    throw new CommunicationError('Inbound message could not be associated with one active Wewed conversation.', 404)
  }

  const target = candidates[0]
  if (!target || !isDashboardRole(target.role)) {
    throw new CommunicationError('Inbound message could not be associated with a verified Wewed participant.', 404)
  }

  const eventId = randomUUID()
  const inserted = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO wewed_communications."CommunicationProviderEvent"
      ("id", "provider", "channel", "providerEventId", "direction", "eventType", "status", "deliveryId", "metadata")
    VALUES (
      ${eventId},
      ${input.provider},
      'WHATSAPP',
      ${input.providerEventId},
      'INBOUND',
      'message',
      'RECEIVED',
      ${target.deliveryId},
      ${JSON.stringify({ bodySha256: eventHash, correlation: 'active_window' })}::jsonb
    )
    ON CONFLICT ("provider", "providerEventId") DO NOTHING
    RETURNING "id"
  `)

  if (!inserted[0]) return { duplicate: true, messageId: null }

  const actor: CommunicationActor = {
    userId: target.userId,
    email: target.email,
    name: target.name?.trim() || target.email,
    role: target.role,
    coupleId: target.coupleId,
    activeWeddingId: target.weddingId ?? '',
  }

  try {
    const message = await sendCommunicationMessage(actor, target.conversationId, { body: normalizedBody })
    await db.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationProviderEvent"
      SET "status" = 'PROCESSED', "messageId" = ${message.id}, "processedAt" = now()
      WHERE "id" = ${eventId}
    `)
    return { duplicate: false, messageId: message.id }
  } catch (error) {
    await db.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationProviderEvent"
      SET "status" = 'FAILED', "processedAt" = now()
      WHERE "id" = ${eventId}
    `)
    throw error
  }
}
