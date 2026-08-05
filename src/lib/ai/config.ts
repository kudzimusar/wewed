import type { AiProviderName, AiProviderStatus } from './types'

const DEFAULT_MODELS: Record<AiProviderName, string> = {
  groq: 'openai/gpt-oss-120b',
  gemini: 'gemini-3.6-flash',
  zai: 'glm-4.7-flash',
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_OUTPUT_TOKENS = 2_048

export interface AiSettings {
  enabled: boolean
  privateProvider: AiProviderName
  qualityProvider: AiProviderName
  fallbackProvider: AiProviderName
  allowPrivateFallback: boolean
  timeoutMs: number
  defaultMaxOutputTokens: number
}

export interface AiProviderConfig {
  provider: AiProviderName
  apiKey: string | null
  model: string
  baseUrl: string
}

function isProviderName(value: string | undefined): value is AiProviderName {
  return value === 'groq' || value === 'gemini' || value === 'zai'
}

function providerFromEnv(
  value: string | undefined,
  fallback: AiProviderName
): AiProviderName {
  return isProviderName(value?.trim().toLowerCase())
    ? (value!.trim().toLowerCase() as AiProviderName)
    : fallback
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function cleanBaseUrl(value: string | undefined, fallback: string): string {
  return (value?.trim() || fallback).replace(/\/+$/, '')
}

export function getAiSettings(): AiSettings {
  return {
    enabled: process.env.AI_ENABLED !== 'false',
    privateProvider: providerFromEnv(process.env.AI_PRIVATE_PROVIDER, 'groq'),
    qualityProvider: providerFromEnv(process.env.AI_QUALITY_PROVIDER, 'gemini'),
    fallbackProvider: providerFromEnv(process.env.AI_FALLBACK_PROVIDER, 'zai'),
    allowPrivateFallback: process.env.AI_ALLOW_PRIVATE_FALLBACK === 'true',
    timeoutMs: positiveInteger(
      process.env.AI_REQUEST_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS
    ),
    defaultMaxOutputTokens: positiveInteger(
      process.env.AI_MAX_OUTPUT_TOKENS,
      DEFAULT_MAX_OUTPUT_TOKENS
    ),
  }
}

export function getProviderConfig(provider: AiProviderName): AiProviderConfig {
  switch (provider) {
    case 'groq':
      return {
        provider,
        apiKey: process.env.GROQ_API_KEY?.trim() || null,
        model: process.env.GROQ_MODEL?.trim() || DEFAULT_MODELS.groq,
        baseUrl: cleanBaseUrl(
          process.env.GROQ_BASE_URL,
          'https://api.groq.com/openai/v1'
        ),
      }
    case 'gemini':
      return {
        provider,
        apiKey:
          process.env.GEMINI_API_KEY?.trim() ||
          process.env.GOOGLE_API_KEY?.trim() ||
          null,
        model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODELS.gemini,
        baseUrl: cleanBaseUrl(
          process.env.GEMINI_BASE_URL,
          'https://generativelanguage.googleapis.com/v1beta'
        ),
      }
    case 'zai':
      return {
        provider,
        apiKey: process.env.ZAI_API_KEY?.trim() || null,
        model: process.env.ZAI_MODEL?.trim() || DEFAULT_MODELS.zai,
        baseUrl: cleanBaseUrl(
          process.env.ZAI_BASE_URL,
          'https://api.z.ai/api/paas/v4'
        ),
      }
  }
}

export function getProviderStatuses(): AiProviderStatus[] {
  const providers: AiProviderName[] = ['groq', 'gemini', 'zai']
  return providers.map((provider) => {
    const config = getProviderConfig(provider)
    return {
      provider,
      configured: Boolean(config.apiKey),
      model: config.model,
    }
  })
}
