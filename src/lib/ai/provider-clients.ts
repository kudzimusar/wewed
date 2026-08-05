import { getProviderConfig } from './config'
import type {
  AiGenerateResult,
  AiMessage,
  AiProviderName,
  AiUsage,
} from './types'

export class AiProviderRequestError extends Error {
  readonly provider: AiProviderName
  readonly status?: number

  constructor(provider: AiProviderName, message: string, status?: number) {
    super(message)
    this.name = 'AiProviderRequestError'
    this.provider = provider
    this.status = status
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

async function fetchJson<T>(
  provider: AiProviderName,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new AiProviderRequestError(
        provider,
        `${provider} returned HTTP ${response.status}`,
        response.status
      )
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof AiProviderRequestError) throw error

    if (error instanceof Error && error.name === 'AbortError') {
      throw new AiProviderRequestError(
        provider,
        `${provider} request timed out after ${timeoutMs}ms`
      )
    }

    throw new AiProviderRequestError(
      provider,
      error instanceof Error
        ? `${provider} request failed: ${error.message}`
        : `${provider} request failed`
    )
  } finally {
    clearTimeout(timeout)
  }
}

function openAiUsage(
  usage: OpenAiCompatibleResponse['usage']
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
  timeoutMs: number
): Promise<AiGenerateResult> {
  const config = getProviderConfig(provider)
  if (!config.apiKey) {
    throw new AiProviderRequestError(provider, `${provider} API key is missing`)
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    max_tokens: maxOutputTokens,
    stream: false,
  }

  if (provider === 'groq' && config.model.startsWith('openai/gpt-oss')) {
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
    timeoutMs
  )

  const text = response.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new AiProviderRequestError(provider, `${provider} returned empty text`)
  }

  return {
    text,
    provider,
    model: config.model,
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
  timeoutMs: number
): Promise<AiGenerateResult> {
  const provider: AiProviderName = 'gemini'
  const config = getProviderConfig(provider)
  if (!config.apiKey) {
    throw new AiProviderRequestError(provider, 'gemini API key is missing')
  }

  const contents = geminiContents(messages)
  if (contents.length === 0) {
    throw new AiProviderRequestError(provider, 'gemini requires a user message')
  }

  const systemText = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')

  const response = await fetchJson<GeminiResponse>(
    provider,
    `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`,
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
        store: false,
      }),
    },
    timeoutMs
  )

  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()

  if (!text) {
    throw new AiProviderRequestError(provider, 'gemini returned empty text')
  }

  return {
    text,
    provider,
    model: config.model,
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
  timeoutMs: number
): Promise<AiGenerateResult> {
  switch (provider) {
    case 'groq':
      return callOpenAiCompatible('groq', messages, maxOutputTokens, timeoutMs)
    case 'gemini':
      return callGemini(messages, maxOutputTokens, timeoutMs)
    case 'zai':
      return callOpenAiCompatible('zai', messages, maxOutputTokens, timeoutMs)
  }
}
