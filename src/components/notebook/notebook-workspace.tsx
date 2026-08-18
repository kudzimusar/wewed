'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  Bot,
  Check,
  ChevronLeft,
  FileClock,
  Link2,
  Loader2,
  Mic,
  MoreHorizontal,
  NotebookPen,
  Pause,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Users,
  WandSparkles,
  X,
} from 'lucide-react'

type Surface = 'planner' | 'admin'
type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

type Note = {
  id: string
  ownerUserId: string
  weddingId: string | null
  title: string
  contentText: string
  noteType: 'GENERAL' | 'MEETING' | 'VOICE' | 'QUICK'
  visibility: 'PRIVATE' | 'WEDDING_TEAM' | 'SELECTED_USERS' | 'ADMIN_INTERNAL' | 'SHARED'
  isPinned: boolean
  archivedAt: string | null
  deletedAt: string | null
  version: number
  updatedAt: string
  shareRole?: 'VIEWER' | 'EDITOR' | null
}

type Version = {
  id: string
  version: number
  title: string
  contentText: string
  source: string
  providerName: string | null
  modelName: string | null
  createdAt: string
}

type Suggestion = {
  id: string
  targetType: string
  actionType: string
  payload: Record<string, unknown>
  rationale: string | null
  evidence: string | null
  confidence: number | null
  status: string
  failureMessage: string | null
}

type Recording = {
  id: string
  status: string
  mimeType: string
  sizeBytes: number
  durationMs: number | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
}

type Detail = {
  note: Note
  versions: Version[]
  suggestions: Suggestion[]
  recordings: Recording[]
  links: Array<{ id: string; entityType: string; entityId: string; labelSnapshot: string | null }>
  shares: Array<{ userId: string; role: string; email: string; name: string | null }>
}

type NotebookContext = {
  role: string
  platformAdmin: boolean
  activeWeddingId: string
  weddings: Array<{ id: string; title: string; date: string; venue: string; canEdit: boolean }>
}

type AiPreview = {
  previewText?: string
  summary?: string
  minutes?: string
  decisions?: unknown[]
  actions?: unknown[]
  questions?: unknown[]
  risks?: unknown[]
  suggestedTitle?: string
  provider?: string
  model?: string
  promptVersion?: string
  answer?: string
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = (await response.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string; code?: string }
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.error || `Request failed (${response.status})`) as Error & { status?: number; code?: string }
    error.status = response.status
    error.code = payload.code
    throw error
  }
  return payload.data as T
}

function formatWhen(value: string) {
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) } catch { return value }
}

function insertMarkdown(
  textarea: HTMLTextAreaElement | null,
  value: string,
  onChange: (value: string) => void,
  before: string,
  after = before,
) {
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end)
  const next = `${value.slice(0, start)}${before}${selected || 'text'}${after}${value.slice(end)}`
  onChange(next)
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(start + before.length, start + before.length + (selected || 'text').length)
  })
}

