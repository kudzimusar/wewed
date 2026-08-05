'use client'

import { useState } from 'react'
import { Clipboard, FilePlus2, Loader2, MailPlus, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

type FormMode = 'template' | 'draft'

async function parseResponse(response: Response) {
  const payload = (await response.json()) as { success?: boolean; error?: string }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Request failed with HTTP ${response.status}`)
  }
  return payload
}

export function AiWorkspaceSaveForms() {
  const [mode, setMode] = useState<FormMode>('template')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [audience, setAudience] = useState('')
  const [channel, setChannel] = useState('internal')
  const [subject, setSubject] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const paste = async () => {
    try {
      const value = await navigator.clipboard.readText()
      setContent(value)
      setError(null)
    } catch {
      setError('Clipboard access was denied. Paste the AI output into the text area manually.')
    }
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      if (mode === 'template') {
        await parseResponse(
          await fetch('/api/ai/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_version',
              name: title,
              description,
              content,
              anonymized: true,
              createdFrom: 'ai',
            }),
          }),
        )
        setMessage('AI template version saved. Structured JSON items, when present, are now eligible for controlled application review.')
      } else {
        await parseResponse(
          await fetch('/api/ai/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              title,
              audience,
              channel,
              subject: subject || null,
              body: content,
            }),
          }),
        )
        setMessage('Communication draft saved. It remains unsent until a separate review and delivery flow is completed.')
      }
      setTitle('')
      setDescription('')
      setContent('')
      setAudience('')
      setSubject('')
      window.setTimeout(() => window.location.reload(), 900)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save AI output.')
    } finally {
      setSaving(false)
    }
  }

  const canSave = title.trim().length > 0 && content.trim().length > 0

  return (
    <section className="mb-4 rounded-2xl border border-gold/20 bg-champagne/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="wewed-heading text-base text-champagne">Save an AI result</h2>
          <p className="mt-1 text-xs leading-relaxed text-champagne/50">
            Copy a generated template or communication from the assistant, then persist it for versioning and review.
          </p>
        </div>
        <div className="flex rounded-full border border-gold/20 bg-espresso/50 p-1">
          <button
            type="button"
            onClick={() => setMode('template')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
              mode === 'template' ? 'bg-gold text-espresso' : 'text-champagne/55',
            )}
          >
            <FilePlus2 className="size-3.5" /> Template
          </button>
          <button
            type="button"
            onClick={() => setMode('draft')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
              mode === 'draft' ? 'bg-gold text-espresso' : 'text-champagne/55',
            )}
          >
            <MailPlus className="size-3.5" /> Communication
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={mode === 'template' ? 'Template name' : 'Draft title'}
            className="w-full rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne outline-none placeholder:text-champagne/25 focus:border-gold"
          />
          {mode === 'template' ? (
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Template purpose and intended wedding type"
              className="w-full resize-y rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne outline-none placeholder:text-champagne/25 focus:border-gold"
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder="Audience or recipients"
                  className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne outline-none placeholder:text-champagne/25 focus:border-gold"
                />
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                  className="rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne outline-none focus:border-gold"
                >
                  <option value="internal">Internal</option>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="speech">Speech or vows</option>
                </select>
              </div>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subject (optional)"
                className="w-full rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne outline-none placeholder:text-champagne/25 focus:border-gold"
              />
            </>
          )}
        </div>

        <div>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => void paste()}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 px-2.5 py-1 text-[10px] text-gold hover:bg-gold/10"
            >
              <Clipboard className="size-3" /> Paste clipboard
            </button>
          </div>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={7}
            placeholder={
              mode === 'template'
                ? 'Paste the Template Intelligence output, including its JSON items block when applicable…'
                : 'Paste the Communication Assistant draft…'
            }
            className="w-full resize-y rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne outline-none placeholder:text-champagne/25 focus:border-gold"
          />
        </div>
      </div>

      {(message || error) && (
        <p className={cn('mt-3 text-xs', error ? 'text-red-200' : 'text-emerald-200')}>
          {error || message}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-espresso hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save {mode === 'template' ? 'version' : 'draft'}
        </button>
      </div>
    </section>
  )
}

export default AiWorkspaceSaveForms
