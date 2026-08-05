import {
  getAiSettings,
  getProviderConfig,
  getProviderStatuses,
} from './config'
import { AiProviderRequestError, callAiProvider } from './provider-clients'
import type {
  AiGenerateRequest,
  AiGenerateResult,
  AiMessage,
  AiProviderName,
} from './types'

export type {
  AiDataProfile,
  AiGenerateRequest,
  AiGenerateResult,
  AiMessage,
  AiProviderName,
  AiProviderStatus,
  AiUsage,
} from './types'

const MAX_MESSAGES = 60
const MAX_TOTAL_CHARACTERS = 200_000
const MAX_OUTPUT_TOKENS = 8_192

export class AiUnavailableError extends Error {
  readonly attemptedProviders: AiProviderName[]

  constructor(message: string, attemptedProviders: AiProviderName[]) {
    super(message)
    this.name = 'AiUnavailableError'
    this.attemptedProviders = attemptedProviders
  }
}

function uniqueProviders(providers: AiProviderName[]): AiProviderName[] {
  return Array.from(new Set(providers))
}

function normalizeMessages(messages: AiMessage[]): AiMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AiUnavailableError('At least one AI message is required', [])
  }

  const normalized = messages
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)

  if (normalized.length === 0) {
    throw new AiUnavailableError('At least one non-empty AI message is required', [])
  }

  const totalCharacters = normalized.reduce(
    (total, message) => total + message.content.length,
    0,
  )
  if (totalCharacters > MAX_TOTAL_CHARACTERS) {
    throw new AiUnavailableError(
      `AI request exceeds the ${MAX_TOTAL_CHARACTERS.toLocaleString()} character limit`,
      [],
    )
  }

  return normalized
}

function getProviderOrder(request: AiGenerateRequest): AiProviderName[] {
  const settings = getAiSettings()

  if (request.provider) return [request.provider]

  if (request.profile === 'private') {
    const allowFallback =
      request.allowFallback !== false && settings.allowPrivateFallback
    return uniqueProviders([
      settings.privateProvider,
      ...(allowFallback ? [settings.fallbackProvider] : []),
    ])
  }

  const allowFallback = request.allowFallback !== false
  return uniqueProviders([
    settings.qualityProvider,
    ...(allowFallback
      ? [settings.fallbackProvider, settings.privateProvider]
      : []),
  ])
}

export async function generateAiText(
  request: AiGenerateRequest,
): Promise<AiGenerateResult> {
  const settings = getAiSettings()
  if (!settings.enabled) {
    throw new AiUnavailableError('AI is disabled by AI_ENABLED=false', [])
  }

  const messages = normalizeMessages(request.messages)
  const maxOutputTokens = Math.min(
    Math.max(1, request.maxOutputTokens ?? settings.defaultMaxOutputTokens),
    MAX_OUTPUT_TOKENS,
  )
  const providerOrder = getProviderOrder(request)
  const attemptedProviders: AiProviderName[] = []

  for (const provider of providerOrder) {
    const config = getProviderConfig(provider)
    if (!config.apiKey) continue

    attemptedProviders.push(provider)
    try {
      return await callAiProvider(
        provider,
        messages,
        maxOutputTokens,
        settings.timeoutMs,
      )
    } catch (error) {
      const safeMessage =
        error instanceof AiProviderRequestError
          ? [
              error.message,
              error.status ? `status=${error.status}` : '',
              error.code ? `code=${error.code}` : '',
              `retryable=${error.retryable}`,
            ]
              .filter(Boolean)
              .join(' ')
          : `${provider} failed unexpectedly`
      console.warn(`[AI ROUTER] ${safeMessage}`)
    }
  }

  if (attemptedProviders.length === 0) {
    throw new AiUnavailableError(
      `No configured AI provider is available for the ${request.profile} profile`,
      [],
    )
  }

  throw new AiUnavailableError(
    'Every eligible AI provider failed',
    attemptedProviders,
  )
}

export function getAiDiagnostics() {
  const settings = getAiSettings()
  return {
    enabled: settings.enabled,
    routing: {
      privateProvider: settings.privateProvider,
      qualityProvider: settings.qualityProvider,
      fallbackProvider: settings.fallbackProvider,
      allowPrivateFallback: settings.allowPrivateFallback,
    },
    limits: {
      timeoutMs: settings.timeoutMs,
      maxRetries: settings.maxRetries,
      defaultMaxOutputTokens: settings.defaultMaxOutputTokens,
      maximumOutputTokens: MAX_OUTPUT_TOKENS,
      maximumMessages: MAX_MESSAGES,
      maximumCharacters: MAX_TOTAL_CHARACTERS,
    },
    providers: getProviderStatuses(),
  }
}
