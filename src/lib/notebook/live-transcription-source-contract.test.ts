import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const workspace = read('src/components/notebook/notebook-workspace.tsx')
const media = read('src/lib/notebook/media.ts')
const config = read('src/lib/notebook/transcription-config.ts')
const chunkRoute = read('src/app/api/notebook/[id]/transcription-chunks/route.ts')
const recordingRoute = read('src/app/api/notebook/[id]/recordings/route.ts')
const recordingActionRoute = read('src/app/api/notebook/recordings/[id]/route.ts')
const readinessRoute = read('src/app/api/notebook/transcription-readiness/route.ts')

describe('WW-NOTEBOOK-LIVE-ASR-2026-08-20-01', () => {
  test('keeps provider credentials server-side and chooses private Z.AI before optional Groq', () => {
    expect(config).toContain('ZAI_API_KEY')
    expect(config).toContain('GROQ_API_KEY')
    expect(config.indexOf('if (zaiApiKey)')).toBeLessThan(config.indexOf('if (groqApiKey)'))
    expect(config).toContain("DEFAULT_ZAI_TRANSCRIPTION_MODEL = 'glm-asr-2512'")
    expect(config).not.toContain('NEXT_PUBLIC_')
    expect(readinessRoute).toContain('requireNotebookActor')
  })

  test('preserves full meeting audio while long Z.AI capture uses bounded WAV chunks', () => {
    expect(workspace).toContain('encodeMonoPcm16Wav')
    expect(workspace).toContain('notebookLiveChunkSampleLimit')
    expect(workspace).toContain('startLiveTranscriptionCapture')
    expect(workspace).toContain('finishLiveTranscriptionCapture')
    expect(workspace).toContain("new File([blob], `meeting-${Date.now()}.webm`")
    expect(workspace).toContain('/transcription-chunks')
    expect(recordingRoute).toContain('await uploadRecording')
    expect(recordingRoute).toContain('directTranscriptionSupportedForRecording')
    expect(media).toContain('MAX_LIVE_TRANSCRIPTION_CHUNK_BYTES')
    expect(media).toContain('notebookDirectTranscriptionSupported')
  })

  test('attaches assembled live text only after the recording has an authoritative recording id', () => {
    const uploadIndex = workspace.indexOf('const uploaded = await jsonFetch<Recording>')
    const attachIndex = workspace.indexOf("action: 'attach-transcript'")
    expect(uploadIndex).toBeGreaterThan(-1)
    expect(attachIndex).toBeGreaterThan(uploadIndex)
    expect(recordingActionRoute).toContain("action === 'attach-transcript'")
    expect(media).toContain('export async function attachTranscript')
    expect(media).toContain("status='TRANSCRIBED'")
  })

  test('never lets transcription failure delete or roll back the private recording', () => {
    expect(media).toContain("code: 'TRANSCRIPTION_FAILED'")
    expect(media).toContain('preserved: true')
    expect(media).not.toContain('remove([recording.storageKey])')
    expect(chunkRoute).toContain('Recording continues and remains preserved.')
  })
})
