import { describe, expect, test } from 'bun:test'
import { normalizeWhatsAppWebhookPayload } from '@/lib/whatsapp-cloud-webhook'

describe('WhatsApp non-context inbound contract', () => {
  test('preserves missing context for safe active-conversation resolution', () => {
    const normalized = normalizeWhatsAppWebhookPayload({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba-1',
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'phone-1' },
            messages: [{
              from: '263771234567',
              id: 'wamid.non-context',
              type: 'text',
              text: { body: 'A normal WhatsApp follow-up.' },
            }],
          },
        }],
      }],
    })

    expect(normalized.inboundReplies).toHaveLength(1)
    expect(normalized.inboundReplies[0]?.replyToProviderMessageId).toBeNull()
    expect(normalized.ignoredInboundCount).toBe(0)
  })
})
