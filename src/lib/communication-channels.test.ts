import { afterEach, describe, expect, test } from 'bun:test'
import {
  buildCommunicationEmail,
  buildWhatsAppRequest,
  communicationDispatchAuthorized,
  normalizeCommunicationEndpoint,
} from '@/lib/communication-channels'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
})

const delivery = {
  id: 'delivery-1',
  messageId: 'message-1',
  recipientUserId: 'user-2',
  channel: 'EMAIL' as const,
  attemptCount: 1,
  maxAttempts: 5,
  address: 'Planner@example.test',
  normalizedAddress: 'planner@example.test',
  body: 'Please confirm the ceremony timeline.',
  conversationId: 'conversation-1',
  senderName: 'Amina',
}

describe('communication endpoint normalization', () => {
  test('normalizes email addresses', () => {
    expect(normalizeCommunicationEndpoint('EMAIL', ' Planner@Example.Test ')).toEqual({
      address: 'Planner@Example.Test',
      normalizedAddress: 'planner@example.test',
    })
  })

  test('normalizes international phone numbers', () => {
    expect(normalizeCommunicationEndpoint('WHATSAPP', '+263 77 123 4567').normalizedAddress)
      .toBe('+263771234567')
    expect(normalizeCommunicationEndpoint('SMS', '263-77-123-4567').normalizedAddress)
      .toBe('+263771234567')
  })

  test('rejects invalid phone endpoints', () => {
    expect(() => normalizeCommunicationEndpoint('WHATSAPP', '123')).toThrow()
  })
})

