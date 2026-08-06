export type AiProviderName = 'groq' | 'gemini' | 'zai'

export type AiMessageRole = 'system' | 'user' | 'assistant'

export interface AiMessage {
  role: AiMessageRole
  content: string
}

export type AiDataProfile = 'private' | 'anonymized'

export interface AiGenerateRequest {
  messages: AiMessage[]
  profile: AiDataProfile
  maxOutputTokens?: number
  /**
   * Force a single provider. Intended for provider diagnostics and tests.
   * Normal application routes should allow the router to choose.
   */
  provider?: AiProviderName
  /**
   * Defaults to true for anonymized requests. Private requests only cross
   * provider boundaries when AI_ALLOW_PRIVATE_FALLBACK=true.
   */
  allowFallback?: boolean
}

export interface AiUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AiGenerateResult {
  text: string
  provider: AiProviderName
  model: string
  usage?: AiUsage
}

export interface AiProviderStatus {
  provider: AiProviderName
  configured: boolean
  model: string
}
