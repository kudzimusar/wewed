import 'server-only'

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { isDashboardRole } from '@/lib/app-session'
import { sendTransactionalEmail } from '@/lib/email/resend'
import {
  CommunicationError,
  sendCommunicationMessage,
  type CommunicationActor,
} from '@/lib/communications'
import { normalizeCommunicationBody } from '@/lib/communications-policy'

export type ExternalCommunicationChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'PUSH'
export type CommunicationEndpointStatus = 'PENDING' | 'VERIFIED' | 'DISABLED' | 'BOUNCED'

const EXTERNAL_CHANNELS: readonly ExternalCommunicationChannel[] = ['EMAIL', 'WHATSAPP', 'SMS', 'PUSH']

interface EndpointRow {
  id: string
  userId: string
  channel: ExternalCommunicationChannel
  address: string
  normalizedAddress: string
  status: CommunicationEndpointStatus
  verifiedAt: Date | null
  metadata: Prisma.JsonValue
  createdAt: Date
  updatedAt: Date
  enabled: boolean
}

interface ClaimedDeliveryRow {
  id: string
  messageId: string
  recipientUserId: string
  channel: ExternalCommunicationChannel
  attemptCount: number
  maxAttempts: number
  address: string
  normalizedAddress: string
  body: string
  conversationId: string
  senderName: string
}

export interface TransportResult {
  ok: boolean
  provider: string
  providerMessageId?: string
  errorCode?: string
  retriable?: boolean
  unavailable?: boolean
}

function isExternalChannel(value: unknown): value is ExternalCommunicationChannel {
  return typeof value === 'string' && EXTERNAL_CHANNELS.includes(value as ExternalCommunicationChannel)
}

function cleanAddress(value: unknown): string {
  if (typeof value !== 'string') throw new CommunicationError('Communication address is required.')
  const address = value.trim()
  if (!address) throw new CommunicationError('Communication address is required.')
  if (address.length > 2048) throw new CommunicationError('Communication address is too long.')
  return address
}

export function normalizeCommunicationEndpoint(
  channel: ExternalCommunicationChannel,
  value: unknown,
): { address: string; normalizedAddress: string } {
  const address = cleanAddress(value)
  if (channel === 'EMAIL') {
    const normalizedAddress = address.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAddress)) {
      throw new CommunicationError('Enter a valid email address.')
    }
    return { address, normalizedAddress }
  }
  if (channel === 'WHATSAPP' || channel === 'SMS') {
    const digits = address.replace(/[^0-9+]/g, '')
    const normalizedAddress = digits.startsWith('+') ? digits : `+${digits.replace(/^\+/, '')}`
    if (!/^\+[1-9][0-9]{7,14}$/.test(normalizedAddress)) {
      throw new CommunicationError('Use an international phone number, for example +263...')
    }
    return { address, normalizedAddress }
  }
  if (address.length < 8) throw new CommunicationError('Push endpoint is invalid.')
  return { address, normalizedAddress: address }
}

function safeMetadata(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of ['label', 'device', 'source']) {
    const item = source[key]
    if (typeof item === 'string' && item.length <= 120) result[key] = item
  }
  return result
}

export async function listCommunicationChannelSettings(actor: CommunicationActor) {
  const rows = await db.$queryRaw<EndpointRow[]>(Prisma.sql`
    SELECT endpoint."id", endpoint."userId", endpoint."channel", endpoint."address",
      endpoint."normalizedAddress", endpoint."status", endpoint."verifiedAt", endpoint."metadata",
      endpoint."createdAt", endpoint."updatedAt", COALESCE(preference."enabled", false) AS "enabled"
    FROM wewed_communications."CommunicationEndpoint" endpoint
    LEFT JOIN wewed_communications."CommunicationPreference" preference
      ON preference."userId" = endpoint."userId" AND preference."channel" = endpoint."channel"
    WHERE endpoint."userId" = ${actor.userId}
    ORDER BY endpoint."channel", endpoint."createdAt" DESC
  `)
  const preferences = await db.$queryRaw<Array<{ channel: ExternalCommunicationChannel; enabled: boolean }>>(Prisma.sql`
    SELECT "channel", "enabled"
    FROM wewed_communications."CommunicationPreference"
    WHERE "userId" = ${actor.userId}
  `)
  const preferenceMap = new Map(preferences.map((item) => [item.channel, item.enabled]))
  return {
    endpoints: rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      address: row.address,
      normalizedAddress: row.normalizedAddress,
      status: row.status,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      metadata: safeMetadata(row.metadata),
      enabled: row.enabled,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    preferences: EXTERNAL_CHANNELS.map((channel) => ({ channel, enabled: preferenceMap.get(channel) ?? false })),
  }
}

