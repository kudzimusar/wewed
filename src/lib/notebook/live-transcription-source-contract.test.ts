import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const workspace = read('src/components/notebook/notebook-workspace.tsx')
const bridge = read('src/components/notebook/notebook-live-transcription-bridge.tsx')
const plannerPage = read('src/app/planner/notebook/page.tsx')
const adminPage = read('src/app/admin/notebook/page.tsx')
const media = read('src/lib/notebook/media.ts')
const config = read('src/lib/notebook/transcription-config.ts')
const chunkRoute = read('src/app/api/notebook/[id]/transcription-chunks/route.ts')
const recordingRoute = read('src/app/api/notebook/[id]/recordings/route.ts')
const recordingActionRoute = read('src/app/api/notebook/recordings/[id]/route.ts')
const readinessRoute = read('src/app/api/notebook/transcription-readiness/route.ts')

describe('WW-NOTEBOOK-LIVE-ASR-2026-08-20-01', () => {
  test('keeps provider credentials server-side and chooses private Z.AI before explicitly permitted fallback', () => {
    expect(config).toContain('ZAI_API_KEY')
    expect(config).toContain('GROQ_API_KEY')
    expect(config).toContain('AI_ALLOW_PRIVATE_FALLBACK')
    expect(config.indexOf('if (zaiApiKey)')).toBeLessThan(config.indexOf('if (groqApiKey && allowPrivateFallback)'))
    expect(config).toContain("DEFAULT_ZAI_TRANSCRIPTION_MODEL = 'glm-asr-2512'")
    expect(config).not.toContain('NEXT_PUBLIC_')
    expect(readinessRoute).toContain('requireNotebookActor')
    expect(bridge).not.toContain('ZAI_API_KEY')
    expect(bridge).not.toContain('GROQ_API_KEY')
  })

  test('installs the recording bridge before Notebook passive effects can load the active note', () => {
    expect(bridge).toContain("import { useLayoutEffect, useRef } from 'react'")
    expect(bridge).toContain('useLayoutEffect(() => {')
    expect(bridge).toContain('window.fetch = async')
    expect(bridge).toContain('window.MediaRecorder = PatchedMediaRecorder')
  })

  test('preserves full meeting audio while long Z.AI capture uses bounded WAV chunks', () => {
    expect(bridge).toContain('LiveNotebookCapture')
    expect(bridge).toContain('encodeMonoPcm16Wav')
    expect(bridge).toContain('notebookLiveChunkSampleLimit')
    expect(bridge).toContain('/transcription-chunks')
    expect(workspace).toContain("new File([blob], `meeting-${Date.now()}.webm`")
    expect(recordingRoute).toContain('await uploadRecording')
    expect(recordingRoute).toContain('directTranscriptionSupportedForRecording')
    expect(media).toContain('MAX_LIVE_TRANSCRIPTION_CHUNK_BYTES')
    expect(media).toContain('notebookDirectTranscriptionSupported')
    expect(plannerPage).toContain('NotebookLiveTranscriptionBridge')
    expect(adminPage).toContain('NotebookLiveTranscriptionBridge')
  })

  test('holds the existing recording response until assembled live text can attach to its authoritative id', () => {
    const originalUploadIndex = bridge.indexOf('const response = await originalFetch(input, init)')
    const recordingIdIndex = bridge.indexOf('const recordingId = payload.data?.id')
    const attachIndex = bridge.indexOf("action: 'attach-transcript'")
    const returnIndex = bridge.lastIndexOf('return response')
    expect(originalUploadIndex).toBeGreaterThan(-1)
    expect(recordingIdIndex).toBeGreaterThan(originalUploadIndex)
    expect(attachIndex).toBeGreaterThan(recordingIdIndex)
    expect(returnIndex).toBeGreaterThan(attachIndex)
    expect(recordingActionRoute).toContain("action === 'attach-transcript'")
    expect(media).toContain('export async function attachTranscript')
    expect(media).toContain("status='TRANSCRIBED'")
  })

  test('never lets transcription failure delete or roll back the private recording', () => {
    expect(media).toContain("code: 'TRANSCRIPTION_FAILED'")
    expect(media).toContain('preserved: true')
    expect(media).not.toContain('remove([recording.storageKey])')
    expect(chunkRoute).toContain('Recording continues and remains preserved.')
    expect(bridge).toContain('Recording saved')
  })
})
