from pathlib import Path
import re

path = Path('src/components/notebook/notebook-workspace.tsx')
source = path.read_text()

if "@/lib/notebook/browser-audio" not in source:
    source = source.replace(
        "import { NotebookMarkdown } from './notebook-markdown'\n",
        "import { NotebookMarkdown } from './notebook-markdown'\nimport { encodeMonoPcm16Wav, notebookLiveChunkSampleLimit } from '@/lib/notebook/browser-audio'\n",
        1,
    )

if "type TranscriptionReadiness" not in source:
    source = source.replace(
        "type AiPreview = {\n",
        "type TranscriptionReadiness = {\n  configured: boolean\n  mode: 'none' | 'direct' | 'live-chunks'\n  provider: string | null\n}\n\ntype LiveTranscriptSegment = {\n  sequence: number\n  text: string\n  provider: string\n  model?: string\n}\n\ntype AiPreview = {\n",
        1,
    )

refs_anchor = "  const [recordingConsent, setRecordingConsent] = useState(false)\n"
if "liveAudioContextRef" not in source:
    source = source.replace(
        refs_anchor,
        refs_anchor + """  const liveModeRef = useRef<TranscriptionReadiness['mode']>('none')
  const liveAudioContextRef = useRef<AudioContext | null>(null)
  const liveAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const liveGainRef = useRef<GainNode | null>(null)
  const livePcmChunksRef = useRef<Float32Array[]>([])
  const livePcmSamplesRef = useRef(0)
  const liveSampleRateRef = useRef(16_000)
  const liveTranscriptSequenceRef = useRef(0)
  const liveTranscriptSegmentsRef = useRef<Map<number, LiveTranscriptSegment>>(new Map())
  const liveTranscriptJobsRef = useRef<Promise<void>[]>([])
  const liveTranscriptFailureRef = useRef<string | null>(null)
""",
        1,
    )

if "const resetLiveTranscription" not in source:
    helpers = r'''  const resetLiveTranscription = useCallback(() => {
    livePcmChunksRef.current = []
    livePcmSamplesRef.current = 0
    liveTranscriptSequenceRef.current = 0
    liveTranscriptSegmentsRef.current = new Map()
    liveTranscriptJobsRef.current = []
    liveTranscriptFailureRef.current = null
  }, [])

  const queueLiveTranscriptionChunk = useCallback((noteId: string, force = false) => {
    const sampleRate = liveSampleRateRef.current
    const targetSamples = notebookLiveChunkSampleLimit(sampleRate, 20)
    if (!force && livePcmSamplesRef.current < targetSamples) return
    if (livePcmSamplesRef.current <= 0) return

    const chunks = livePcmChunksRef.current
    livePcmChunksRef.current = []
    livePcmSamplesRef.current = 0
    const sequence = liveTranscriptSequenceRef.current++
    const wav = encodeMonoPcm16Wav(chunks, sampleRate)
    const priorText = Array.from(liveTranscriptSegmentsRef.current.values())
      .sort((a, b) => a.sequence - b.sequence)
      .map((segment) => segment.text)
      .join(' ')
      .slice(-4_000)

    const job = (async () => {
      const form = new FormData()
      form.set('file', new File([wav], `meeting-chunk-${sequence}.wav`, { type: 'audio/wav' }))
      if (priorText) form.set('prompt', priorText)
      const result = await jsonFetch<{ text: string; provider: string; model?: string }>(
        `/api/notebook/${noteId}/transcription-chunks`,
        { method: 'POST', body: form },
      )
      if (result.text.trim()) {
        liveTranscriptSegmentsRef.current.set(sequence, {
          sequence,
          text: result.text.trim(),
          provider: result.provider,
          model: result.model,
        })
      }
    })().catch((error) => {
      liveTranscriptFailureRef.current = error instanceof Error ? error.message : 'A live transcription chunk failed.'
    })
    liveTranscriptJobsRef.current.push(job)
  }, [])

  const startLiveTranscriptionCapture = useCallback(async (stream: MediaStream, noteId: string) => {
    resetLiveTranscription()
    if (typeof window.AudioContext === 'undefined') {
      liveTranscriptFailureRef.current = 'This browser cannot prepare private live transcription audio.'
      return
    }

    const audioContext = new window.AudioContext()
    await audioContext.resume().catch(() => undefined)
    const sourceNode = audioContext.createMediaStreamSource(stream)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    const gain = audioContext.createGain()
    gain.gain.value = 0
    liveSampleRateRef.current = audioContext.sampleRate

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0)
      const copy = new Float32Array(input.length)
      copy.set(input)
      livePcmChunksRef.current.push(copy)
      livePcmSamplesRef.current += copy.length
      if (livePcmSamplesRef.current >= notebookLiveChunkSampleLimit(liveSampleRateRef.current, 20)) {
        queueLiveTranscriptionChunk(noteId)
      }
    }

    sourceNode.connect(processor)
    processor.connect(gain)
    gain.connect(audioContext.destination)
    liveAudioContextRef.current = audioContext
    liveAudioSourceRef.current = sourceNode
    liveProcessorRef.current = processor
    liveGainRef.current = gain
  }, [queueLiveTranscriptionChunk, resetLiveTranscription])

  const finishLiveTranscriptionCapture = useCallback(async (noteId: string) => {
    if (liveModeRef.current !== 'live-chunks') {
      return { text: '', segments: [] as LiveTranscriptSegment[], failure: null as string | null }
    }

    const processor = liveProcessorRef.current
    if (processor) processor.onaudioprocess = null
    try { liveAudioSourceRef.current?.disconnect() } catch {}
    try { liveProcessorRef.current?.disconnect() } catch {}
    try { liveGainRef.current?.disconnect() } catch {}
    queueLiveTranscriptionChunk(noteId, true)

    const audioContext = liveAudioContextRef.current
    liveAudioSourceRef.current = null
    liveProcessorRef.current = null
    liveGainRef.current = null
    liveAudioContextRef.current = null
    if (audioContext) await audioContext.close().catch(() => undefined)

    const jobs = [...liveTranscriptJobsRef.current]
    await Promise.allSettled(jobs)
    const segments = Array.from(liveTranscriptSegmentsRef.current.values()).sort((a, b) => a.sequence - b.sequence)
    return {
      text: segments.map((segment) => segment.text).join('\n').trim(),
      segments,
      failure: liveTranscriptFailureRef.current,
    }
  }, [queueLiveTranscriptionChunk])

'''
    source = source.replace("  const startRecording = async () => {\n", helpers + "  const startRecording = async () => {\n", 1)