export async function registerCommunicationEndpoint(
  actor: CommunicationActor,
  input: { channel?: unknown; address?: unknown; metadata?: unknown },
) {
  if (!isExternalChannel(input.channel)) throw new CommunicationError('Unsupported communication channel.')
  const endpoint = normalizeCommunicationEndpoint(input.channel, input.address)
  const metadata = safeMetadata(
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? input.metadata as Prisma.JsonObject
      : {},
  )
  const id = randomUUID()
  const now = new Date()
  const rows = await db.$queryRaw<Array<{ id: string; status: CommunicationEndpointStatus }>>(Prisma.sql`
    INSERT INTO wewed_communications."CommunicationEndpoint"
      ("id", "userId", "channel", "address", "normalizedAddress", "status", "metadata", "createdAt", "updatedAt")
    VALUES (${id}, ${actor.userId}, ${input.channel}, ${endpoint.address}, ${endpoint.normalizedAddress},
      'PENDING', ${JSON.stringify(metadata)}::jsonb, ${now}, ${now})
    ON CONFLICT ("userId", "channel", "normalizedAddress") DO UPDATE SET
      "address" = EXCLUDED."address", "metadata" = EXCLUDED."metadata", "updatedAt" = EXCLUDED."updatedAt"
    RETURNING "id", "status"
  `)
  await db.$executeRaw(Prisma.sql`
    INSERT INTO wewed_communications."CommunicationPreference"
      ("id", "userId", "channel", "enabled", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${actor.userId}, ${input.channel}, false, ${now}, ${now})
    ON CONFLICT ("userId", "channel") DO NOTHING
  `)
  return { id: rows[0]?.id ?? id, status: rows[0]?.status ?? 'PENDING' }
}

export async function disableCommunicationEndpoint(actor: CommunicationActor, endpointId: string) {
  return db.$transaction(async (tx) => {
    const count = await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationEndpoint"
      SET "status" = 'DISABLED', "verifiedAt" = NULL, "updatedAt" = now()
      WHERE "id" = ${endpointId} AND "userId" = ${actor.userId}
    `)
    if (count === 0) throw new CommunicationError('Communication endpoint not found.', 404)
    await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationDelivery"
      SET "status" = 'SKIPPED', "errorCode" = 'ENDPOINT_DISABLED', "nextAttemptAt" = NULL, "updatedAt" = now()
      WHERE "endpointId" = ${endpointId} AND "status" = 'QUEUED'
    `)
    return { id: endpointId, status: 'DISABLED' as const }
  })
}

export async function setCommunicationPreference(
  actor: CommunicationActor,
  input: { channel?: unknown; enabled?: unknown },
) {
  if (!isExternalChannel(input.channel)) throw new CommunicationError('Unsupported communication channel.')
  if (typeof input.enabled !== 'boolean') throw new CommunicationError('Preference must be enabled or disabled.')
  const now = new Date()
  await db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO wewed_communications."CommunicationPreference"
        ("id", "userId", "channel", "enabled", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${actor.userId}, ${input.channel}, ${input.enabled}, ${now}, ${now})
      ON CONFLICT ("userId", "channel") DO UPDATE SET "enabled" = EXCLUDED."enabled", "updatedAt" = EXCLUDED."updatedAt"
    `)
    if (!input.enabled) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE wewed_communications."CommunicationDelivery"
        SET "status" = 'SKIPPED', "errorCode" = 'CHANNEL_DISABLED', "nextAttemptAt" = NULL, "updatedAt" = ${now}
        WHERE "recipientUserId" = ${actor.userId} AND "channel" = ${input.channel} AND "status" = 'QUEUED'
      `)
    }
  })
  return { channel: input.channel, enabled: input.enabled }
}