describe('communication provider request builders', () => {
  test('builds deterministic email content for the existing transactional sender', () => {
    process.env.WEWED_APP_URL = 'https://wewed.pro'
    const content = buildCommunicationEmail(delivery)
    expect(content.subject).toContain('Amina')
    expect(content.text).toContain('Please confirm the ceremony timeline.')
    expect(content.text).toContain('https://wewed.pro/messages')
    expect(content.html).toContain('Open Wewed')
  })

  test('WhatsApp stays disabled until the Meta binding is configured', () => {
    delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN
    delete process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID
    delete process.env.WHATSAPP_CLOUD_GRAPH_VERSION
    delete process.env.WEWED_WHATSAPP_NOTIFICATION_TEMPLATE
    expect(buildWhatsAppRequest({
      ...delivery,
      channel: 'WHATSAPP',
      address: '+263771234567',
      normalizedAddress: '+263771234567',
    })).toBeNull()
  })

  test('fails closed when proactive Meta transport lacks an approved template', () => {
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'meta-test-secret'
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = 'phone-number-id'
    process.env.WHATSAPP_CLOUD_GRAPH_VERSION = 'v26.0'
    process.env.WEWED_WHATSAPP_TEST_MODE = 'false'
    delete process.env.WEWED_WHATSAPP_NOTIFICATION_TEMPLATE
    expect(buildWhatsAppRequest({
      ...delivery,
      channel: 'WHATSAPP',
      address: '+263771234567',
      normalizedAddress: '+263771234567',
    })).toBeNull()
  })

  test('builds a privacy-preserving production WhatsApp template request using sender name only', () => {
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'meta-test-secret'
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = 'phone-number-id'
    process.env.WHATSAPP_CLOUD_GRAPH_VERSION = 'v26.0'
    process.env.WEWED_WHATSAPP_TEST_MODE = 'false'
    process.env.WEWED_WHATSAPP_NOTIFICATION_TEMPLATE = 'wewed_new_message_v1'
    process.env.WEWED_WHATSAPP_TEMPLATE_LANGUAGE = 'en_US'
    const request = buildWhatsAppRequest({
      ...delivery,
      channel: 'WHATSAPP',
      address: '+263771234567',
      normalizedAddress: '+263771234567',
    })
    expect(request?.url).toBe('https://graph.facebook.com/v26.0/phone-number-id/messages')
    expect(request?.headers.Authorization).toBe('Bearer meta-test-secret')
    expect(request?.body).toEqual({
      messaging_product: 'whatsapp',
      to: '263771234567',
      type: 'template',
      template: {
        name: 'wewed_new_message_v1',
        language: { code: 'en_US' },
        components: [{
          type: 'body',
          parameters: [{ type: 'text', text: 'Amina' }],
        }],
      },
    })
    expect(JSON.stringify(request?.body)).not.toContain('Please confirm the ceremony timeline.')
  })

  test('uses hello_world without parameters only for an allowlisted test recipient', () => {
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'meta-test-secret'
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = 'phone-number-id'
    process.env.WHATSAPP_CLOUD_GRAPH_VERSION = 'v26.0'
    process.env.WEWED_WHATSAPP_TEMPLATE_LANGUAGE = 'en_US'
    process.env.WEWED_WHATSAPP_TEST_MODE = 'true'
    process.env.WEWED_WHATSAPP_TEST_TEMPLATE = 'hello_world'
    process.env.WEWED_WHATSAPP_TEST_RECIPIENTS = '+81 80-8120-1356, +263771111111'
    process.env.WEWED_WHATSAPP_NOTIFICATION_TEMPLATE = 'wewed_new_message_v1'

    const request = buildWhatsAppRequest({
      ...delivery,
      channel: 'WHATSAPP',
      address: '+81 80-8120-1356',
      normalizedAddress: '+818081201356',
    })

    expect(request?.body).toEqual({
      messaging_product: 'whatsapp',
      to: '818081201356',
      type: 'template',
      template: {
        name: 'hello_world',
        language: { code: 'en_US' },
      },
    })
    expect(JSON.stringify(request?.body)).not.toContain('Amina')
    expect(JSON.stringify(request?.body)).not.toContain('Please confirm the ceremony timeline.')
  })

  test('test mode fails closed for a recipient outside the explicit allowlist', () => {
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'meta-test-secret'
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = 'phone-number-id'
    process.env.WHATSAPP_CLOUD_GRAPH_VERSION = 'v26.0'
    process.env.WEWED_WHATSAPP_TEST_MODE = 'true'
    process.env.WEWED_WHATSAPP_TEST_TEMPLATE = 'hello_world'
    process.env.WEWED_WHATSAPP_TEST_RECIPIENTS = '+818081201356'
    process.env.WEWED_WHATSAPP_NOTIFICATION_TEMPLATE = 'wewed_new_message_v1'

    expect(buildWhatsAppRequest({
      ...delivery,
      channel: 'WHATSAPP',
      address: '+263771234567',
      normalizedAddress: '+263771234567',
    })).toBeNull()
  })

  test('test mode fails closed when its template or allowlist is incomplete', () => {
    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = 'meta-test-secret'
    process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = 'phone-number-id'
    process.env.WHATSAPP_CLOUD_GRAPH_VERSION = 'v26.0'
    process.env.WEWED_WHATSAPP_TEST_MODE = 'true'
    process.env.WEWED_WHATSAPP_TEST_RECIPIENTS = '+818081201356'
    delete process.env.WEWED_WHATSAPP_TEST_TEMPLATE

    expect(buildWhatsAppRequest({
      ...delivery,
      channel: 'WHATSAPP',
      address: '+81 80-8120-1356',
      normalizedAddress: '+818081201356',
    })).toBeNull()

    process.env.WEWED_WHATSAPP_TEST_TEMPLATE = 'hello_world'
    delete process.env.WEWED_WHATSAPP_TEST_RECIPIENTS

    expect(buildWhatsAppRequest({
      ...delivery,
      channel: 'WHATSAPP',
      address: '+81 80-8120-1356',
      normalizedAddress: '+818081201356',
    })).toBeNull()
  })
})

describe('internal dispatch authentication', () => {
  test('fails closed without a configured server key', () => {
    delete process.env.WEWED_COMMUNICATIONS_DISPATCH_KEY
    expect(communicationDispatchAuthorized('anything')).toBe(false)
  })

  test('uses exact constant-time key matching', () => {
    process.env.WEWED_COMMUNICATIONS_DISPATCH_KEY = 'dispatch-secret'
    expect(communicationDispatchAuthorized('dispatch-secret')).toBe(true)
    expect(communicationDispatchAuthorized('wrong-secret')).toBe(false)
  })
})