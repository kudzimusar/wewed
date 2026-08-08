import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'

const RESEND_API_URL = 'https://api.resend.com/emails'

type EmailTag = { name: string; value: string }

export type TransactionalEmailInput = {
  idempotencyKey: string
  category: string
  to: string
  subject: string
  html: string
  text: string
  metadata?: Record<string, unknown>
  tags?: EmailTag[]
}

export type TransactionalEmailResult =
  | { ok: true; deliveryId: string; providerEmailId: string; duplicate: boolean }
  | { ok: false; deliveryId: string; reason: 'not_configured' | 'provider_error' }

type DeliveryRow = {
  id: string
  status: string
  providerEmailId: string | null
}

function configuredResend() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.WEWED_EMAIL_FROM?.trim()
  const replyTo = process.env.WEWED_EMAIL_REPLY_TO?.trim()
  if (!apiKey || !from || !replyTo) return null
  return { apiKey, from, replyTo }
}

function safeTagPart(value: string, fallback: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 256)
  return normalized || fallback
}

function safeError(value: unknown): string {
  if (value instanceof Error) return value.message.slice(0, 1000)
  return String(value || 'Unknown Resend error').slice(0, 1000)
}

async function ensureDelivery(input: TransactionalEmailInput): Promise<DeliveryRow> {
  const id = randomUUID()
  const key = input.idempotencyKey.slice(0, 256)
  const metadata = JSON.stringify(input.metadata ?? {})

  await db.$executeRawUnsafe(
    `INSERT INTO wewed_admin."EmailDelivery"
      ("id", "internalKey", "provider", "category", "recipient", "subject", "status", "metadata")
     VALUES ($1, $2, 'resend', $3, $4, $5, 'queued', $6::jsonb)
     ON CONFLICT ("internalKey") DO NOTHING`,
    id,
    key,
    input.category,
    input.to,
    input.subject,
    metadata,
  )

  const rows = await db.$queryRawUnsafe<DeliveryRow[]>(
    `SELECT "id", "status", "providerEmailId"
       FROM wewed_admin."EmailDelivery"
      WHERE "internalKey" = $1
      LIMIT 1`,
    key,
  )

  if (!rows[0]) throw new Error('Unable to create email delivery audit record.')
  return rows[0]
}

async function markNotConfigured(deliveryId: string): Promise<void> {
  await db.$executeRawUnsafe(
    `UPDATE wewed_admin."EmailDelivery"
        SET "status" = 'not_configured',
            "failureReason" = 'Resend production credentials, sender, or reply-to are not configured.',
            "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1`,
    deliveryId,
  )
}

async function markFailed(deliveryId: string, reason: string): Promise<void> {
  await db.$executeRawUnsafe(
    `UPDATE wewed_admin."EmailDelivery"
        SET "status" = 'failed',
            "failureReason" = $2,
            "failedAt" = CURRENT_TIMESTAMP,
            "lastEventAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1`,
    deliveryId,
    reason,
  )
}

export async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<TransactionalEmailResult> {
  const delivery = await ensureDelivery(input)

  if (delivery.providerEmailId && ['sent', 'delivered'].includes(delivery.status)) {
    return {
      ok: true,
      deliveryId: delivery.id,
      providerEmailId: delivery.providerEmailId,
      duplicate: true,
    }
  }

  const config = configuredResend()
  if (!config) {
    await markNotConfigured(delivery.id)
    return { ok: false, deliveryId: delivery.id, reason: 'not_configured' }
  }

  const tags: EmailTag[] = [
    { name: 'category', value: safeTagPart(input.category, 'transactional') },
    { name: 'delivery_id', value: safeTagPart(delivery.id, 'unknown') },
    ...(input.tags ?? []).map((tag) => ({
      name: safeTagPart(tag.name, 'tag'),
      value: safeTagPart(tag.value, 'value'),
    })),
  ]

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: config.replyTo,
        tags,
      }),
      cache: 'no-store',
    })

    const body = (await response.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null
    const providerEmailId = body?.id?.trim()

    if (!response.ok || !providerEmailId) {
      const reason = `Resend ${response.status}: ${body?.message || body?.name || 'send failed'}`.slice(0, 1000)
      await markFailed(delivery.id, reason)
      console.error('[email/resend] Send failed:', reason)
      return { ok: false, deliveryId: delivery.id, reason: 'provider_error' }
    }

    await db.$executeRawUnsafe(
      `UPDATE wewed_admin."EmailDelivery"
          SET "providerEmailId" = $2,
              "sender" = $3,
              "replyTo" = $4,
              "status" = 'sent',
              "failureReason" = NULL,
              "sentAt" = CURRENT_TIMESTAMP,
              "lastEventAt" = CURRENT_TIMESTAMP,
              "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1`,
      delivery.id,
      providerEmailId,
      config.from,
      config.replyTo,
    )

    return { ok: true, deliveryId: delivery.id, providerEmailId, duplicate: false }
  } catch (error) {
    const reason = safeError(error)
    await markFailed(delivery.id, reason)
    console.error('[email/resend] Unexpected send failure:', reason)
    return { ok: false, deliveryId: delivery.id, reason: 'provider_error' }
  }
}
