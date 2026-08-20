const DEFAULT_GROQ_TRANSCRIPTION_BASE_URL = 'https://api.groq.com/openai/v1'
const DEFAULT_GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'
const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = 'whisper-1'

export interface NotebookTranscriptionConfig {
  endpoint: string
  apiKey?: string
  model: string
  provider: string
}

type TranscriptionEnvironment = Partial<Record<
  | 'WEWED_TRANSCRIPTION_URL'
  | 'WEWED_TRANSCRIPTION_API_KEY'
  | 'WEWED_TRANSCRIPTION_MODEL'
  | 'GROQ_API_KEY'
  | 'GROQ_BASE_URL',
  string | undefined
>>

function normalizeEndpoint(value: string | undefined): URL | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed
  } catch {
    return null
  }
}

function groqTranscriptionEndpoint(env: TranscriptionEnvironment): URL {
  const base = normalizeEndpoint(env.GROQ_BASE_URL) ?? new URL(DEFAULT_GROQ_TRANSCRIPTION_BASE_URL)
  const basePath = base.pathname.replace(/\/+$/, '')
  base.pathname = `${basePath}/audio/transcriptions`
  base.search = ''
  base.hash = ''
  return base
}

export function resolveNotebookTranscriptionConfig(
  env: TranscriptionEnvironment = process.env,
): NotebookTranscriptionConfig | null {
  const explicitEndpoint = normalizeEndpoint(env.WEWED_TRANSCRIPTION_URL)
  const explicitApiKey = env.WEWED_TRANSCRIPTION_API_KEY?.trim() || undefined
  const groqApiKey = env.GROQ_API_KEY?.trim() || undefined

  if (explicitEndpoint) {
    const isGroq = explicitEndpoint.hostname === 'api.groq.com'
    return {
      endpoint: explicitEndpoint.toString(),
      apiKey: explicitApiKey ?? (isGroq ? groqApiKey : undefined),
      model:
        env.WEWED_TRANSCRIPTION_MODEL?.trim() ||
        (isGroq ? DEFAULT_GROQ_TRANSCRIPTION_MODEL : DEFAULT_OPENAI_TRANSCRIPTION_MODEL),
      provider: explicitEndpoint.hostname,
    }
  }

  // This resolver is imported only by server routes/server-rendered Notebook pages.
  // Keeping the pure environment resolution free of framework sentinels makes it
  // independently testable while credentials remain non-NEXT_PUBLIC server values.
  if (groqApiKey) {
    const endpoint = groqTranscriptionEndpoint(env)
    return {
      endpoint: endpoint.toString(),
      apiKey: groqApiKey,
      model: env.WEWED_TRANSCRIPTION_MODEL?.trim() || DEFAULT_GROQ_TRANSCRIPTION_MODEL,
      provider: endpoint.hostname,
    }
  }

  return null
}

export function notebookTranscriptionConfigured(env: TranscriptionEnvironment = process.env): boolean {
  return resolveNotebookTranscriptionConfig(env) !== null
}