export async function verifyCommunicationEndpoint(endpointId: string) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; userId: string; channel: ExternalCommunicationChannel }>>(Prisma.sql`
      SELECT "id", "userId", "channel" FROM wewed_communications."CommunicationEndpoint"
      WHERE "id" = ${endpointId} FOR UPDATE
    `)
    const endpoint = rows[0]
    if (!endpoint) throw new CommunicationError('Communication endpoint not found.', 404)
    await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationEndpoint"
      SET "status" = 'DISABLED', "verifiedAt" = NULL, "updatedAt" = now()
      WHERE "userId" = ${endpoint.userId} AND "channel" = ${endpoint.channel}
        AND "id" <> ${endpoint.id} AND "status" = 'VERIFIED'
    `)
    await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationEndpoint"
      SET "status" = 'VERIFIED', "verifiedAt" = now(), "updatedAt" = now()
      WHERE "id" = ${endpoint.id}
    `)
    return { id: endpoint.id, status: 'VERIFIED' as const }
  })
}

export function communicationDispatchAuthorized(provided: string | null): boolean {
  const expected = process.env.WEWED_COMMUNICATIONS_DISPATCH_KEY?.trim()
  if (!expected || !provided) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(provided)
  return left.length === right.length && timingSafeEqual(left, right)
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function applicationBaseUrl(): string {
  return (process.env.WEWED_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://wewed.pro').replace(/\/$/, '')
}

export function buildCommunicationEmail(input: ClaimedDeliveryRow) {
  const link = `${applicationBaseUrl()}/messages?conversation=${encodeURIComponent(input.conversationId)}`
  return {
    subject: `${input.senderName} sent you a message on Wewed`,
    text: `${input.senderName}: ${input.body}\n\nOpen Wewed: ${link}`,
    html: `<p><strong>${escapeHtml(input.senderName)}</strong> sent you a message:</p><p>${escapeHtml(input.body).replaceAll('\n', '<br>')}</p><p><a href="${escapeHtml(link)}">Open Wewed</a></p>`,
  }
}

export function buildWhatsAppRequest(input: ClaimedDeliveryRow) {
  const token = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim()
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim()
  const version = process.env.WHATSAPP_CLOUD_GRAPH_VERSION?.trim()
  if (!token || !phoneNumberId || !version) return null
  const base = (process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL || 'https://graph.facebook.com').replace(/\/$/, '')
  const template = process.env.WEWED_WHATSAPP_NOTIFICATION_TEMPLATE?.trim()
  const language = process.env.WEWED_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en'
  const to = input.normalizedAddress.replace(/^\+/, '')
  const body = template
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: language }, components: [{ type: 'body', parameters: [{ type: 'text', text: input.body.slice(0, 1000) }] }] } }
    : { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: input.body.slice(0, 4000) } }
  return { url: `${base}/${version}/${encodeURIComponent(phoneNumberId)}/messages`, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body }
}

function buildGenericGatewayRequest(channel: 'SMS' | 'PUSH', input: ClaimedDeliveryRow) {
  const prefix = channel === 'SMS' ? 'WEWED_SMS_GATEWAY' : 'WEWED_PUSH_GATEWAY'
  const url = process.env[`${prefix}_URL`]?.trim()
  if (!url) return null
  const token = process.env[`${prefix}_TOKEN`]?.trim()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return { url, headers, body: channel === 'SMS'
    ? { to: input.normalizedAddress, body: input.body, messageId: input.messageId, deliveryId: input.id }
    : { endpoint: input.address, title: `Message from ${input.senderName}`, body: input.body.slice(0, 240), url: `${applicationBaseUrl()}/messages?conversation=${encodeURIComponent(input.conversationId)}`, messageId: input.messageId, deliveryId: input.id } }
}

async function sendJson(provider: string, request: { url: string; headers: Record<string, string>; body: unknown } | null, extractId: (payload: unknown) => string | undefined): Promise<TransportResult> {
  if (!request) return { ok: false, provider, errorCode: 'TRANSPORT_NOT_CONFIGURED', unavailable: true }
  try {
    const response = await fetch(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(request.body), signal: AbortSignal.timeout(10_000) })
    const payload = await response.json().catch(() => null) as unknown
    if (!response.ok) return { ok: false, provider, errorCode: `HTTP_${response.status}`, retriable: [408, 409, 425, 429].includes(response.status) || response.status >= 500 }
    return { ok: true, provider, providerMessageId: extractId(payload) }
  } catch {
    return { ok: false, provider, errorCode: 'NETWORK_ERROR', retriable: true }
  }
}

