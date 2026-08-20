'use client'

import { useLayoutEffect, useRef } from 'react'
import { toast } from 'sonner'
import { encodeMonoPcm16Wav, notebookLiveChunkSampleLimit } from '@/lib/notebook/browser-audio'

export type NotebookTranscriptionMode = 'none' | 'direct' | 'live-chunks'

type LiveSegment = {
  sequence: number
  text: string
  provider: string
  model?: string
}

type LiveResult = {
  text: string
  segments: LiveSegment[]
  failure: string | null
}

type JsonEnvelope<T> = {
  success?: boolean
  data?: T
  error?: string
}

function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === 'string') return new URL(input, window.location.origin)
    if (input instanceof URL) return new URL(input.toString(), window.location.origin)
    return new URL(input.url, window.location.origin)
  } catch {
    return null
  }
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

function exactNoteId(url: URL): string | null {
  if (url.origin !== window.location.origin) return null
  const match = url.pathname.match(/^\/api\/notebook\/([^/]+)$/)
  if (!match) return null
  const id = decodeURIComponent(match[1] ?? '')
  return id && !['context', 'ask', 'recordings', 'transcription-readiness'].includes(id) ? id : null
}

function recordingNoteId(url: URL): string | null {
  if (url.origin !== window.location.origin) return null
  const match = url.pathname.match(/^\/api\/notebook\/([^/]+)\/recordings$/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

class LiveNotebookCapture {
  private readonly noteId: string
  private readonly originalFetch: typeof window.fetch
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private gain: GainNode | null = null
  private chunks: Float32Array[] = []
  private sampleCount = 0
  private sampleRate = 16_000
  private sequence = 0
  private segments = new Map<number, LiveSegment>()
  private jobs: Promise<void>[] = []
  private failure: string | null = null
  private finished = false
  private finishPromise: Promise<LiveResult> | null = null

  constructor(noteId: string, stream: MediaStream, originalFetch: typeof window.fetch) {
    this.noteId = noteId
    this.originalFetch = originalFetch
    this.start(stream)
  }

  private start(stream: MediaStream) {
    if (typeof window.AudioContext === 'undefined') {
      this.failure = 'This browser cannot prepare live transcription audio.'
      return
    }

    try {
      const context = new window.AudioContext()
      this.audioContext = context
      this.sampleRate = context.sampleRate
      void context.resume().catch(() => undefined)

      const source = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      const gain = context.createGain()
      gain.gain.value = 0

      processor.onaudioprocess = (event) => {
        if (this.finished) return
        const input = event.inputBuffer.getChannelData(0)
        const copy = new Float32Array(input.length)
        copy.set(input)
        this.chunks.push(copy)
        this.sampleCount += copy.length
        if (this.sampleCount >= notebookLiveChunkSampleLimit(this.sampleRate, 20)) this.flush(false)
      }

      source.connect(processor)
      processor.connect(gain)
      gain.connect(context.destination)
      this.source = source
      this.processor = processor
      this.gain = gain
    } catch (error) {
      this.failure = error instanceof Error ? error.message : 'Live transcription audio preparation failed.'
    }
  }

  private flush(force: boolean) {
    const threshold = notebookLiveChunkSampleLimit(this.sampleRate, 20)
    if (!force && this.sampleCount < threshold) return
    if (this.sampleCount <= 0) return

    const pcm = this.chunks
    this.chunks = []
    this.sampleCount = 0
    const sequence = this.sequence++
    const wav = encodeMonoPcm16Wav(pcm, this.sampleRate)

    const job = (async () => {
      const prior = Array.from(this.segments.values())
        .sort((a, b) => a.sequence - b.sequence)
        .map((segment) => segment.text)
        .join(' ')
        .slice(-4_000)
      const form = new FormData()
      form.set('file', new File([wav], `meeting-chunk-${sequence}.wav`, { type: 'audio/wav' }))
      if (prior) form.set('prompt', prior)

      const response = await this.originalFetch(`/api/notebook/${encodeURIComponent(this.noteId)}/transcription-chunks`, {
        method: 'POST',
        body: form,
      })
      const payload = (await response.json().catch(() => ({}))) as JsonEnvelope<{
        text: string
        provider: string
        model?: string
      }>
      if (!response.ok || payload.success === false || !payload.data?.text?.trim()) {
        throw new Error(payload.error || `Live transcription request failed (${response.status}).`)
      }
      this.segments.set(sequence, {
        sequence,
        text: payload.data.text.trim(),
        provider: payload.data.provider,
        model: payload.data.model,
      })
    })().catch((error) => {
      this.failure = error instanceof Error ? error.message : 'A live transcription chunk failed.'
    })

    this.jobs.push(job)
  }

  finish(): Promise<LiveResult> {
    if (this.finishPromise) return this.finishPromise

    this.finished = true
    if (this.processor) this.processor.onaudioprocess = null
    this.flush(true)
    try { this.source?.disconnect() } catch { /* disconnected */ }
    try { this.processor?.disconnect() } catch { /* disconnected */ }
    try { this.gain?.disconnect() } catch { /* disconnected */ }
    const context = this.audioContext
    this.source = null
    this.processor = null
    this.gain = null
    this.audioContext = null
    if (context) void context.close().catch(() => undefined)

    this.finishPromise = Promise.allSettled(this.jobs).then(() => {
      const segments = Array.from(this.segments.values()).sort((a, b) => a.sequence - b.sequence)
      return {
        text: segments.map((segment) => segment.text).join('\n').trim(),
        segments,
        failure: this.failure,
      }
    })
    return this.finishPromise
  }
}

export function NotebookLiveTranscriptionBridge({ mode }: { mode: NotebookTranscriptionMode }) {
  const activeNoteIdRef = useRef<string | null>(null)
  const pendingRef = useRef(new Map<string, Promise<LiveResult>>())
  const captureRef = useRef<LiveNotebookCapture | null>(null)

  useLayoutEffect(() => {
    if (mode !== 'live-chunks') return
    if (typeof window.MediaRecorder === 'undefined') return

    const originalFetch = window.fetch.bind(window)
    const OriginalMediaRecorder = window.MediaRecorder

    const PatchedMediaRecorder = function PatchedMediaRecorder(
      stream: MediaStream,
      options?: MediaRecorderOptions,
    ) {
      const recorder = new OriginalMediaRecorder(stream, options)
      const noteId = activeNoteIdRef.current
      const capture = noteId ? new LiveNotebookCapture(noteId, stream, originalFetch) : null
      captureRef.current = capture

      recorder.addEventListener('stop', () => {
        if (!capture || !noteId) return
        const result = capture.finish()
        pendingRef.current.set(noteId, result)
        captureRef.current = null
      }, { once: true })

      return recorder
    } as unknown as typeof MediaRecorder

    Object.setPrototypeOf(PatchedMediaRecorder, OriginalMediaRecorder)
    PatchedMediaRecorder.prototype = OriginalMediaRecorder.prototype
    window.MediaRecorder = PatchedMediaRecorder

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input)
      const method = requestMethod(input, init)

      if (url && method === 'GET') {
        const noteId = exactNoteId(url)
        if (noteId) activeNoteIdRef.current = noteId
      }

      const response = await originalFetch(input, init)

      if (url && method === 'POST') {
        const noteId = recordingNoteId(url)
        if (noteId && response.ok) {
          const pending = pendingRef.current.get(noteId)
          if (pending) {
            pendingRef.current.delete(noteId)
            try {
              const payload = (await response.clone().json()) as JsonEnvelope<{ id: string }>
              const recordingId = payload.data?.id
              const result = await pending
              if (recordingId && result.text) {
                const attachResponse = await originalFetch(`/api/notebook/recordings/${encodeURIComponent(recordingId)}`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    action: 'attach-transcript',
                    text: result.text,
                    segments: result.segments,
                  }),
                })
                if (!attachResponse.ok) {
                  const attachPayload = (await attachResponse.json().catch(() => ({}))) as JsonEnvelope<unknown>
                  throw new Error(attachPayload.error || 'Transcript attachment failed; the recording remains saved.')
                }
              }
              if (result.failure) {
                toast.warning('Recording saved. Some live transcription audio could not be processed; the available transcript was retained.')
              }
            } catch (error) {
              toast.warning(error instanceof Error ? error.message : 'Recording saved, but transcription did not finish.')
            }
          }
        }
      }

      return response
    }

    return () => {
      window.fetch = originalFetch
      window.MediaRecorder = OriginalMediaRecorder
      const capture = captureRef.current
      captureRef.current = null
      if (capture) void capture.finish()
      pendingRef.current.clear()
    }
  }, [mode])

  return null
}
