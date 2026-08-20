const DEFAULT_ZAI_TRANSCRIPTION_BASE_URL = 'https://api.z.ai/api/paas/v4'
const DEFAULT_ZAI_TRANSCRIPTION_MODEL = 'glm-asr-2512'
const DEFAULT_GROQ_TRANSCRIPTION_BASE_URL = 'https://api.groq.com/openai/v1'
const DEFAULT_GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'
const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = 'whisper-1'

export type NotebookTranscriptionRequestShape = 'zai' | 'openai'

export interface NotebookTranscriptionConfig {
  endpoint: string
  apiKey?: string
  model: string
  provider: string
  requestShape: NotebookTranscriptionRequestShape
  directMimeTypes: readonly string[] | null
  maxDirectDurationMs: number | null
}

type TranscriptionEnvironment = Partial<Record<
  | 'WEWED_TRANSCRIPTION_URL'
  | 'WEWED_TRANSCRIPTION_API_KEY'
  | 'WEWED_TRANSCRIPTION_MODEL'
  | 'ZAI_API_KEY'
  | 'ZAI_BASE_URL'
  | 'GROQ_API_KEY'
  | 'GROQ_BASE_URL'
  | 'AI_ALLOW_PRIVATE_FALLBACK',
  string | undefined
>>

const ZAI_DIRECT_MIME_TYPES = ['audio/wav', 'audio/x-wav', 'audio/mpeg'] as const

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

function transcriptionEndpoint(baseValue: string | undefined, fallback: string): URL {
  const base = normalizeEndpoint(baseValue) ?? new URL(fallback)
  const basePath = base.pathname.replace(/\/+$/, '')
  if (!basePath.endsWith('/audio/transcriptions')) {
    base.pathname = `${basePath}/audio/transcriptions`
  }
  base.search = ''
  base.hash = ''
  return base
}

function providerShape(endpoint: URL): NotebookTranscriptionRequestShape {
  return endpoint.hostname === 'api.z.ai' || endpoint.hostname === 'open.bigmodel.cn' ? 'zai' : 'openai'
}

function buildConfig(
  endpoint: URL,
  apiKey: string | undefined,
  model: string | undefined,
): NotebookTranscriptionConfig {
  const requestShape = providerShape(endpoint)
  const isZai = requestShape === 'zai'
  const isGroq = endpoint.hostname === 'api.groq.com'
  return {
    endpoint: endpoint.toString(),
    apiKey,
    model: model?.trim() || (isZai ? DEFAULT_ZAI_TRANSCRIPTION_MODEL : isGroq ? DEFAULT_GROQ_TRANSCRIPTION_MODEL : DEFAULT_OPENAI_TRANSCRIPTION_MODEL),
    provider: endpoint.hostname,
    requestShape,
    directMimeTypes: isZai ? ZAI_DIRECT_MIME_TYPES : null,
    maxDirectDurationMs: isZai ? 30_000 : null,
  }
}

export function resolveNotebookTranscriptionConfig(
  env: TranscriptionEnvironment = process.env,
): NotebookTranscriptionConfig | null {
  const explicitEndpoint = normalizeEndpoint(env.WEWED_TRANSCRIPTION_URL)
  const explicitApiKey = env.WEWED_TRANSCRIPTION_API_KEY?.trim() || undefined
  const zaiApiKey = env.ZAI_API_KEY?.trim() || undefined
  const groqApiKey = env.GROQ_API_KEY?.trim() || undefined
  const allowPrivateFallback = env.AI_ALLOW_PRIVATE_FALLBACK?.trim().toLowerCase() === 'true'

  // An explicit speech-to-text endpoint is an intentional Notebook-specific route,
  // so it is allowed independently of the generic AI fallback policy.
  if (explicitEndpoint) {
    const shape = providerShape(explicitEndpoint)
    const providerApiKey = explicitApiKey ?? (shape === 'zai' ? zaiApiKey : explicitEndpoint.hostname === 'api.groq.com' ? groqApiKey : undefined)
    return buildConfig(explicitEndpoint, providerApiKey, env.WEWED_TRANSCRIPTION_MODEL)
  }

  // Notebook contains private wedding material. Prefer Wewed's configured private
  // Z.AI credential. A generic Groq fallback is permitted only when the existing
  // private-fallback policy has been explicitly enabled.
  if (zaiApiKey) {
    const endpoint = transcriptionEndpoint(env.ZAI_BASE_URL, DEFAULT_ZAI_TRANSCRIPTION_BASE_URL)
    return buildConfig(endpoint, zaiApiKey, env.WEWED_TRANSCRIPTION_MODEL)
  }

  if (groqApiKey && allowPrivateFallback) {
    const endpoint = transcriptionEndpoint(env.GROQ_BASE_URL, DEFAULT_GROQ_TRANSCRIPTION_BASE_URL)
    return buildConfig(endpoint, groqApiKey, env.WEWED_TRANSCRIPTION_MODEL)
  }

  return null
}

export function notebookTranscriptionConfigured(env: TranscriptionEnvironment = process.env): boolean {
  return resolveNotebookTranscriptionConfig(env) !== null
}

export function notebookDirectTranscriptionSupported(
  config: NotebookTranscriptionConfig,
  mimeType: string,
  durationMs: number | null | undefined,
): boolean {
  if (config.directMimeTypes && !config.directMimeTypes.includes(mimeType)) return false
  if (config.maxDirectDurationMs && typeof durationMs === 'number' && durationMs > config.maxDirectDurationMs) return false
  return true
}
