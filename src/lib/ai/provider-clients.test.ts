import { afterEach, describe, expect, test } from 'bun:test'
import { getAiSettings } from '@/lib/ai/config'
import {
  AiProviderRequestError,
  callAiProvider,
} from '@/lib/ai/provider-clients'

const originalFetch = globalThis.fetch
const originalEnv = {
  ZAI_API_KEY: process.env.ZAI_API_KEY,
  ZAI_MODEL: process.env.ZAI_MODEL,
  AI_PROVIDER_MAX_RETRIES: process.env.AI_PROVIDER_MAX_RETRIES,
  AI_PRIVATE_PROVIDER: process.env.AI_PRIVATE_PROVIDER,
  AI_QUALITY_PROVIDER: process.env.AI_QUALITY_PROVIDER,
  AI_FALLBACK_PROVIDER: process.env.AI_FALLBACK_PROVIDER,
}

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('GLM-first routing defaults', () => {
  test('uses Z.AI for private and quality traffic with Groq fallback', () => {
    delete process.env.AI_PRIVATE_PROVIDER
    delete process.env.AI_QUALITY_PROVIDER
    delete process.env.AI_FALLBACK_PROVIDER

    const settings = getAiSettings()
    expect(settings.privateProvider).toBe('zai')
    expect(settings.qualityProvider).toBe('zai')
    expect(settings.fallbackProvider).toBe('groq')
    expect(settings.allowPrivateFallback).toBe(false)
  })
})

describe('Z.AI provider error handling', () => {
  test('preserves balance error code and does not retry it', async () => {
    process.env.ZAI_API_KEY = 'test-key'
    process.env.ZAI_MODEL = 'glm-4.7-flash'
    process.env.AI_PROVIDER_MAX_RETRIES = '3'
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return new Response(
        JSON.stringify({
          error: {
            code: 1113,
            message: 'Insufficient balance or no resource package.',
          },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      )
    }

    let caught: unknown
    try {
      await callAiProvider(
        'zai',
        [{ role: 'user', content: 'Return OK' }],
        32,
        2_000,
      )
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(AiProviderRequestError)
    const typed = caught as AiProviderRequestError
    expect(typed.code).toBe('1113')
    expect(typed.status).toBe(429)
    expect(typed.retryable).toBe(false)
    expect(typed.message).toContain('Insufficient balance')
    expect(calls).toBe(1)
  })

  test('retries transient concurrency errors and returns the successful result', async () => {
    process.env.ZAI_API_KEY = 'test-key'
    process.env.ZAI_MODEL = 'glm-4.7-flash'
    process.env.AI_PROVIDER_MAX_RETRIES = '1'
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            error: { code: 1302, message: 'High concurrency' },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '0',
            },
          },
        )
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'WEWED_ZAI_OK' } }],
          usage: {
            prompt_tokens: 4,
            completion_tokens: 3,
            total_tokens: 7,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const result = await callAiProvider(
      'zai',
      [{ role: 'user', content: 'Return WEWED_ZAI_OK' }],
      32,
      2_000,
    )

    expect(result.text).toBe('WEWED_ZAI_OK')
    expect(result.provider).toBe('zai')
    expect(result.model).toBe('glm-4.7-flash')
    expect(result.usage?.totalTokens).toBe(7)
    expect(calls).toBe(2)
  })
})
