import { describe, expect, test } from 'bun:test'
import {
  notebookDirectTranscriptionSupported,
  resolveNotebookTranscriptionConfig,
} from './transcription-config'

describe('Notebook transcription provider resolution', () => {
  test('prefers an explicit Wewed transcription endpoint', () => {
    const config = resolveNotebookTranscriptionConfig({
      WEWED_TRANSCRIPTION_URL: 'https://speech.example.test/v1/audio/transcriptions',
      WEWED_TRANSCRIPTION_API_KEY: 'dedicated-key',
      WEWED_TRANSCRIPTION_MODEL: 'custom-whisper',
      ZAI_API_KEY: 'zai-key',
      GROQ_API_KEY: 'groq-key',
    })

    expect(config).toEqual({
      endpoint: 'https://speech.example.test/v1/audio/transcriptions',
      apiKey: 'dedicated-key',
      model: 'custom-whisper',
      provider: 'speech.example.test',
      requestShape: 'openai',
      directMimeTypes: null,
      maxDirectDurationMs: null,
    })
  })

  test('uses the configured private Z.AI credential and ASR endpoint before optional fallback providers', () => {
    const config = resolveNotebookTranscriptionConfig({
      ZAI_API_KEY: 'zai-key',
      ZAI_BASE_URL: 'https://api.z.ai/api/paas/v4',
      GROQ_API_KEY: 'groq-key',
      AI_ALLOW_PRIVATE_FALLBACK: 'true',
    })

    expect(config).toEqual({
      endpoint: 'https://api.z.ai/api/paas/v4/audio/transcriptions',
      apiKey: 'zai-key',
      model: 'glm-asr-2512',
      provider: 'api.z.ai',
      requestShape: 'zai',
      directMimeTypes: ['audio/wav', 'audio/x-wav', 'audio/mpeg'],
      maxDirectDurationMs: 30_000,
    })
  })

  test('uses Groq only when the private fallback policy is explicitly enabled', () => {
    expect(resolveNotebookTranscriptionConfig({
      GROQ_API_KEY: 'groq-key',
      GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
      AI_ALLOW_PRIVATE_FALLBACK: 'false',
    })).toBeNull()

    const config = resolveNotebookTranscriptionConfig({
      GROQ_API_KEY: 'groq-key',
      GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
      AI_ALLOW_PRIVATE_FALLBACK: 'true',
    })

    expect(config).toEqual({
      endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
      apiKey: 'groq-key',
      model: 'whisper-large-v3-turbo',
      provider: 'api.groq.com',
      requestShape: 'openai',
      directMimeTypes: null,
      maxDirectDurationMs: null,
    })
  })

  test('enforces Z.AI direct input capabilities so long browser WebM recordings use live WAV chunks', () => {
    const config = resolveNotebookTranscriptionConfig({ ZAI_API_KEY: 'zai-key' })
    expect(config).not.toBeNull()
    if (!config) return

    expect(notebookDirectTranscriptionSupported(config, 'audio/wav', 20_000)).toBe(true)
    expect(notebookDirectTranscriptionSupported(config, 'audio/webm', 20_000)).toBe(false)
    expect(notebookDirectTranscriptionSupported(config, 'audio/wav', 31_000)).toBe(false)
  })

  test('fails closed when no valid transcription credential is available', () => {
    expect(resolveNotebookTranscriptionConfig({})).toBeNull()
    expect(resolveNotebookTranscriptionConfig({ WEWED_TRANSCRIPTION_URL: 'not-a-url' })).toBeNull()
  })
})
