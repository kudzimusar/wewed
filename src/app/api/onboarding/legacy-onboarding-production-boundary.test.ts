import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { POST } from './route'

describe('legacy onboarding production boundary', () => {
  const original = {
    nodeEnv: process.env.NODE_ENV,
    e2e: process.env.WEWED_E2E_MODE,
    ci: process.env.CI,
    vercel: process.env.VERCEL,
    databaseUrl: process.env.DATABASE_URL,
  }

  beforeEach(() => {
    process.env.NODE_ENV = 'production'
    delete process.env.WEWED_E2E_MODE
    process.env.CI = 'true'
    process.env.VERCEL = '1'
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/should-never-be-used'
  })

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    restore('NODE_ENV', original.nodeEnv)
    restore('WEWED_E2E_MODE', original.e2e)
    restore('CI', original.ci)
    restore('VERCEL', original.vercel)
    restore('DATABASE_URL', original.databaseUrl)
  })

  test('real production fails closed before legacy graph creation can begin', async () => {
    const response = await POST(new NextRequest('https://wewed.pro/api/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        partner1: 'Legacy',
        partner2: 'Probe',
        weddingDate: '2027-01-01',
        venue: 'Should Never Write',
        venueCity: 'Harare',
        venueCountry: 'Zimbabwe',
        email: 'legacy-probe@example.test',
        password: 'legacy-password',
      }),
    }))

    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({
      success: false,
      error: 'This registration path is no longer available. Create an account through the current registration flow.',
    })
  })
})
