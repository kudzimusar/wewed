'use client'

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Loader2, Paperclip, Send, ShieldAlert, X } from 'lucide-react'

const MAX_FILES = 5
const MAX_BYTES = 25 * 1024 * 1024
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.docx,.xlsx'

interface SelectedFile {
  id: string
  file: File
  caption: string
}

function clientFileError(file: File): string | null {
  if (file.size <= 0) return `${file.name} is empty.`
  if (file.size > MAX_BYTES) return `${file.name} is larger than 25 MB.`
  return null
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function parseResponse(response: Response) {
  return response.json().catch(() => null) as Promise<{ success?: boolean; error?: string } | null>
}

export function CommunicationComposer(props: {
  conversationId: string
  draft: string
  internalNote: boolean
  disabled?: boolean
  onDraftChange: (value: string) => void
  onSent: () => Promise<void> | void
  onError: (message: string | null) => void
}) {
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [failed, setFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  useEffect(() => {
    setFiles([])
    setProgress(0)
    setFailed(false)
    xhrRef.current?.abort()
    xhrRef.current = null
  }, [props.conversationId])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`
  }, [props.draft])

  function addFiles(incoming: File[]) {
    props.onError(null)
    const next = [...files]
    for (const file of incoming) {
      const error = clientFileError(file)
      if (error) {
        props.onError(error)
        continue
      }
      if (next.length >= MAX_FILES) {
        props.onError(`Attach at most ${MAX_FILES} files to one message.`)
        break
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        caption: '',
      })
    }
    setFiles(next)
    setFailed(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== 'Enter'
      || event.shiftKey
      || event.nativeEvent.isComposing
      || typeof window === 'undefined'
      || !window.matchMedia('(min-width: 1024px)').matches
    ) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  async function sendText() {
    const response = await fetch(
      `/api/communications/conversations/${encodeURIComponent(props.conversationId)}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: props.draft.trim(), internalNote: props.internalNote }),
      },
    )
    const payload = await parseResponse(response)
    if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to send message.')
  }

  function sendFiles(): Promise<void> {
    return new Promise((resolve, reject) => {
      const form = new FormData()
      for (const item of files) {
        form.append('files', item.file)
        form.append('captions', item.caption)
      }
      form.append('body', props.draft.trim())
      form.append('internalNote', props.internalNote ? 'true' : 'false')

      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr
      xhr.open('POST', `/api/communications/conversations/${encodeURIComponent(props.conversationId)}/attachments`)
      xhr.responseType = 'json'
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.max(1, Math.round((event.loaded / event.total) * 100)))
      }
      xhr.onerror = () => reject(new Error('Attachment upload failed. Your selected files are still ready to retry.'))
      xhr.onabort = () => reject(new Error('Attachment upload cancelled.'))
      xhr.onload = () => {
        const payload = xhr.response as { success?: boolean; error?: string } | null
        if (xhr.status < 200 || xhr.status >= 300 || !payload?.success) {
          reject(new Error(payload?.error || 'Attachment upload failed.'))
          return
        }
        resolve()
      }
      xhr.send(form)
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending || props.disabled || (!props.draft.trim() && files.length === 0)) return
    setSending(true)
    setFailed(false)
    setProgress(files.length > 0 ? 1 : 0)
    props.onError(null)
    try {
      if (files.length > 0) await sendFiles()
      else await sendText()
      setFiles([])
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
      await props.onSent()
    } catch (error) {
      setFailed(true)
      props.onError(error instanceof Error ? error.message : 'Unable to send message.')
    } finally {
      xhrRef.current = null
      setSending(false)
    }
  }

  function cancelUpload() {
    xhrRef.current?.abort()
  }

  const officeSelected = files.some((item) => /\.(docx|xlsx)$/i.test(item.file.name))

  return (
    <form
      onSubmit={submit}
      className={`space-y-2 rounded-2xl ${dragging ? 'ring-2 ring-gold/45' : ''}`}
      data-communications-attachment-composer="true"
      onDragEnter={(event) => { event.preventDefault(); if (!props.disabled) setDragging(true) }}
      onDragOver={(event) => { event.preventDefault(); if (!props.disabled) setDragging(true) }}
      onDragLeave={(event) => {
        event.preventDefault()
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        if (!props.disabled) addFiles(Array.from(event.dataTransfer.files))
      }}
    >
      {files.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-gold/15 bg-ivory/55 p-2.5" data-communications-selected-files="true">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-espresso/55">
            <span>{files.length} file{files.length === 1 ? '' : 's'} ready</span>
            <span>Drag more here · max {MAX_FILES}</span>
          </div>
          {files.map((item) => (
            <div key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-white p-2">
              {item.file.type.startsWith('image/') ? <ImageIcon className="size-4 text-gold" /> : <FileText className="size-4 text-gold" />}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{item.file.name}</p>
                <p className="text-[10px] text-espresso/40">{fileSize(item.file.size)}</p>
                <input
                  value={item.caption}
                  maxLength={500}
                  onChange={(event) => setFiles((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, caption: event.target.value } : candidate))}
                  placeholder="Optional caption"
                  className="mt-1 h-7 w-full rounded-md border border-gold/15 bg-ivory/30 px-2 text-[11px] outline-none focus:border-gold/45"
                />
              </div>
              <button type="button" disabled={sending} onClick={() => setFiles((current) => current.filter((candidate) => candidate.id !== item.id))} className="inline-flex size-8 items-center justify-center rounded-full text-espresso/45 hover:bg-champagne/45" aria-label={`Remove ${item.file.name}`}>
                <X className="size-4" />
              </button>
            </div>
          ))}
          {officeSelected ? (
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-clay-light"><ShieldAlert className="mt-0.5 size-3 shrink-0" />DOCX/XLSX will be stored privately but remain quarantined until a real security scanner clears them.</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
        />
        <button
          type="button"
          disabled={props.disabled || sending || files.length >= MAX_FILES}
          onClick={() => inputRef.current?.click()}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-gold/15 bg-ivory/55 text-espresso/60 transition hover:bg-champagne/45 disabled:opacity-35"
          aria-label="Attach files"
          title="Attach files"
        >
          <Paperclip className="size-5" />
        </button>
        <textarea
          ref={textareaRef}
          value={props.draft}
          onChange={(event) => props.onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={props.disabled || sending}
          maxLength={4000}
          rows={1}
          placeholder={props.internalNote ? 'Write a staff-only note…' : 'Message…'}
          className={`min-h-12 max-h-32 flex-1 resize-none overflow-y-auto rounded-2xl border px-4 py-3 text-sm outline-none transition ${props.internalNote ? 'border-gold/35 bg-gold/5 focus:border-gold' : 'border-gold/15 bg-ivory/45 focus:border-gold/45 focus:bg-white'}`}
        />
        {sending && files.length > 0 ? (
          <button type="button" onClick={cancelUpload} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-clay/25 bg-clay/10 text-clay-light" aria-label="Cancel attachment upload">
            <X className="size-5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={props.disabled || sending || (!props.draft.trim() && files.length === 0)}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-espresso text-champagne transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={failed ? 'Retry send' : 'Send message'}
          >
            {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        )}
      </div>

      {sending && files.length > 0 ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-champagne/45" role="progressbar" aria-label="Attachment upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full bg-gold transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <div className="flex min-h-4 items-center justify-between text-[10px] text-espresso/35">
        <span className="hidden lg:inline">Enter to send · Shift+Enter for a new line · drag files into the composer</span>
        {props.draft.length >= 3600 ? <span className="ml-auto">{props.draft.length}/4000</span> : null}
      </div>
    </form>
  )
}
