import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/webhooks/whatsapp/route'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
})

describe('WhatsApp webhook HTTP boundary', () => {
  test('returns Meta challenge only for the configured verification token', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-secret'
    const accepted = await GET(new NextRequest(
      'https://wewed.pro/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-secret&hub.challenge=challenge-123',
    ))
    expect(accepted.status).toBe(200)
    expect(await accepted.text()).toBe('challenge-123')

    const rejected = await GET(new NextRequest(
      'https://wewed.pro/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123',
    ))
    expect(rejected.status).toBe(403)
  })

  test('fails closed when webhook verification is not configured', async () => {
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
    const response = await GET(new NextRequest(
      'https://wewed.pro/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=anything&hub.challenge=challenge-123',
    ))
    expect(response.status).toBe(503)
  })

  test('rejects an invalid signature before payload processing', async () => {
    process.env.WHATSAPP_WEBHOOK_APP_SECRET = 'app-secret'
    const response = await POST(new NextRequest('https://wewed.pro/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'x-hub-signature-256': `sha256=${'0'.repeat(64)}` },
      body: '{"object":"whatsapp_business_account","entry":[]}',
    }))
    expect(response.status).toBe(401)
  })

  test('accepts a correctly signed no-op WhatsApp Business Account payload', async () => {
    process.env.WHATSAPP_WEBHOOK_APP_SECRET = 'app-secret'
    const body = '{"object":"whatsapp_business_account","entry":[]}'
    const signature = `sha256=${createHmac('sha256', 'app-secret').update(body).digest('hex')}`
    const response = await POST(new NextRequest('https://wewed.pro/api/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signature },
      body,
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      statuses: 0,
      inboundReplies: 0,
      ignoredInbound: 0,
    })
  })
})
