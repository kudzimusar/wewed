import { describe, expect, test } from 'bun:test'
import { resolveNotebookTranscriptionConfig } from './transcription-config'

describe('Notebook transcription provider resolution', () => {
  test('prefers an explicit Wewed transcription endpoint', () => {
    const config = resolveNotebookTranscriptionConfig({
      WEWED_TRANSCRIPTION_URL: 'https://speech.example.test/v1/audio/transcriptions',
      WEWED_TRANSCRIPTION_API_KEY: 'dedicated-key',
      WEWED_TRANSCRIPTION_MODEL: 'custom-whisper',
      GROQ_API_KEY: 'groq-key',
    })

    expect(config).toEqual({
      endpoint: 'https://speech.example.test/v1/audio/transcriptions',
      apiKey: 'dedicated-key',
      model: 'custom-whisper',
      provider: 'speech.example.test',
    })
  })

  test('reuses the existing Groq server credential when no dedicated endpoint is configured', () => {
    const config = resolveNotebookTranscriptionConfig({
      GROQ_API_KEY: 'groq-key',
      GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
    })

    expect(config).toEqual({
      endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
      apiKey: 'groq-key',
      model: 'whisper-large-v3-turbo',
      provider: 'api.groq.com',
    })
  })

  test('reuses GROQ_API_KEY for an explicit Groq endpoint when a duplicate transcription key is absent', () => {
    const config = resolveNotebookTranscriptionConfig({
      WEWED_TRANSCRIPTION_URL: 'https://api.groq.com/openai/v1/audio/transcriptions',
      GROQ_API_KEY: 'groq-key',
    })

    expect(config?.apiKey).toBe('groq-key')
    expect(config?.model).toBe('whisper-large-v3-turbo')
  })

  test('fails closed when neither a valid dedicated endpoint nor Groq credential is available', () => {
    expect(resolveNotebookTranscriptionConfig({})).toBeNull()
    expect(resolveNotebookTranscriptionConfig({ WEWED_TRANSCRIPTION_URL: 'not-a-url' })).toBeNull()
  })
})