export function NotebookWorkspace({ surface }: { surface: Surface }) {
  const [context, setContext] = useState<NotebookContext | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<Note['visibility']>('PRIVATE')
  const [noteType, setNoteType] = useState<Note['noteType']>('GENERAL')
  const [selectedWeddingId, setSelectedWeddingId] = useState<string>('')
  const [query, setQuery] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)
  const [askQuestion, setAskQuestion] = useState('')
  const [askResult, setAskResult] = useState<{ answer: string; sources: Array<{ noteId: string; title: string }> } | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState<'VIEWER' | 'EDITOR'>('VIEWER')
  const [linkType, setLinkType] = useState('vendor')
  const [linkId, setLinkId] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [rightPanel, setRightPanel] = useState<'ai' | 'history' | 'share' | 'meeting' | 'links' | null>(null)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingStartedAt = useRef<number>(0)
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'uploading'>('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordingConsent, setRecordingConsent] = useState(false)

  const activeNote = detail?.note ?? null
  const editable = Boolean(activeNote && (!activeNote.shareRole || activeNote.shareRole === 'EDITOR'))

  const loadContext = useCallback(async () => {
    const data = await jsonFetch<NotebookContext>('/api/notebook/context')
    setContext(data)
    setSelectedWeddingId((current) => current || (data.weddings.some((w) => w.id === data.activeWeddingId) ? data.activeWeddingId : ''))
  }, [])

  const loadNotes = useCallback(async () => {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (selectedWeddingId) params.set('weddingId', selectedWeddingId)
    const data = await jsonFetch<Note[]>(`/api/notebook?${params.toString()}`)
    setNotes(data)
    if (!selectedId && data[0]) setSelectedId(data[0].id)
    if (selectedId && !data.some((note) => note.id === selectedId)) setSelectedId(data[0]?.id ?? null)
  }, [query, selectedWeddingId, selectedId])

  const loadDetail = useCallback(async (id: string) => {
    const data = await jsonFetch<Detail>(`/api/notebook/${id}`)
    setDetail(data)
    setTitle(data.note.title)
    setContent(data.note.contentText)
    setVisibility(data.note.visibility)
    setNoteType(data.note.noteType)
    setDirty(false)
    setSaveState('saved')
    setSaveMessage('')
    setAiPreview(null)
    setSelectedSuggestions(new Set(data.suggestions.filter((s) => s.status === 'PENDING').map((s) => s.id)))
  }, [])

  useEffect(() => {
    Promise.all([loadContext(), loadNotes()]).catch((error) => setSaveMessage(error instanceof Error ? error.message : 'Notebook failed to load.')).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handle = setTimeout(() => loadNotes().catch(() => undefined), 250)
    return () => clearTimeout(handle)
  }, [query, selectedWeddingId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    setLoading(true)
    loadDetail(selectedId).catch((error) => setSaveMessage(error instanceof Error ? error.message : 'Could not open note.')).finally(() => setLoading(false))
  }, [selectedId, loadDetail])

  const markDirty = useCallback(() => {
    setDirty(true)
    setSaveState('idle')
  }, [])

  useEffect(() => {
    if (!dirty || !activeNote || !editable) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaveState('saving')
      try {
        const updated = await jsonFetch<Note>(`/api/notebook/${activeNote.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedVersion: activeNote.version,
            title,
            contentText: content,
            visibility,
            noteType,
            weddingId: activeNote.weddingId,
          }),
        })
        setDetail((current) => current ? { ...current, note: updated } : current)
        setNotes((current) => current.map((note) => note.id === updated.id ? updated : note))
        setDirty(false)
        setSaveState('saved')
        setSaveMessage('Saved')
      } catch (error) {
        const typed = error as Error & { status?: number; code?: string }
        if (typed.status === 409 || typed.code === 'NOTE_VERSION_CONFLICT') {
          setSaveState('conflict')
          setSaveMessage('A newer server version exists. Your draft is preserved here; reload when you are ready to reconcile it.')
        } else {
          setSaveState('error')
          setSaveMessage(typed.message)
        }
      }
    }, 850)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [dirty, title, content, visibility, noteType, activeNote, editable])

  useEffect(() => {
    if (recordingState !== 'recording') return
    const timer = setInterval(() => setRecordingSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAt.current) / 1000))), 1000)
    return () => clearInterval(timer)
  }, [recordingState])

  const createNew = async (quick = false) => {
    setBusy(quick ? 'quick' : 'new')
    try {
      const weddingId = selectedWeddingId || null
      const canTeam = Boolean(weddingId && context?.weddings.find((w) => w.id === weddingId)?.canEdit)
      const created = await jsonFetch<Note>('/api/notebook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: quick ? 'Quick note' : 'Untitled note',
          contentText: '',
          weddingId,
          noteType: quick ? 'QUICK' : 'GENERAL',
          visibility: surface === 'planner' && canTeam ? 'PRIVATE' : 'PRIVATE',
          contextType: surface === 'admin' ? 'admin' : weddingId ? 'wedding' : 'portfolio',
        }),
      })
      await loadNotes()
      setSelectedId(created.id)
      setTimeout(() => editorRef.current?.focus(), 50)
    } finally { setBusy(null) }
  }

  const mutateAction = async (body: Record<string, unknown>) => {
    if (!activeNote) return null
    return jsonFetch<unknown>(`/api/notebook/${activeNote.id}/actions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
  }

  const runAi = async (operation: string) => {
    if (!activeNote) return
    setBusy(`ai:${operation}`)
    try {
      const result = await jsonFetch<AiPreview>(`/api/notebook/${activeNote.id}/ai`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation }),
      })
      if (operation === 'SUGGEST_ACTIONS') {
        await loadDetail(activeNote.id)
        setRightPanel('ai')
      } else {
        setAiPreview(result)
        setRightPanel('ai')
      }
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : 'AI request failed.') }
    finally { setBusy(null) }
  }

  const acceptAiPreview = async () => {
    if (!activeNote || !aiPreview?.previewText) return
    setBusy('accept-ai')
    try {
      const updated = await mutateAction({
        action: 'accept-ai', expectedVersion: activeNote.version, previewText: aiPreview.previewText,
        provider: aiPreview.provider, model: aiPreview.model, promptVersion: aiPreview.promptVersion,
      }) as Note
      if (updated) await loadDetail(activeNote.id)
      setAiPreview(null)
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Could not apply AI rewrite.') }
    finally { setBusy(null) }
  }

  const applySelected = async () => {
    if (!activeNote || selectedSuggestions.size === 0) return
    setBusy('apply-suggestions')
    try {
      await mutateAction({ action: 'apply-suggestions', suggestionIds: Array.from(selectedSuggestions) })
      await loadDetail(activeNote.id)
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Could not apply suggestions.') }
    finally { setBusy(null) }
  }

  const startRecording = async () => {
    if (!activeNote || !recordingConsent) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setSaveMessage('This browser does not support secure in-browser audio recording.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      recorder.onstop = async () => {
        const durationMs = Date.now() - recordingStartedAt.current
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setRecordingState('uploading')
        try {
          const form = new FormData()
          form.set('file', new File([blob], `meeting-${Date.now()}.webm`, { type: blob.type.split(';')[0] || 'audio/webm' }))
          form.set('durationMs', String(durationMs))
          await jsonFetch(`/api/notebook/${activeNote.id}/recordings`, { method: 'POST', body: form })
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

  const stopRecording = () => recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop()
  const togglePause = () => {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') { recorder.pause(); setRecordingState('paused') }
    else if (recorder.state === 'paused') { recorder.resume(); recordingStartedAt.current = Date.now() - recordingSeconds * 1000; setRecordingState('recording') }
  }

  const transcribe = async (recordingId: string) => {
    if (!activeNote) return
    setBusy(`transcribe:${recordingId}`)
    try {
      await jsonFetch(`/api/notebook/recordings/${recordingId}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'transcribe' }),
      })
      await loadDetail(activeNote.id)
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Transcription failed; recording is preserved.') }
    finally { setBusy(null) }
  }

  const appendTranscript = async (recordingId: string) => {
    if (!activeNote) return
    setBusy(`append:${recordingId}`)
    try {
      await mutateAction({ action: 'append-transcript', recordingId, expectedVersion: activeNote.version })
      await loadDetail(activeNote.id)
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Could not append transcript.') }
    finally { setBusy(null) }
  }

  const restore = async (version: number) => {
    if (!activeNote) return
    if (!window.confirm(`Restore version ${version}? The current note remains in version history.`)) return
    setBusy(`restore:${version}`)
    try {
      await mutateAction({ action: 'restore-version', version, expectedVersion: activeNote.version })
      await loadDetail(activeNote.id)
    } finally { setBusy(null) }
  }

  const share = async () => {
    if (!shareEmail.trim()) return
    setBusy('share')
    try {
      await mutateAction({ action: 'share', email: shareEmail, role: shareRole })
      setShareEmail('')
      if (activeNote) await loadDetail(activeNote.id)
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Could not share note.') }
    finally { setBusy(null) }
  }

  const addEntityLink = async () => {
    if (!linkType.trim() || !linkId.trim()) return
    setBusy('link')
    try {
      await mutateAction({ action: 'add-link', entityType: linkType, entityId: linkId, labelSnapshot: linkLabel })
      setLinkId(''); setLinkLabel('')
      if (activeNote) await loadDetail(activeNote.id)
    } finally { setBusy(null) }
  }

  const ask = async () => {
    if (!askQuestion.trim()) return
    setBusy('ask')
    try {
      const result = await jsonFetch<{ answer: string; sources: Array<{ noteId: string; title: string }> }>('/api/notebook/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: askQuestion, weddingId: selectedWeddingId || null }),
      })
      setAskResult(result)
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Notebook recall failed.') }
    finally { setBusy(null) }
  }

  const pendingSuggestions = useMemo(() => detail?.suggestions.filter((item) => ['PENDING', 'FAILED'].includes(item.status)) ?? [], [detail])

  if (loading && !context) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-7 animate-spin" aria-label="Loading Notebook" /></div>
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[1700px] flex-col gap-3 p-3 md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur">
        <div>
          <div className="flex items-center gap-2"><NotebookPen className="size-5 text-amber-300" /><h1 className="text-xl font-semibold">Notebook</h1></div>
          <p className="mt-1 text-sm opacity-70">Capture → understand → review → act. AI never changes Wewed records without your approval.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setAskOpen((value) => !value)} className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/10"><Sparkles className="mr-2 inline size-4" />Ask Notebook</button>
          <button onClick={() => createNew(true)} disabled={busy === 'quick'} className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm hover:bg-amber-300/20"><Plus className="mr-2 inline size-4" />Quick note</button>
          <button onClick={() => createNew(false)} disabled={busy === 'new'} className="rounded-xl bg-amber-300 px-3 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-200"><Plus className="mr-2 inline size-4" />New note</button>
        </div>
      </header>

      {askOpen && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex gap-2">
            <input value={askQuestion} onChange={(e) => setAskQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="What did the venue say about generator backup?" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-amber-300/60" />
            <button onClick={ask} disabled={busy === 'ask'} className="rounded-xl bg-amber-300 px-4 py-2 font-medium text-stone-950">{busy === 'ask' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</button>
          </div>
          {askResult && <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"><div className="whitespace-pre-wrap">{askResult.answer}</div>{askResult.sources.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{askResult.sources.map((source) => <button key={source.noteId} onClick={() => setSelectedId(source.noteId)} className="rounded-full border border-white/15 px-2 py-1 text-xs hover:bg-white/10">{source.title}</button>)}</div>}</div>}
        </section>
      )}

      {saveMessage && <div className={`rounded-xl border px-3 py-2 text-sm ${saveState === 'conflict' || saveState === 'error' ? 'border-red-400/40 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>{saveMessage}{saveState === 'conflict' && activeNote && <button onClick={() => loadDetail(activeNote.id)} className="ml-3 underline">Reload server version</button>}</div>}

      <div className="grid min-h-[720px] flex-1 grid-cols-1 gap-3 lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className={`${selectedId ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col rounded-2xl border border-white/10 bg-white/5`}>
          <div className="space-y-2 border-b border-white/10 p-3">
            <div className="relative"><Search className="absolute left-3 top-2.5 size-4 opacity-50" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-300/60" /></div>
            <select value={selectedWeddingId} onChange={(e) => setSelectedWeddingId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm">
              <option value="">Personal / all accessible</option>
              {context?.weddings.map((wedding) => <option key={wedding.id} value={wedding.id}>{wedding.title}</option>)}
            </select>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {notes.length === 0 && <div className="p-6 text-center text-sm opacity-60">No notes here yet. Create the first page.</div>}
            {notes.map((note) => <button key={note.id} onClick={() => setSelectedId(note.id)} className={`mb-1 w-full rounded-xl p-3 text-left transition ${selectedId === note.id ? 'bg-amber-300/15 ring-1 ring-amber-300/30' : 'hover:bg-white/5'}`}>
              <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="truncate font-medium">{note.title || 'Untitled note'}</div><div className="mt-1 line-clamp-2 text-xs opacity-60">{note.contentText || 'Empty note'}</div></div>{note.isPinned && <Pin className="size-3.5 shrink-0 text-amber-300" />}</div>
              <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-wide opacity-50"><span>{note.noteType}</span><span>·</span><span>{formatWhen(note.updatedAt)}</span></div>
            </button>)}
          </div>
        </aside>

        <main className={`${!selectedId ? 'hidden lg:flex' : 'flex'} min-w-0 flex-col rounded-2xl border border-white/10 bg-white/5`}>
          {!activeNote ? <div className="flex flex-1 flex-col items-center justify-center p-10 text-center"><NotebookPen className="mb-3 size-12 opacity-30" /><h2 className="text-lg font-medium">Your working memory lives here</h2><p className="mt-1 max-w-md text-sm opacity-60">Create personal notes, wedding meeting pages, voice notes and AI-assisted action summaries without leaving Wewed.</p></div> : <>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
              <button onClick={() => setSelectedId(null)} className="rounded-lg p-2 hover:bg-white/10 lg:hidden"><ChevronLeft className="size-4" /></button>
              <select value={noteType} disabled={!editable} onChange={(e) => { setNoteType(e.target.value as Note['noteType']); markDirty() }} className="rounded-lg border border-white/10 bg-stone-900 px-2 py-1.5 text-xs"><option value="GENERAL">General</option><option value="MEETING">Meeting</option><option value="VOICE">Voice</option><option value="QUICK">Quick</option></select>
              <select value={visibility} disabled={!editable} onChange={(e) => { setVisibility(e.target.value as Note['visibility']); markDirty() }} className="rounded-lg border border-white/10 bg-stone-900 px-2 py-1.5 text-xs">
                <option value="PRIVATE">Private</option>
                {activeNote.weddingId && <option value="WEDDING_TEAM">Wedding team</option>}
                <option value="SELECTED_USERS">Selected users</option>
                {activeNote.weddingId && <option value="SHARED">Shared wedding context</option>}
                {context?.platformAdmin && <option value="ADMIN_INTERNAL">Admin internal</option>}
              </select>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                <span className="mr-2 text-xs opacity-55">{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? `Saved · v${activeNote.version}` : saveState === 'conflict' ? 'Conflict' : 'Editing'}</span>
                <button onClick={() => setRightPanel('ai')} className="rounded-lg p-2 hover:bg-white/10" title="AI"><WandSparkles className="size-4" /></button>
                <button onClick={() => setRightPanel('meeting')} className="rounded-lg p-2 hover:bg-white/10" title="Meeting and voice"><Mic className="size-4" /></button>
                <button onClick={() => setRightPanel('history')} className="rounded-lg p-2 hover:bg-white/10" title="Version history"><FileClock className="size-4" /></button>
                <button onClick={() => setRightPanel('share')} className="rounded-lg p-2 hover:bg-white/10" title="Share"><Share2 className="size-4" /></button>
                <button onClick={() => setRightPanel('links')} className="rounded-lg p-2 hover:bg-white/10" title="Linked records"><Link2 className="size-4" /></button>
                <button onClick={async () => { if (!activeNote) return; await jsonFetch(`/api/notebook/${activeNote.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedVersion: activeNote.version, isPinned: !activeNote.isPinned }) }); await loadDetail(activeNote.id); await loadNotes() }} className="rounded-lg p-2 hover:bg-white/10" title="Pin"><Pin className={`size-4 ${activeNote.isPinned ? 'fill-current text-amber-300' : ''}`} /></button>
                <button onClick={async () => { if (!activeNote) return; await jsonFetch(`/api/notebook/${activeNote.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedVersion: activeNote.version, archived: true }) }); setSelectedId(null); await loadNotes() }} className="rounded-lg p-2 hover:bg-white/10" title="Archive"><Archive className="size-4" /></button>
                <button onClick={async () => { if (!activeNote || !window.confirm('Move this note to Trash? It can be restored later.')) return; await jsonFetch(`/api/notebook/${activeNote.id}`, { method: 'DELETE' }); setSelectedId(null); await loadNotes() }} className="rounded-lg p-2 hover:bg-red-500/15" title="Trash"><Trash2 className="size-4" /></button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
              <section className="min-w-0 flex-1 p-4 md:p-6">
                <input value={title} disabled={!editable} onChange={(e) => { setTitle(e.target.value); markDirty() }} placeholder="Note title" className="mb-4 w-full bg-transparent text-2xl font-semibold outline-none placeholder:opacity-30 md:text-3xl" />
                <div className="mb-2 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/10 p-1.5 text-xs">
                  <button onClick={() => insertMarkdown(editorRef.current, content, (v) => { setContent(v); markDirty() }, '**')} className="rounded px-2 py-1 hover:bg-white/10"><b>B</b></button>
                  <button onClick={() => insertMarkdown(editorRef.current, content, (v) => { setContent(v); markDirty() }, '_')} className="rounded px-2 py-1 italic hover:bg-white/10">I</button>
                  <button onClick={() => insertMarkdown(editorRef.current, content, (v) => { setContent(v); markDirty() }, '## ', '')} className="rounded px-2 py-1 hover:bg-white/10">H2</button>
                  <button onClick={() => insertMarkdown(editorRef.current, content, (v) => { setContent(v); markDirty() }, '- ', '')} className="rounded px-2 py-1 hover:bg-white/10">• List</button>
                  <button onClick={() => insertMarkdown(editorRef.current, content, (v) => { setContent(v); markDirty() }, '- [ ] ', '')} className="rounded px-2 py-1 hover:bg-white/10">☐ Task</button>
                  <button onClick={() => insertMarkdown(editorRef.current, content, (v) => { setContent(v); markDirty() }, '> ', '')} className="rounded px-2 py-1 hover:bg-white/10">Quote</button>
                  <button onClick={() => insertMarkdown(editorRef.current, content, (v) => { setContent(v); markDirty() }, '[', '](https://)')} className="rounded px-2 py-1 hover:bg-white/10">Link</button>
                </div>
                <textarea ref={editorRef} value={content} disabled={!editable} onChange={(e) => { setContent(e.target.value); markDirty() }} placeholder="Start writing. Use Markdown for headings, lists, checklists, quotes and links…" className="min-h-[520px] w-full resize-none bg-transparent text-[15px] leading-7 outline-none placeholder:opacity-30 disabled:opacity-70 md:min-h-[620px]" />
              </section>

              {rightPanel && <aside className="w-full border-t border-white/10 bg-black/10 p-4 xl:w-[390px] xl:border-l xl:border-t-0">
                <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold capitalize">{rightPanel === 'ai' ? 'AI & suggested actions' : rightPanel}</h3><button onClick={() => setRightPanel(null)} className="rounded p-1 hover:bg-white/10"><X className="size-4" /></button></div>

                {rightPanel === 'ai' && <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ['IMPROVE','Improve'],['GRAMMAR','Grammar'],['SHORTEN','Shorten'],['PROFESSIONAL','Professional'],
                      ['CHECKLIST','Checklist'],['STRUCTURE_MEETING','Structure meeting'],['ANALYZE_MEETING','Analyze meeting'],['SUGGEST_ACTIONS','Suggest Wewed actions'],
                    ].map(([operation, label]) => <button key={operation} onClick={() => runAi(operation)} disabled={busy === `ai:${operation}`} className="rounded-xl border border-white/10 px-3 py-2 text-left hover:bg-white/10">{busy === `ai:${operation}` ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : <Sparkles className="mr-1 inline size-3 text-amber-300" />}{label}</button>)}
                  </div>
                  {aiPreview && <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm">
                    {aiPreview.previewText ? <><div className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">Preview — nothing changed yet</div><div className="max-h-80 overflow-auto whitespace-pre-wrap">{aiPreview.previewText}</div><div className="mt-3 flex gap-2"><button onClick={acceptAiPreview} className="rounded-lg bg-amber-300 px-3 py-2 font-medium text-stone-950"><Check className="mr-1 inline size-4" />Accept rewrite</button><button onClick={() => setAiPreview(null)} className="rounded-lg border border-white/10 px-3 py-2">Cancel</button></div></> : <div className="space-y-2"><p className="whitespace-pre-wrap">{aiPreview.summary || aiPreview.answer || aiPreview.minutes || JSON.stringify(aiPreview, null, 2)}</p>{aiPreview.suggestedTitle && <p className="text-xs opacity-60">Suggested title: {aiPreview.suggestedTitle}</p>}</div>}
                  </div>}
                  {pendingSuggestions.length > 0 && <div className="space-y-2"><div className="flex items-center justify-between"><h4 className="text-sm font-medium">Review suggestions</h4><span className="text-xs opacity-50">{selectedSuggestions.size} selected</span></div>{pendingSuggestions.map((suggestion) => <label key={suggestion.id} className="block rounded-xl border border-white/10 p-3 text-sm"><div className="flex gap-2"><input type="checkbox" checked={selectedSuggestions.has(suggestion.id)} onChange={(e) => setSelectedSuggestions((current) => { const next = new Set(current); e.target.checked ? next.add(suggestion.id) : next.delete(suggestion.id); return next })} /><div><div className="font-medium">{suggestion.actionType.replaceAll('_',' ')}</div><div className="mt-1 text-xs opacity-65">{suggestion.rationale || JSON.stringify(suggestion.payload)}</div>{suggestion.evidence && <div className="mt-2 border-l-2 border-amber-300/30 pl-2 text-xs opacity-55">Source: {suggestion.evidence}</div>}{suggestion.failureMessage && <div className="mt-2 text-xs text-red-300">{suggestion.failureMessage}</div>}</div></div></label>)}<button onClick={applySelected} disabled={selectedSuggestions.size === 0 || busy === 'apply-suggestions'} className="w-full rounded-xl bg-amber-300 px-3 py-2 font-semibold text-stone-950">Apply {selectedSuggestions.size} selected change{selectedSuggestions.size === 1 ? '' : 's'}</button></div>}
                </div>}

                {rightPanel === 'history' && <div className="space-y-2">{detail.versions.map((version) => <div key={version.id} className="rounded-xl border border-white/10 p-3 text-sm"><div className="flex items-center justify-between"><span className="font-medium">Version {version.version}</span><span className="text-xs opacity-50">{version.source}</span></div><div className="mt-1 text-xs opacity-55">{formatWhen(version.createdAt)}{version.modelName ? ` · ${version.modelName}` : ''}</div>{version.version !== activeNote.version && <button onClick={() => restore(version.version)} className="mt-2 text-xs text-amber-200 underline">Restore this version</button>}</div>)}</div>}

                {rightPanel === 'share' && <div className="space-y-3"><p className="text-xs opacity-65">Private notes stay private. Sharing is explicit and can be revoked.</p><input value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="Existing Wewed user email" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" /><select value={shareRole} onChange={(e) => setShareRole(e.target.value as 'VIEWER'|'EDITOR')} className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm"><option value="VIEWER">Can view</option><option value="EDITOR">Can edit</option></select><button onClick={share} className="w-full rounded-xl bg-amber-300 px-3 py-2 font-medium text-stone-950"><Users className="mr-2 inline size-4" />Share</button>{detail.shares.map((item) => <div key={item.userId} className="flex items-center justify-between rounded-xl border border-white/10 p-2 text-xs"><div><div>{item.name || item.email}</div><div className="opacity-50">{item.role}</div></div><button onClick={async () => { await mutateAction({ action: 'revoke-share', userId: item.userId }); await loadDetail(activeNote.id) }} className="rounded p-1 hover:bg-red-500/10"><X className="size-3" /></button></div>)}</div>}

                {rightPanel === 'links' && <div className="space-y-3"><p className="text-xs opacity-65">Link this note to canonical Wewed records. Notebook does not copy or own those records.</p><select value={linkType} onChange={(e) => setLinkType(e.target.value)} className="w-full rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm">{['wedding','task','budget_item','vendor','guest','timeline_item','seating','communication','support_case','business_account','user','quote','booking','payment'].map((type) => <option key={type}>{type}</option>)}</select><input value={linkId} onChange={(e) => setLinkId(e.target.value)} placeholder="Record ID" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" /><input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label (optional)" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" /><button onClick={addEntityLink} className="w-full rounded-xl bg-amber-300 px-3 py-2 font-medium text-stone-950"><Link2 className="mr-2 inline size-4" />Link record</button>{detail.links.map((link) => <div key={link.id} className="rounded-xl border border-white/10 p-2 text-xs"><div className="font-medium">{link.entityType}: {link.labelSnapshot || link.entityId}</div></div>)}</div>}

                {rightPanel === 'meeting' && <div className="space-y-4"><div className="rounded-xl border border-white/10 p-3"><label className="flex gap-2 text-xs"><input type="checkbox" checked={recordingConsent} onChange={(e) => setRecordingConsent(e.target.checked)} /><span>I have informed participants that this meeting may be recorded/transcribed and have the required consent.</span></label><div className="mt-3 flex items-center gap-2"><button onClick={startRecording} disabled={!recordingConsent || recordingState !== 'idle'} className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium disabled:opacity-40"><Mic className="mr-2 inline size-4" />Record</button>{(recordingState === 'recording' || recordingState === 'paused') && <><button onClick={togglePause} className="rounded-full border border-white/15 p-2">{recordingState === 'paused' ? <Mic className="size-4" /> : <Pause className="size-4" />}</button><button onClick={stopRecording} className="rounded-full border border-white/15 p-2"><Square className="size-4 fill-current" /></button><span className="font-mono text-sm">{Math.floor(recordingSeconds / 60).toString().padStart(2,'0')}:{(recordingSeconds % 60).toString().padStart(2,'0')}</span></>}{recordingState === 'uploading' && <span className="text-xs"><Loader2 className="mr-1 inline size-3 animate-spin" />Saving recording…</span>}</div></div>{detail.recordings.map((recording) => <div key={recording.id} className="rounded-xl border border-white/10 p-3 text-sm"><div className="flex items-center justify-between"><span>{formatWhen(recording.createdAt)}</span><span className="text-xs opacity-60">{recording.status}</span></div><div className="mt-1 text-xs opacity-50">{Math.round(recording.sizeBytes / 1024)} KB{recording.durationMs ? ` · ${Math.round(recording.durationMs / 1000)}s` : ''}</div>{recording.errorMessage && <div className="mt-2 text-xs text-amber-200">{recording.errorMessage}</div>}<div className="mt-2 flex flex-wrap gap-2"><button onClick={() => transcribe(recording.id)} disabled={busy === `transcribe:${recording.id}`} className="rounded-lg border border-white/10 px-2 py-1 text-xs">{recording.status === 'FAILED' ? 'Retry transcription' : 'Transcribe'}</button>{recording.status === 'TRANSCRIBED' && <button onClick={() => appendTranscript(recording.id)} className="rounded-lg border border-white/10 px-2 py-1 text-xs">Append transcript to note</button>}</div></div>)}</div>}
              </aside>}
            </div>
          </>}
        </main>
      </div>
    </div>
  )
}
