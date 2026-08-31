import { getAiSettings, getProviderConfig } from './config'
import type {
  AiGenerateResult,
  AiMessage,
  AiProviderName,
  AiUsage,
} from './types'

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])
const RETRYABLE_ZAI_CODES = new Set(['1302', '1303', '1305', '1312'])
const NON_RETRYABLE_ZAI_CODES = new Set(['1113', '1304', '1308', '1310', '1311'])

export class AiProviderRequestError extends Error {
  readonly provider: AiProviderName
  readonly status?: number
  readonly code?: string
  readonly retryable: boolean
  readonly retryAfterMs?: number

  constructor(input: {
    provider: AiProviderName
    message: string
    status?: number
    code?: string
    retryable?: boolean
    retryAfterMs?: number
  }) {
    super(input.message)
    this.name = 'AiProviderRequestError'
    this.provider = input.provider
    this.status = input.status
    this.code = input.code
    this.retryable = input.retryable === true
    this.retryAfterMs = input.retryAfterMs
  }
}

interface OpenAiCompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

interface ProviderErrorPayload {
  error?: {
    code?: string | number
    message?: string
    status?: string
  }
  code?: string | number
  message?: string
}

function sanitizeErrorText(value: unknown, max = 360): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000)
  const date = Date.parse(value)
  if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  return undefined
}

async function providerHttpError(
  provider: AiProviderName,
  response: Response,
): Promise<AiProviderRequestError> {
  let payload: ProviderErrorPayload | null = null
  let raw = ''
  try {
    raw = await response.text()
    payload = raw ? (JSON.parse(raw) as ProviderErrorPayload) : null
  } catch {
    payload = null
  }

  const rawCode = payload?.error?.code ?? payload?.code
  const code = rawCode === undefined ? undefined : sanitizeErrorText(rawCode, 40)
  const providerMessage = sanitizeErrorText(
    payload?.error?.message ?? payload?.message ?? raw,
  )
  const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))

  let retryable = RETRYABLE_STATUS_CODES.has(response.status)
  if (provider === 'zai' && code) {
    if (RETRYABLE_ZAI_CODES.has(code)) retryable = true
    if (NON_RETRYABLE_ZAI_CODES.has(code)) retryable = false
  }

  const details = [
    `${provider} returned HTTP ${response.status}`,
    code ? `code ${code}` : '',
    providerMessage || '',
  ].filter(Boolean)

  return new AiProviderRequestError({
    provider,
    message: details.join(': '),
    status: response.status,
    code,
    retryable,
    retryAfterMs,
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelay(error: AiProviderRequestError, attempt: number): number {
  if (error.retryAfterMs !== undefined) {
    return Math.min(Math.max(error.retryAfterMs, 0), 8_000)
  }
  const exponential = Math.min(250 * 2 ** attempt, 4_000)
  const jitter = Math.floor(Math.random() * 150)
  return exponential + jitter
}

async function fetchJson<T>(
  provider: AiProviderName,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const maxRetries = getAiSettings().maxRetries
  let lastError: AiProviderRequestError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: 'no-store',
      })

      if (!response.ok) throw await providerHttpError(provider, response)
      return (await response.json()) as T
    } catch (error) {
      if (error instanceof AiProviderRequestError) {
        lastError = error
      } else if (error instanceof Error && error.name === 'AbortError') {
        lastError = new AiProviderRequestError({
          provider,
          message: `${provider} request timed out after ${timeoutMs}ms`,
          retryable: true,
        })
      } else {
        lastError = new AiProviderRequestError({
          provider,
          message:
            error instanceof Error
              ? `${provider} request failed: ${sanitizeErrorText(error.message)}`
              : `${provider} request failed`,
          retryable: true,
        })
      }
    } finally {
      clearTimeout(timeout)
    }

    if (!lastError.retryable || attempt >= maxRetries) throw lastError
    await sleep(retryDelay(lastError, attempt))
  }

  throw (
    lastError ??
    new AiProviderRequestError({
      provider,
      message: `${provider} request failed`,
    })
  )
}

function openAiUsage(
  usage: OpenAiCompatibleResponse['usage'],
): AiUsage | undefined {
  if (!usage) return undefined
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  }
}

async function callOpenAiCompatible(
  provider: 'groq' | 'zai',
  messages: AiMessage[],
  maxOutputTokens: number,
  timeoutMs: number,
  modelOverride?: string,
): Promise<AiGenerateResult> {
  const config = getProviderConfig(provider)
  const model = modelOverride?.trim() || config.model
  if (!config.apiKey) {
    throw new AiProviderRequestError({
      provider,
      message: `${provider} API key is missing`,
    })
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxOutputTokens,
    stream: false,
  }

  if (provider === 'groq' && model.startsWith('openai/gpt-oss')) {
    body.reasoning_effort = 'low'
  }

  if (provider === 'zai') {
    body.thinking = { type: 'disabled' }
  }

  const response = await fetchJson<OpenAiCompatibleResponse>(
    provider,
    `${config.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  )

  const text = response.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new AiProviderRequestError({
      provider,
      message: `${provider} returned empty text`,
    })
  }

  return {
    text,
    provider,
    model,
    usage: openAiUsage(response.usage),
  }
}

function geminiContents(messages: AiMessage[]): Array<{
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}> {
  const contents: Array<{
    role: 'user' | 'model'
    parts: Array<{ text: string }>
  }> = []

  for (const message of messages) {
    if (message.role === 'system') continue
    const role = message.role === 'assistant' ? 'model' : 'user'
    const previous = contents.at(-1)

    if (previous?.role === role) {
      previous.parts.push({ text: message.content })
    } else {
      contents.push({ role, parts: [{ text: message.content }] })
    }
  }

  return contents
}

async function callGemini(
  messages: AiMessage[],
  maxOutputTokens: number,
  timeoutMs: number,
  modelOverride?: string,
): Promise<AiGenerateResult> {
  const provider: AiProviderName = 'gemini'
  const config = getProviderConfig(provider)
  const model = modelOverride?.trim() || config.model
  if (!config.apiKey) {
    throw new AiProviderRequestError({
      provider,
      message: 'gemini API key is missing',
    })
  }

  const contents = geminiContents(messages)
  if (contents.length === 0) {
    throw new AiProviderRequestError({
      provider,
      message: 'gemini requires a user message',
    })
  }

  const systemText = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')

  const response = await fetchJson<GeminiResponse>(
    provider,
    `${config.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(systemText
          ? { system_instruction: { parts: [{ text: systemText }] } }
          : {}),
        contents,
        generationConfig: {
          maxOutputTokens,
        },
      }),
    },
    timeoutMs,
  )

  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()

  if (!text) {
    throw new AiProviderRequestError({
      provider,
      message: 'gemini returned empty text',
    })
  }

  return {
    text,
    provider,
    model,
    usage: response.usageMetadata
      ? {
          promptTokens: response.usageMetadata.promptTokenCount,
          completionTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount,
        }
      : undefined,
  }
}

export async function callAiProvider(
  provider: AiProviderName,
  messages: AiMessage[],
  maxOutputTokens: number,
  timeoutMs: number,
  modelOverride?: string,
): Promise<AiGenerateResult> {
  switch (provider) {
    case 'groq':
      return callOpenAiCompatible('groq', messages, maxOutputTokens, timeoutMs, modelOverride)
    case 'gemini':
      return callGemini(messages, maxOutputTokens, timeoutMs, modelOverride)
    case 'zai':
      return callOpenAiCompatible('zai', messages, maxOutputTokens, timeoutMs, modelOverride)
  }
}