async function dispatchTransport(input: ClaimedDeliveryRow): Promise<TransportResult> {
  if (input.channel === 'EMAIL') {
    const content = buildCommunicationEmail(input)
    const result = await sendTransactionalEmail({
      idempotencyKey: `communication:${input.id}`,
      category: 'communications',
      to: input.normalizedAddress,
      subject: content.subject,
      html: content.html,
      text: content.text,
      metadata: { communicationDeliveryId: input.id, messageId: input.messageId },
      tags: [{ name: 'communication_delivery_id', value: input.id }],
    })
    if (result.ok) return { ok: true, provider: 'resend', providerMessageId: result.providerEmailId }
    if (result.reason === 'not_configured') return { ok: false, provider: 'resend', errorCode: 'TRANSPORT_NOT_CONFIGURED', unavailable: true }
    return { ok: false, provider: 'resend', errorCode: 'PROVIDER_ERROR', retriable: true }
  }
  if (input.channel === 'WHATSAPP') {
    return sendJson('meta-whatsapp-cloud', buildWhatsAppRequest(input), (payload) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
      const messages = (payload as Record<string, unknown>).messages
      if (!Array.isArray(messages) || !messages[0] || typeof messages[0] !== 'object') return undefined
      const id = (messages[0] as Record<string, unknown>).id
      return typeof id === 'string' ? id : undefined
    })
  }
  return sendJson(input.channel === 'SMS' ? 'sms-gateway' : 'push-gateway', buildGenericGatewayRequest(input.channel, input), (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
    const id = (payload as Record<string, unknown>).id
    return typeof id === 'string' ? id : undefined
  })
}

async function claimNextDelivery(): Promise<ClaimedDeliveryRow | null> {
  return db.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT delivery."id" FROM wewed_communications."CommunicationDelivery" delivery
      JOIN wewed_communications."CommunicationEndpoint" endpoint ON endpoint."id" = delivery."endpointId"
      JOIN wewed_communications."CommunicationPreference" preference ON preference."userId" = delivery."recipientUserId" AND preference."channel" = delivery."channel"
      WHERE delivery."status" = 'QUEUED' AND delivery."channel" IN ('EMAIL', 'WHATSAPP', 'SMS', 'PUSH')
        AND endpoint."status" = 'VERIFIED' AND preference."enabled" = true
        AND (delivery."nextAttemptAt" IS NULL OR delivery."nextAttemptAt" <= now())
      ORDER BY delivery."createdAt", delivery."id" FOR UPDATE OF delivery SKIP LOCKED LIMIT 1
    `)
    const id = candidates[0]?.id
    if (!id) return null
    await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationDelivery"
      SET "status" = 'PROCESSING', "attemptCount" = "attemptCount" + 1, "lastAttemptAt" = now(), "updatedAt" = now()
      WHERE "id" = ${id}
    `)
    const rows = await tx.$queryRaw<ClaimedDeliveryRow[]>(Prisma.sql`
      SELECT delivery."id", delivery."messageId", delivery."recipientUserId", delivery."channel", delivery."attemptCount", delivery."maxAttempts",
        endpoint."address", endpoint."normalizedAddress", message."body", message."conversationId",
        COALESCE(NULLIF(btrim(sender."name"), ''), sender."email", 'Wewed') AS "senderName"
      FROM wewed_communications."CommunicationDelivery" delivery
      JOIN wewed_communications."CommunicationEndpoint" endpoint ON endpoint."id" = delivery."endpointId"
      JOIN wewed_communications."CommunicationMessage" message ON message."id" = delivery."messageId"
      LEFT JOIN public."User" sender ON sender."id" = message."senderUserId"
      JOIN public."User" recipient ON recipient."id" = delivery."recipientUserId"
      WHERE delivery."id" = ${id} AND delivery."status" = 'PROCESSING' AND message."deletedAt" IS NULL
        AND (message."visibility" = 'PARTICIPANTS' OR recipient."role" = 'admin') LIMIT 1
    `)
    if (rows[0]) return rows[0]
    await tx.$executeRaw(Prisma.sql`UPDATE wewed_communications."CommunicationDelivery" SET "status" = 'SKIPPED', "errorCode" = 'RECIPIENT_NOT_AUTHORIZED', "updatedAt" = now() WHERE "id" = ${id}`)
    return null
  })
}

function retryDelaySeconds(attemptCount: number): number { return Math.min(3600, Math.max(15, 15 * (2 ** Math.max(0, attemptCount - 1)))) }

