'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArchiveRestore,
  Download,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react'

type Note = {
  id: string
  title: string
  contentText: string
  version: number
  tags?: string[]
  archivedAt: string | null
  deletedAt: string | null
  updatedAt: string
}

type Attachment = {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

type Recording = {
  id: string
  status: string
  mimeType: string
  sizeBytes: number
  durationMs: number | null
  errorMessage: string | null
  createdAt: string
}

type RecordingReview = {
  signedUrl: string
  transcript: null | {
    text: string
    revision: number
    language: string | null
    provider: string | null
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = (await response.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string }
  if (!response.ok || payload.success === false) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload.data as T
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function NotebookManagement({ surface }: { surface: 'planner' | 'admin' }) {
  const notebookHref = surface === 'planner' ? '/planner/notebook' : '/admin/notebook'
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [review, setReview] = useState<Record<string, RecordingReview>>({})
  const [transcriptDraft, setTranscriptDraft] = useState<Record<string, string>>({})
  const [tagsInput, setTagsInput] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const selected = useMemo(() => notes.find((note) => note.id === selectedId) ?? null, [notes, selectedId])
  const live = useMemo(() => notes.filter((note) => !note.deletedAt && !note.archivedAt), [notes])
  const archived = useMemo(() => notes.filter((note) => !note.deletedAt && Boolean(note.archivedAt)), [notes])
  const trashed = useMemo(() => notes.filter((note) => Boolean(note.deletedAt)), [notes])

  const loadNotes = useCallback(async () => {
    const data = await api<Note[]>('/api/notebook?archived=1&deleted=1&limit=500')
    setNotes(data)
    setSelectedId((current) => current && data.some((note) => note.id === current) ? current : data.find((note) => !note.deletedAt)?.id ?? data[0]?.id ?? '')
  }, [])

  const loadAssets = useCallback(async (noteId: string) => {
    const [files, detail] = await Promise.all([
      api<Attachment[]>(`/api/notebook/${noteId}/attachments`),
      api<{ recordings: Recording[] }>(`/api/notebook/${noteId}`),
    ])
    setAttachments(files)
    setRecordings(detail.recordings)
  }, [])

  useEffect(() => {
    setBusy('load')
    loadNotes().catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load Notebook.')).finally(() => setBusy(''))
  }, [loadNotes])

  useEffect(() => {
    if (!selected) return
    setTagsInput(Array.isArray(selected.tags) ? selected.tags.join(', ') : '')
    if (selected.deletedAt) {
      setAttachments([])
      setRecordings([])
      return
    }
    loadAssets(selected.id).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load note files.'))
  }, [selected?.id, selected?.deletedAt, loadAssets]) // eslint-disable-line react-hooks/exhaustive-deps

  const postAction = async (noteId: string, body: Record<string, unknown>) => api(`/api/notebook/${noteId}/actions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })

  const saveTags = async () => {
    if (!selected) return
    setBusy('tags'); setError('')
    try {
      const tags = tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean)
      await postAction(selected.id, { action: 'set-tags', tags })
      await loadNotes()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save tags.') }
    finally { setBusy('') }
  }

  const upload = async (file: File) => {
    if (!selected) return
    setBusy('upload'); setError('')
    try {
      const form = new FormData(); form.set('file', file)
      await api(`/api/notebook/${selected.id}/attachments`, { method: 'POST', body: form })
      await loadAssets(selected.id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Upload failed.') }
    finally { setBusy('') }
  }

  const download = async (attachment: Attachment) => {
    setBusy(`download:${attachment.id}`)
    try {
      const data = await api<{ signedUrl: string }>(`/api/notebook/attachments/${attachment.id}`)
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Download failed.') }
    finally { setBusy('') }
  }

  const deleteFile = async (attachment: Attachment) => {
    if (!selected || !window.confirm(`Delete ${attachment.fileName}?`)) return
    setBusy(`delete:${attachment.id}`)
    try {
      await api(`/api/notebook/attachments/${attachment.id}`, { method: 'DELETE' })
      await loadAssets(selected.id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Delete failed.') }
    finally { setBusy('') }
  }

  const reviewRecording = async (recordingId: string) => {
    setBusy(`review:${recordingId}`)
    try {
      const data = await api<RecordingReview>(`/api/notebook/recordings/${recordingId}`)
      setReview((current) => ({ ...current, [recordingId]: data }))
      setTranscriptDraft((current) => ({ ...current, [recordingId]: data.transcript?.text ?? '' }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open recording.') }
    finally { setBusy('') }
  }

  const transcribe = async (recordingId: string) => {
    if (!selected) return
    setBusy(`transcribe:${recordingId}`)
    try {
      await api(`/api/notebook/recordings/${recordingId}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'transcribe' }),
      })
      await loadAssets(selected.id)
      await reviewRecording(recordingId)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Transcription failed. Recording remains saved.') }
    finally { setBusy('') }
  }

  const saveTranscript = async (recordingId: string) => {
    const text = transcriptDraft[recordingId]?.trim()
    if (!text) return
    setBusy(`transcript:${recordingId}`)
    try {
      await api(`/api/notebook/recordings/${recordingId}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update-transcript', text }),
      })
      await reviewRecording(recordingId)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Transcript save failed.') }
    finally { setBusy('') }
  }

  const unarchive = async (note: Note) => {
    setBusy(`unarchive:${note.id}`)
    try {
      await api(`/api/notebook/${note.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: note.version, archived: false }),
      })
      await loadNotes()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not restore archived note.') }
    finally { setBusy('') }
  }

  const restoreTrash = async (note: Note) => {
    setBusy(`restore:${note.id}`)
    try {
      await postAction(note.id, { action: 'restore-deleted' })
      await loadNotes()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not restore note.') }
    finally { setBusy('') }
  }

  return (
    <div className="dark min-h-dvh bg-espresso p-3 pb-28 text-champagne md:p-6 md:pb-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/15 bg-white/[0.035] p-4">
          <div><p className="text-[10px] uppercase tracking-[0.18em] text-gold">Notebook management</p><h1 className="mt-1 text-xl font-semibold">Files, tags, recordings & recovery</h1><p className="mt-1 text-sm text-champagne/60">Private assets use signed access. Deleted notes remain recoverable.</p></div>
          <div className="flex gap-2"><button onClick={() => loadNotes()} className="rounded-xl border border-gold/20 px-3 py-2 text-sm text-gold"><RefreshCw className="mr-2 inline size-4" />Refresh</button><a href={notebookHref} className="rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-espresso">Back to Notebook</a></div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-gold/12 bg-white/[0.025] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold/75">Choose note</p>
            <div className="max-h-[70vh] space-y-1 overflow-auto">
              {notes.map((note) => <button key={note.id} onClick={() => setSelectedId(note.id)} className={`w-full rounded-xl p-2.5 text-left text-sm ${selectedId === note.id ? 'bg-gold/15 ring-1 ring-gold/25' : 'hover:bg-white/5'}`}><div className="truncate font-medium">{note.title}</div><div className="mt-1 text-[10px] uppercase tracking-wide text-champagne/45">{note.deletedAt ? 'Trash' : note.archivedAt ? 'Archived' : 'Active'} · v{note.version}</div></button>)}
              {!notes.length && busy === 'load' && <div className="p-4 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></div>}
            </div>
          </aside>

          <main className="space-y-4">
            {selected && !selected.deletedAt && <>
              <section className="rounded-2xl border border-gold/12 bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2"><Tag className="size-4 text-gold" /><h2 className="font-semibold">Tags</h2></div>
                <div className="flex gap-2"><input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="venue, florist, decision, urgent" className="min-w-0 flex-1 rounded-xl border border-gold/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-gold/50" /><button onClick={saveTags} disabled={busy === 'tags'} className="rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-espresso">{busy === 'tags' ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}</button></div>
                <p className="mt-2 text-xs text-champagne/45">Comma-separated; duplicates are normalized. Tags are searchable metadata, not separate shadow records.</p>
              </section>

              <section className="rounded-2xl border border-gold/12 bg-white/[0.025] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Paperclip className="size-4 text-gold" /><h2 className="font-semibold">Private attachments</h2></div><label className="cursor-pointer rounded-xl border border-gold/20 px-3 py-2 text-xs text-gold"><Upload className="mr-1 inline size-3.5" />Upload<input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,.docx,.xlsx" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.currentTarget.value = '' }} /></label></div>
                <div className="space-y-2">{attachments.map((file) => <div key={file.id} className="flex items-center gap-3 rounded-xl border border-gold/10 p-3"><FileText className="size-4 shrink-0 text-gold/75" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{file.fileName}</div><div className="text-[11px] text-champagne/45">{file.mimeType} · {formatBytes(file.sizeBytes)}</div></div><button onClick={() => download(file)} className="rounded-lg p-2 hover:bg-white/10" aria-label={`Download ${file.fileName}`}><Download className="size-4" /></button><button onClick={() => deleteFile(file)} className="rounded-lg p-2 hover:bg-red-500/10" aria-label={`Delete ${file.fileName}`}><Trash2 className="size-4" /></button></div>)}{!attachments.length && <p className="text-sm text-champagne/45">No attachments.</p>}</div>
              </section>

              <section className="rounded-2xl border border-gold/12 bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2"><Mic className="size-4 text-gold" /><h2 className="font-semibold">Recordings & transcripts</h2></div>
                <div className="space-y-3">{recordings.map((recording) => <div key={recording.id} className="rounded-xl border border-gold/10 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-medium">Meeting recording</div><div className="text-[11px] text-champagne/45">{recording.status} · {formatBytes(recording.sizeBytes)}{recording.durationMs ? ` · ${Math.round(recording.durationMs / 1000)}s` : ''}</div></div><div className="flex gap-2"><button onClick={() => reviewRecording(recording.id)} className="rounded-lg border border-gold/15 px-2 py-1 text-xs">Review</button><button onClick={() => transcribe(recording.id)} className="rounded-lg border border-gold/15 px-2 py-1 text-xs">{recording.status === 'FAILED' ? 'Retry transcription' : 'Transcribe'}</button></div></div>{recording.errorMessage && <p className="mt-2 text-xs text-amber-200">{recording.errorMessage}</p>}{review[recording.id] && <div className="mt-3 space-y-2"><audio controls src={review[recording.id].signedUrl} className="w-full" /><textarea value={transcriptDraft[recording.id] ?? ''} onChange={(event) => setTranscriptDraft((current) => ({ ...current, [recording.id]: event.target.value }))} rows={8} placeholder="Transcript appears here after transcription. Correct names or wording before using it in the note." className="w-full rounded-xl border border-gold/15 bg-black/20 p-3 text-sm leading-6 outline-none" />{review[recording.id].transcript && <button onClick={() => saveTranscript(recording.id)} className="rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-espresso"><Save className="mr-1 inline size-3.5" />Save corrected transcript</button>}</div>}</div>)}{!recordings.length && <p className="text-sm text-champagne/45">No recordings on this note.</p>}</div>
              </section>
            </>}

            <section className="rounded-2xl border border-gold/12 bg-white/[0.025] p-4">
              <div className="mb-3 flex items-center gap-2"><ArchiveRestore className="size-4 text-gold" /><h2 className="font-semibold">Recovery</h2></div>
              <div className="grid gap-3 md:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-champagne/55">Archived ({archived.length})</h3><div className="space-y-2">{archived.map((note) => <div key={note.id} className="flex items-center justify-between gap-2 rounded-xl border border-gold/10 p-2.5 text-sm"><span className="min-w-0 truncate">{note.title}</span><button onClick={() => unarchive(note)} className="shrink-0 rounded-lg border border-gold/15 px-2 py-1 text-xs">Restore</button></div>)}{!archived.length && <p className="text-xs text-champagne/40">Nothing archived.</p>}</div></div><div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-champagne/55">Trash ({trashed.length})</h3><div className="space-y-2">{trashed.map((note) => <div key={note.id} className="flex items-center justify-between gap-2 rounded-xl border border-gold/10 p-2.5 text-sm"><span className="min-w-0 truncate">{note.title}</span><button onClick={() => restoreTrash(note)} className="shrink-0 rounded-lg border border-gold/15 px-2 py-1 text-xs">Restore</button></div>)}{!trashed.length && <p className="text-xs text-champagne/40">Trash is empty.</p>}</div></div></div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