pattern = re.compile(r"  const startRecording = async \(\) => \{.*?\n  const stopRecording = \(\) =>", re.S)
replacement = r'''  const startRecording = async () => {
    if (!activeNote || !recordingConsent) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setSaveMessage('This browser does not support secure in-browser audio recording.')
      return
    }
    try {
      const readiness = await jsonFetch<TranscriptionReadiness>('/api/notebook/transcription-readiness').catch(() => ({
        configured: false,
        mode: 'none' as const,
        provider: null,
      }))
      liveModeRef.current = readiness.mode
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      if (readiness.mode === 'live-chunks') {
        await startLiveTranscriptionCapture(stream, activeNote.id)
      } else {
        resetLiveTranscription()
      }

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      recorder.onstop = async () => {
        const durationMs = Date.now() - recordingStartedAt.current
        const liveTranscriptPromise = finishLiveTranscriptionCapture(activeNote.id)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setRecordingState('uploading')
        try {
          const form = new FormData()
          form.set('file', new File([blob], `meeting-${Date.now()}.webm`, { type: blob.type.split(';')[0] || 'audio/webm' }))
          form.set('durationMs', String(durationMs))
          const uploaded = await jsonFetch<Recording>(`/api/notebook/${activeNote.id}/recordings`, { method: 'POST', body: form })
          const liveTranscript = await liveTranscriptPromise
          if (liveTranscript.text) {
            await jsonFetch(`/api/notebook/recordings/${uploaded.id}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                action: 'attach-transcript',
                text: liveTranscript.text,
                segments: liveTranscript.segments,
              }),
            })
          } else if (readiness.mode === 'live-chunks' && liveTranscript.failure) {
            setSaveMessage(`Recording saved. Live transcription could not finish: ${liveTranscript.failure}`)
          } else if (!readiness.configured) {
            setSaveMessage('Recording saved. Automatic transcription is not configured, so the audio remains available for later retry.')
          }
          await loadDetail(activeNote.id)
          setRightPanel('meeting')
        } catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Recording upload failed.') }
        finally { setRecordingState('idle'); setRecordingSeconds(0) }
      }
      recorderRef.current = recorder
      recordingStartedAt.current = Date.now()
      setRecordingSeconds(0)
      recorder.start(1000)
      setRecordingState('recording')
    } catch (error) {
      setSaveMessage(error instanceof Error ? `Microphone unavailable: ${error.message}` : 'Microphone permission was denied.')
    }
  }

  const stopRecording = () =>'''

if "startLiveTranscriptionCapture(stream, activeNote.id)" not in source:
    raise SystemExit('live transcription helper insertion failed')
source, count = pattern.subn(replacement, source, count=1)
if count != 1:
    raise SystemExit(f'expected one startRecording block, replaced {count}')

path.write_text(source)