async function finishDelivery(delivery: ClaimedDeliveryRow, result: TransportResult) {
  const now = new Date()
  if (result.ok) {
    await db.$executeRaw(Prisma.sql`UPDATE wewed_communications."CommunicationDelivery" SET "status" = 'SENT', "provider" = ${result.provider}, "providerMessageId" = ${result.providerMessageId ?? null}, "errorCode" = NULL, "sentAt" = ${now}, "nextAttemptAt" = NULL, "updatedAt" = ${now} WHERE "id" = ${delivery.id} AND "status" = 'PROCESSING'`)
    return
  }
  if (result.unavailable) {
    await db.$executeRaw(Prisma.sql`UPDATE wewed_communications."CommunicationDelivery" SET "status" = 'SKIPPED', "provider" = ${result.provider}, "errorCode" = ${result.errorCode ?? 'TRANSPORT_NOT_CONFIGURED'}, "nextAttemptAt" = NULL, "updatedAt" = ${now} WHERE "id" = ${delivery.id} AND "status" = 'PROCESSING'`)
    return
  }
  const retry = result.retriable === true && delivery.attemptCount < delivery.maxAttempts
  const nextAttempt = retry ? new Date(now.getTime() + retryDelaySeconds(delivery.attemptCount) * 1000) : null
  await db.$executeRaw(Prisma.sql`UPDATE wewed_communications."CommunicationDelivery" SET "status" = ${retry ? 'QUEUED' : 'FAILED'}, "provider" = ${result.provider}, "errorCode" = ${result.errorCode ?? 'PROVIDER_ERROR'}, "nextAttemptAt" = ${nextAttempt}, "failedAt" = ${retry ? null : now}, "updatedAt" = ${now} WHERE "id" = ${delivery.id} AND "status" = 'PROCESSING'`)
}

export async function processQueuedCommunicationDeliveries(limit = 20) {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)))
  const results: Array<{ id: string; channel: ExternalCommunicationChannel; status: string }> = []
  for (let index = 0; index < safeLimit; index += 1) {
    const delivery = await claimNextDelivery()
    if (!delivery) break
    const result = await dispatchTransport(delivery)
    await finishDelivery(delivery, result)
    results.push({ id: delivery.id, channel: delivery.channel, status: result.ok ? 'SENT' : result.unavailable ? 'SKIPPED' : result.retriable && delivery.attemptCount < delivery.maxAttempts ? 'QUEUED' : 'FAILED' })
  }
  return { processed: results.length, deliveries: results }
}

function providerEventMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of ['reason', 'code', 'template', 'providerStatus']) {
    const item = source[key]
    if ((typeof item === 'string' && item.length <= 200) || typeof item === 'number' || typeof item === 'boolean') result[key] = item
  }
  return result
}

