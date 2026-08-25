import type { AiProviderName } from '@/lib/ai'
import type { WewedAiModelProfile } from './contracts'

export interface WewedAiModelCandidate {
  provider: AiProviderName
  model: string
}

export interface WewedAiModelRelease {
  releaseId: string
  profiles: Record<WewedAiModelProfile, {
    primary: WewedAiModelCandidate
    fallbacks: WewedAiModelCandidate[]
  }>
  privacy: {
    allowPrivateCrossProviderFallback: boolean
  }
}

function provider(value: string | undefined, fallback: AiProviderName): AiProviderName {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'groq' || normalized === 'gemini' || normalized === 'zai'
    ? normalized
    : fallback
}

function clean(value: string | undefined, fallback: string) {
  return value?.trim() || fallback
}

/**
 * The only product-wide language-model switch for the unified Wewed AI Core.
 * Feature code selects a skill/outcome; it never names a provider or model.
 */
export function getWewedAiModelRelease(): WewedAiModelRelease {
  const defaultProvider = provider(process.env.WEWED_AI_DEFAULT_PROVIDER, 'zai')
  const defaultModel = clean(process.env.WEWED_AI_DEFAULT_MODEL, 'glm-4.7-flash')
  const reasoningProvider = provider(process.env.WEWED_AI_REASONING_PROVIDER, defaultProvider)
  const reasoningModel = clean(process.env.WEWED_AI_REASONING_MODEL, defaultModel)

  const fallbackProvider = provider(process.env.WEWED_AI_FALLBACK_PROVIDER, 'groq')
  const fallbackModel = clean(process.env.WEWED_AI_FALLBACK_MODEL, 'openai/gpt-oss-120b')

  return {
    releaseId: clean(process.env.WEWED_AI_MODEL_RELEASE_ID, 'wewed-ai-2026-08-a'),
    profiles: {
      default_language: {
        primary: { provider: defaultProvider, model: defaultModel },
        fallbacks: fallbackProvider === defaultProvider && fallbackModel === defaultModel
          ? []
          : [{ provider: fallbackProvider, model: fallbackModel }],
      },
      reasoning: {
        primary: { provider: reasoningProvider, model: reasoningModel },
        fallbacks: fallbackProvider === reasoningProvider && fallbackModel === reasoningModel
          ? []
          : [{ provider: fallbackProvider, model: fallbackModel }],
      },
    },
    privacy: {
      allowPrivateCrossProviderFallback:
        process.env.WEWED_AI_ALLOW_PRIVATE_CROSS_PROVIDER_FALLBACK === 'true',
    },
  }
}

export function modelCandidatesFor(
  profile: WewedAiModelProfile,
  dataProfile: 'public' | 'private' | 'anonymized',
): { release: WewedAiModelRelease; candidates: WewedAiModelCandidate[] } {
  const release = getWewedAiModelRelease()
  const selected = release.profiles[profile]
  const fallbacks = dataProfile === 'private' && !release.privacy.allowPrivateCrossProviderFallback
    ? selected.fallbacks.filter((candidate) => candidate.provider === selected.primary.provider)
    : selected.fallbacks
  return { release, candidates: [selected.primary, ...fallbacks] }
}
