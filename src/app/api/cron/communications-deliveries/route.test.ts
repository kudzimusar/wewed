import { afterEach, describe, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/cron/communications-deliveries/route'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
})

describe('communications cron HTTP boundary', () => {
  test('fails closed when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(new NextRequest(
      'https://wewed.pro/api/cron/communications-deliveries',
    ))
    expect(response.status).toBe(503)
  })

  test('rejects a missing or incorrect bearer secret', async () => {
    process.env.CRON_SECRET = 'cron-secret'

    const missing = await GET(new NextRequest(
      'https://wewed.pro/api/cron/communications-deliveries',
    ))
    expect(missing.status).toBe(404)

    const incorrect = await GET(new NextRequest(
      'https://wewed.pro/api/cron/communications-deliveries',
      { headers: { authorization: 'Bearer wrong-secret' } },
    ))
    expect(incorrect.status).toBe(404)
  })

  test('runs the queue worker for an authorized cron request', async () => {
    process.env.CRON_SECRET = 'cron-secret'
    const response = await GET(new NextRequest(
      'https://wewed.pro/api/cron/communications-deliveries',
      { headers: { authorization: 'Bearer cron-secret' } },
    ))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: { processed: 0, deliveries: [] },
    })
  })
})