export async function applyCommunicationProviderStatus(input: { provider: string; channel: ExternalCommunicationChannel; providerEventId: string; providerMessageId: string; status: 'SENT' | 'DELIVERED' | 'FAILED'; metadata?: unknown }) {
  const now = new Date()
  return db.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO wewed_communications."CommunicationProviderEvent" ("id", "provider", "channel", "providerEventId", "direction", "eventType", "status", "metadata", "createdAt")
      VALUES (${randomUUID()}, ${input.provider}, ${input.channel}, ${input.providerEventId}, 'STATUS', ${input.status.toLowerCase()}, 'RECEIVED', ${JSON.stringify(providerEventMetadata(input.metadata))}::jsonb, ${now})
      ON CONFLICT ("provider", "providerEventId") DO NOTHING RETURNING "id"
    `)
    if (!inserted[0]) return { duplicate: true, updated: false }
    const deliveries = await tx.$queryRaw<Array<{ id: string; messageId: string; status: string }>>(Prisma.sql`
      SELECT "id", "messageId", "status" FROM wewed_communications."CommunicationDelivery"
      WHERE "provider" = ${input.provider} AND "providerMessageId" = ${input.providerMessageId} AND "channel" = ${input.channel}
      ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE
    `)
    const delivery = deliveries[0]
    if (!delivery) {
      await tx.$executeRaw(Prisma.sql`UPDATE wewed_communications."CommunicationProviderEvent" SET "status" = 'IGNORED', "processedAt" = ${now} WHERE "id" = ${inserted[0].id}`)
      return { duplicate: false, updated: false }
    }
    const nextStatus = delivery.status === 'DELIVERED' && input.status !== 'DELIVERED' ? 'DELIVERED' : input.status
    await tx.$executeRaw(Prisma.sql`
      UPDATE wewed_communications."CommunicationDelivery"
      SET "status" = ${nextStatus},
        "deliveredAt" = CASE WHEN ${nextStatus} = 'DELIVERED' THEN COALESCE("deliveredAt", ${now}) ELSE "deliveredAt" END,
        "failedAt" = CASE WHEN ${nextStatus} = 'FAILED' THEN COALESCE("failedAt", ${now}) ELSE "failedAt" END,
        "errorCode" = CASE WHEN ${nextStatus} = 'FAILED' THEN 'PROVIDER_REPORTED_FAILURE' ELSE NULL END,
        "updatedAt" = ${now} WHERE "id" = ${delivery.id}
    `)
    await tx.$executeRaw(Prisma.sql`UPDATE wewed_communications."CommunicationProviderEvent" SET "status" = 'PROCESSED', "deliveryId" = ${delivery.id}, "messageId" = ${delivery.messageId}, "processedAt" = ${now} WHERE "id" = ${inserted[0].id}`)
    return { duplicate: false, updated: true }
  })
}

export async function ingestInboundCommunicationReply(input: { provider: string; channel: ExternalCommunicationChannel; providerEventId: string; fromAddress: string; replyToProviderMessageId: string; body: unknown }) {
  const normalizedBody = normalizeCommunicationBody(input.body)
  if (!normalizedBody) throw new CommunicationError('Inbound message content is required.')
  const endpointAddress = normalizeCommunicationEndpoint(input.channel, input.fromAddress).normalizedAddress
  const eventHash = createHash('sha256').update(normalizedBody).digest('hex')
  const resolved = await db.$queryRaw<Array<{ deliveryId: string; conversationId: string; userId: string; email: string; name: string | null; role: string; coupleId: string | null; weddingId: string | null }>>(Prisma.sql`
    SELECT delivery."id" AS "deliveryId", message."conversationId", endpoint."userId", user_account."email", user_account."name", user_account."role", user_account."coupleId", conversation."weddingId"
    FROM wewed_communications."CommunicationDelivery" delivery
    JOIN wewed_communications."CommunicationEndpoint" endpoint ON endpoint."id" = delivery."endpointId" AND endpoint."userId" = delivery."recipientUserId" AND endpoint."status" = 'VERIFIED'
    JOIN public."User" user_account ON user_account."id" = endpoint."userId" AND user_account."isActive" = true
    JOIN wewed_communications."CommunicationMessage" message ON message."id" = delivery."messageId"
    JOIN wewed_communications."CommunicationConversation" conversation ON conversation."id" = message."conversationId"
    JOIN wewed_communications."CommunicationParticipant" participant ON participant."conversationId" = conversation."id" AND participant."userId" = endpoint."userId" AND participant."leftAt" IS NULL
    WHERE delivery."provider" = ${input.provider} AND delivery."providerMessageId" = ${input.replyToProviderMessageId} AND delivery."channel" = ${input.channel} AND endpoint."normalizedAddress" = ${endpointAddress}
    ORDER BY delivery."createdAt" DESC LIMIT 1
  `)
  const target = resolved[0]
  if (!target || !isDashboardRole(target.role)) throw new CommunicationError('Inbound reply could not be associated with a verified Wewed participant.', 404)
  const eventId = randomUUID()
  const inserted = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO wewed_communications."CommunicationProviderEvent" ("id", "provider", "channel", "providerEventId", "direction", "eventType", "status", "deliveryId", "metadata")
    VALUES (${eventId}, ${input.provider}, ${input.channel}, ${input.providerEventId}, 'INBOUND', 'reply', 'RECEIVED', ${target.deliveryId}, ${JSON.stringify({ bodySha256: eventHash })}::jsonb)
    ON CONFLICT ("provider", "providerEventId") DO NOTHING RETURNING "id"
  `)
  if (!inserted[0]) return { duplicate: true, messageId: null }
  const actor: CommunicationActor = { userId: target.userId, email: target.email, name: target.name?.trim() || target.email, role: target.role, coupleId: target.coupleId, activeWeddingId: target.weddingId ?? '' }
  try {
    const message = await sendCommunicationMessage(actor, target.conversationId, { body: normalizedBody })
    await db.$executeRaw(Prisma.sql`UPDATE wewed_communications."CommunicationProviderEvent" SET "status" = 'PROCESSED', "messageId" = ${message.id}, "processedAt" = now() WHERE "id" = ${eventId}`)
    return { duplicate: false, messageId: message.id }
  } catch (error) {
    await db.$executeRaw(Prisma.sql`UPDATE wewed_communications."CommunicationProviderEvent" SET "status" = 'FAILED', "processedAt" = now() WHERE "id" = ${eventId}`)
    throw error
  }
}