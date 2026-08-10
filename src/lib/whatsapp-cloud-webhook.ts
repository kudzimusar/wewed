import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export type NormalizedWhatsAppDeliveryStatus = 'SENT' | 'DELIVERED' | 'FAILED'

export interface NormalizedWhatsAppStatusEvent {
  providerEventId: string
  providerMessageId: string
  status: NormalizedWhatsAppDeliveryStatus
  metadata: {
    providerStatus: 'sent' | 'delivered' | 'read' | 'failed'
    code?: number
    reason?: string
  }
}

export interface NormalizedWhatsAppInboundReply {
  providerEventId: string
  fromAddress: string
  replyToProviderMessageId: string | null
  body: string
}

export interface NormalizedWhatsAppWebhook {
  statuses: NormalizedWhatsAppStatusEvent[]
  inboundReplies: NormalizedWhatsAppInboundReply[]
  ignoredInboundCount: number
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyWhatsAppWebhookToken(providedToken: string | null): boolean {
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()
  if (!expectedToken || !providedToken) return false
  return constantTimeEquals(expectedToken, providedToken)
}

export function verifyWhatsAppWebhookSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.WHATSAPP_WEBHOOK_APP_SECRET?.trim()
  if (!appSecret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
  return constantTimeEquals(expected, signature.toLowerCase())
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function deterministicEventId(prefix: 'status' | 'inbound', parts: Array<string | null>): string {
  const digest = createHash('sha256').update(parts.map((part) => part ?? '').join('\u001f')).digest('hex')
  return `wa-${prefix}:${digest}`
}

function normalizeStatus(statusValue: string): NormalizedWhatsAppDeliveryStatus | null {
  if (statusValue === 'sent') return 'SENT'
  if (statusValue === 'delivered' || statusValue === 'read') return 'DELIVERED'
  if (statusValue === 'failed') return 'FAILED'
  return null
}

function failureMetadata(status: Record<string, unknown>) {
  const errors = Array.isArray(status.errors) ? status.errors : []
  const firstError = record(errors[0])
  const code = typeof firstError?.code === 'number' ? firstError.code : undefined
  const reason = stringValue(firstError?.title)
    ?? stringValue(firstError?.message)
    ?? stringValue(record(firstError?.error_data)?.details)
    ?? undefined
  return { code, reason: reason?.slice(0, 200) }
}

export function normalizeWhatsAppWebhookPayload(payload: unknown): NormalizedWhatsAppWebhook {
  const result: NormalizedWhatsAppWebhook = {
    statuses: [],
    inboundReplies: [],
    ignoredInboundCount: 0,
  }
  const root = record(payload)
  if (!root || root.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) return result

  for (const entryValue of root.entry) {
    const entry = record(entryValue)
    if (!entry || !Array.isArray(entry.changes)) continue
    const wabaId = stringValue(entry.id)

    for (const changeValue of entry.changes) {
      const change = record(changeValue)
      if (!change || change.field !== 'messages') continue
      const value = record(change.value)
      if (!value) continue
      const metadata = record(value.metadata)
      const phoneNumberId = stringValue(metadata?.phone_number_id)

      if (Array.isArray(value.statuses)) {
        for (const statusValue of value.statuses) {
          const status = record(statusValue)
          if (!status) continue
          const providerMessageId = stringValue(status.id)
          const providerStatus = stringValue(status.status)
          const timestamp = stringValue(status.timestamp)
          if (!providerMessageId || !providerStatus) continue
          const normalizedStatus = normalizeStatus(providerStatus)
          if (!normalizedStatus) continue
          if (!['sent', 'delivered', 'read', 'failed'].includes(providerStatus)) continue
          const failure = providerStatus === 'failed' ? failureMetadata(status) : {}
          result.statuses.push({
            providerEventId: deterministicEventId('status', [
              wabaId,
              phoneNumberId,
              providerMessageId,
              providerStatus,
              timestamp,
            ]),
            providerMessageId,
            status: normalizedStatus,
            metadata: {
              providerStatus: providerStatus as 'sent' | 'delivered' | 'read' | 'failed',
              ...failure,
            },
          })
        }
      }

      if (Array.isArray(value.messages)) {
        for (const messageValue of value.messages) {
          const message = record(messageValue)
          if (!message) continue
          const type = stringValue(message.type)
          const providerInboundMessageId = stringValue(message.id)
          const fromAddress = stringValue(message.from)
          const context = record(message.context)
          const replyToProviderMessageId = stringValue(context?.id)
          const text = record(message.text)
          const body = stringValue(text?.body)

          if (
            type !== 'text'
            || !providerInboundMessageId
            || !fromAddress
            || !body
          ) {
            result.ignoredInboundCount += 1
            continue
          }

          result.inboundReplies.push({
            providerEventId: deterministicEventId('inbound', [
              wabaId,
              phoneNumberId,
              providerInboundMessageId,
            ]),
            fromAddress,
            replyToProviderMessageId,
            body,
          })
        }
      }
    }
  }

  return result
}
