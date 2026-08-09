import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { applyCommunicationProviderStatus } from '@/lib/communication-channels'

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

type ResendEventTags = Record<string, string> | Array<{ name?: unknown; value?: unknown }>

export type ResendWebhookEvent = {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    tags?: ResendEventTags
    [key: string]: unknown
  }
  [key: string]: unknown
}

function signingKey(secret: string): Buffer {
  const value = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  return Buffer.from(value, 'base64')
}

function signatureMatches(expected: Buffer, signatureHeader: string): boolean {
  return signatureHeader.split(' ').some((entry) => {
    const [version, encoded] = entry.split(',', 2)
    if (version !== 'v1' || !encoded) return false
    try {
      const supplied = Buffer.from(encoded, 'base64')
      return supplied.length === expected.length && timingSafeEqual(supplied, expected)
    } catch {
      return false
    }
  })
}

export function verifyResendWebhook(input: {
  payload: string
  id: string | null
  timestamp: string | null
  signature: string | null
}): ResendWebhookEvent {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) throw new Error('Resend webhook signing secret is not configured.')
  if (!input.id || !input.timestamp || !input.signature) throw new Error('Missing Resend webhook signature headers.')

  const timestamp = Number(input.timestamp)
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error('Resend webhook timestamp is outside the accepted tolerance.')
  }

  const signedContent = `${input.id}.${input.timestamp}.${input.payload}`
  const expected = createHmac('sha256', signingKey(secret)).update(signedContent).digest()
  if (!signatureMatches(expected, input.signature)) throw new Error('Invalid Resend webhook signature.')

  const parsed = JSON.parse(input.payload) as ResendWebhookEvent
  if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
    throw new Error('Invalid Resend webhook payload.')
  }
  return parsed
}

function eventTag(event: ResendWebhookEvent, key: string): string | null {
  const tags = event.data?.tags
  if (!tags) return null
  if (Array.isArray(tags)) {
    const match = tags.find((tag) => tag?.name === key && typeof tag.value === 'string')
    return match && typeof match.value === 'string' ? match.value : null
  }
  const value = tags[key]
  return typeof value === 'string' ? value : null
}

export function isWewedResendEvent(event: ResendWebhookEvent): boolean {
  return eventTag(event, 'application') === 'wewed'
}

function eventTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null
  return value
}

function statusForEvent(type: string): { status?: string; timestampColumn?: string } {
  switch (type) {
    case 'email.sent': return { status: 'sent', timestampColumn: 'sentAt' }
    case 'email.delivered': return { status: 'delivered', timestampColumn: 'deliveredAt' }
    case 'email.delivery_delayed': return { status: 'delayed', timestampColumn: 'delayedAt' }
    case 'email.bounced': return { status: 'bounced', timestampColumn: 'bouncedAt' }
    case 'email.complained': return { status: 'complained', timestampColumn: 'complainedAt' }
    case 'email.failed': return { status: 'failed', timestampColumn: 'failedAt' }
    default: return {}
  }
}

function communicationStatusForEvent(type: string): 'SENT' | 'DELIVERED' | 'FAILED' | null {
  switch (type) {
    case 'email.sent': return 'SENT'
    case 'email.delivered': return 'DELIVERED'
    case 'email.bounced':
    case 'email.complained':
    case 'email.failed':
    case 'email.suppressed':
      return 'FAILED'
    default:
      return null
  }
}

export async function recordResendWebhook(input: {
  webhookId: string
  event: ResendWebhookEvent
}): Promise<{ duplicate: boolean; ignored: boolean; deliveryId: string | null }> {
  if (!isWewedResendEvent(input.event)) {
    return { duplicate: false, ignored: true, deliveryId: null }
  }

  const providerEmailId = typeof input.event.data?.email_id === 'string' ? input.event.data.email_id : null
  const createdAt = eventTimestamp(input.event.created_at)
  const communicationDeliveryId = eventTag(input.event, 'communication_delivery_id')

  const deliveryRows = providerEmailId
    ? await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM wewed_admin."EmailDelivery" WHERE "providerEmailId" = $1 LIMIT 1`,
        providerEmailId,
      )
    : []
  const deliveryId = deliveryRows[0]?.id ?? null

  const inserted = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO wewed_admin."EmailWebhookEvent"
      ("id", "provider", "eventType", "providerEmailId", "deliveryId", "payload", "eventCreatedAt")
     VALUES ($1, 'resend', $2, $3, $4, $5::jsonb, $6::timestamptz)
     ON CONFLICT ("id") DO NOTHING
     RETURNING "id"`,
    input.webhookId,
    input.event.type,
    providerEmailId,
    deliveryId,
    JSON.stringify(input.event),
    createdAt,
  )

  if (inserted.length === 0) return { duplicate: true, ignored: false, deliveryId }

  if (deliveryId) {
    const state = statusForEvent(input.event.type)
    const occurredAt = createdAt ?? new Date().toISOString()
    if (state.status && state.timestampColumn) {
      const allowedColumns = new Set(['sentAt', 'deliveredAt', 'delayedAt', 'bouncedAt', 'complainedAt', 'failedAt'])
      if (!allowedColumns.has(state.timestampColumn)) throw new Error('Unsupported email delivery timestamp column.')
      await db.$executeRawUnsafe(
        `UPDATE wewed_admin."EmailDelivery"
            SET "status" = $2,
                "${state.timestampColumn}" = $3::timestamptz,
                "lastEventAt" = $3::timestamptz,
                "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1`,
        deliveryId,
        state.status,
        occurredAt,
      )
    } else {
      await db.$executeRawUnsafe(
        `UPDATE wewed_admin."EmailDelivery"
            SET "lastEventAt" = $2::timestamptz,
                "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1`,
        deliveryId,
        occurredAt,
      )
    }
  }

  const communicationStatus = communicationStatusForEvent(input.event.type)
  if (communicationDeliveryId && providerEmailId && communicationStatus) {
    await applyCommunicationProviderStatus({
      provider: 'resend',
      channel: 'EMAIL',
      providerEventId: input.webhookId,
      providerMessageId: providerEmailId,
      status: communicationStatus,
      metadata: { providerStatus: input.event.type },
    })
  }

  return { duplicate: false, ignored: false, deliveryId }
}
