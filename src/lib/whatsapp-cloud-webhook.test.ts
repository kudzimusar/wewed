import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  normalizeWhatsAppWebhookPayload,
  verifyWhatsAppWebhookSignature,
  verifyWhatsAppWebhookToken,
} from '@/lib/whatsapp-cloud-webhook'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
})

describe('WhatsApp webhook verification', () => {
  test('verifies the configured challenge token exactly', () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-secret'
    expect(verifyWhatsAppWebhookToken('verify-secret')).toBe(true)
    expect(verifyWhatsAppWebhookToken('verify-secret-extra')).toBe(false)
    expect(verifyWhatsAppWebhookToken(null)).toBe(false)
  })

  test('verifies X-Hub-Signature-256 over the raw request body', () => {
    process.env.WHATSAPP_WEBHOOK_APP_SECRET = 'app-secret'
    const rawBody = '{"object":"whatsapp_business_account","entry":[]}'
    const signature = `sha256=${createHmac('sha256', 'app-secret').update(rawBody).digest('hex')}`
    expect(verifyWhatsAppWebhookSignature(rawBody, signature)).toBe(true)
    expect(verifyWhatsAppWebhookSignature(`${rawBody} `, signature)).toBe(false)
    expect(verifyWhatsAppWebhookSignature(rawBody, 'sha256=bad')).toBe(false)
    expect(verifyWhatsAppWebhookSignature(rawBody, null)).toBe(false)
  })
})

describe('WhatsApp webhook normalization', () => {
  test('normalizes sent, delivered, read and failed statuses without endpoint data', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba-1',
        changes: [{
          field: 'messages',
          value: {
            metadata: {
              display_phone_number: '+1 555 000 0000',
              phone_number_id: 'phone-1',
            },
            statuses: [
              { id: 'wamid.sent', status: 'sent', timestamp: '100', recipient_id: '263770000001' },
              { id: 'wamid.delivered', status: 'delivered', timestamp: '101', recipient_id: '263770000002' },
              { id: 'wamid.read', status: 'read', timestamp: '102', recipient_id: '263770000003' },
              {
                id: 'wamid.failed',
                status: 'failed',
                timestamp: '103',
                recipient_id: '263770000004',
                errors: [{ code: 131047, title: 'Re-engagement message required' }],
              },
              { id: 'wamid.deleted', status: 'deleted', timestamp: '104', recipient_id: '263770000005' },
            ],
          },
        }],
      }],
    }

    const normalized = normalizeWhatsAppWebhookPayload(payload)
    expect(normalized.statuses.map((event) => event.status)).toEqual([
      'SENT',
      'DELIVERED',
      'DELIVERED',
      'FAILED',
    ])
    expect(normalized.statuses[2]?.metadata.providerStatus).toBe('read')
    expect(normalized.statuses[3]?.metadata).toEqual({
      providerStatus: 'failed',
      code: 131047,
      reason: 'Re-engagement message required',
    })
    expect(JSON.stringify(normalized.statuses)).not.toContain('263770000001')
    expect(JSON.stringify(normalized.statuses)).not.toContain('+1 555 000 0000')
  })

  test('derives deterministic provider event IDs for webhook retries', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba-1',
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'phone-1' },
            statuses: [{ id: 'wamid.1', status: 'delivered', timestamp: '100' }],
          },
        }],
      }],
    }
    const first = normalizeWhatsAppWebhookPayload(payload)
    const second = normalizeWhatsAppWebhookPayload(payload)
    expect(first.statuses[0]?.providerEventId).toBe(second.statuses[0]?.providerEventId)
  })

  test('accepts only contextual inbound text replies and never guesses a conversation', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba-1',
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'phone-1' },
            messages: [
              {
                from: '263771234567',
                id: 'wamid.inbound-contextual',
                timestamp: '200',
                type: 'text',
                context: { id: 'wamid.outbound' },
                text: { body: 'I have confirmed it.' },
              },
              {
                from: '263771234567',
                id: 'wamid.inbound-unscoped',
                timestamp: '201',
                type: 'text',
                text: { body: 'Which wedding is this?' },
              },
              {
                from: '263771234567',
                id: 'wamid.inbound-image',
                timestamp: '202',
                type: 'image',
                context: { id: 'wamid.outbound' },
                image: { id: 'media-1' },
              },
            ],
          },
        }],
      }],
    }

    const normalized = normalizeWhatsAppWebhookPayload(payload)
    expect(normalized.inboundReplies).toHaveLength(1)
    expect(normalized.inboundReplies[0]).toMatchObject({
      fromAddress: '263771234567',
      replyToProviderMessageId: 'wamid.outbound',
      body: 'I have confirmed it.',
    })
    expect(normalized.ignoredInboundCount).toBe(2)
  })

  test('ignores payloads that are not WhatsApp Business Account message webhooks', () => {
    expect(normalizeWhatsAppWebhookPayload({ object: 'page', entry: [] })).toEqual({
      statuses: [],
      inboundReplies: [],
      ignoredInboundCount: 0,
    })
  })
})
