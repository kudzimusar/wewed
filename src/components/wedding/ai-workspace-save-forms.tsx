'use client'

import { useEffect, useState } from 'react'
import {
  Clipboard,
  FilePlus2,
  Loader2,
  MailPlus,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type FormMode = 'template' | 'draft'

type TemplateOption = {
  id: string
  value: {
    templateId: string
    version: number
    name: string
    description: string
  }
}

type SensitiveFinding = {
  kind: string
  label: string
  excerpt: string
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & {
    success?: boolean
    error?: string
    findings?: SensitiveFinding[]
  }
  if (!response.ok || payload.success === false) {
    const error = new Error(
      payload.error || `Request failed with HTTP ${response.status}`,
    ) as Error & { findings?: SensitiveFinding[] }
    error.findings = payload.findings
    throw error
  }
  return payload
}

export function AiWorkspaceSaveForms() {
  const [mode, setMode] = useState<FormMode>('template')
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [audience, setAudience] = useState('')
  const [channel, setChannel] = useState('internal')
  const [subject, setSubject] = useState('')
  const [anonymizationConfirmed, setAnonymizationConfirmed] = useState(false)
  const [findings, setFindings] = useState<SensitiveFinding[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadTemplates = async () => {
      try {
        const payload = await readResponse<{
          data: { latest: TemplateOption[] }
        }>(await fetch('/api/ai/templates', { cache: 'no-store' }))
        if (!cancelled) setTemplates(payload.data.latest)
      } catch {
        if (!cancelled) setTemplates([])
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [])

  const paste = async () => {
    try {
      const value = await navigator.clipboard.readText()
      setContent(value)
      setError(null)
      setFindings([])
    } catch {
      setError(
        'Clipboard access was denied. Paste the AI output into the text area manually.',
      )
    }
  }

  const chooseTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setAnonymizationConfirmed(false)
    setFindings([])
    if (!templateId) return
    const selected = templates.find(
      (template) => template.value.templateId === templateId,
    )
    if (!selected) return
    setTitle(selected.value.name)
    setDescription(selected.value.description)
  }

  const reset = () => {
    setSelectedTemplateId('')
    setTitle('')
    setDescription('')
    setContent('')
    setAudience('')
    setSubject('')
    setAnonymizationConfirmed(false)
    setFindings([])
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    setFindings([])
    try {
      if (mode === 'template') {
        const payload = await readResponse<{
          data: TemplateOption
        }>(
          await fetch('/api/ai/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_version',
              templateId: selectedTemplateId || undefined,
              name: title,
              description,
              content,
              anonymizationConfirmed,
              createdFrom: 'ai',
            }),
          }),
        )
        setMessage(
          `${payload.data.value.name} version ${payload.data.value.version} saved after anonymization review.`,
        )
      } else {
        await readResponse(
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
        setMessage(
          'Communication draft saved. It remains unsent until a separate review and delivery flow is completed.',
        )
      }
      reset()
      window.dispatchEvent(new Event('wewed:ai-records-refresh'))
    } catch (saveError) {
      const typed = saveError as Error & { findings?: SensitiveFinding[] }
      setFindings(typed.findings ?? [])
      setError(
        typed.message || 'Unable to save AI output.',
      )
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    (mode === 'draft' || anonymizationConfirmed)

  return (
    <section className="mb-4 rounded-2xl border border-gold/20 bg-champagne/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="wewed-heading text-base text-champagne">
            Save an AI result
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-champagne/50">
            Persist a reviewed template version or communication draft. Saving
            never applies records or sends a message.
          </p>
        </div>
        <div className="flex rounded-full border border-gold/20 bg-espresso/50 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('template')
              setError(null)
              setFindings([])
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
              mode === 'template'
                ? 'bg-gold text-espresso'
                : 'text-champagne/55',
            )}
          >
            <FilePlus2 className="size-3.5" /> Template
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('draft')
              setError(null)
              setFindings([])
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
              mode === 'draft'
                ? 'bg-gold text-espresso'
                : 'text-champagne/55',
            )}
          >
            <MailPlus className="size-3.5" /> Communication
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          {mode === 'template' && (
            <select
              value={selectedTemplateId}
              onChange={(event) => chooseTemplate(event.target.value)}
              className="w-full rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne outline-none focus:border-gold"
            >
              <option value="">Create a new template family</option>
              {templates.map((template) => (
                <option
                  key={template.value.templateId}
                  value={template.value.templateId}
                >
                  Save next version of {template.value.name} (current v
                  {template.value.version})
                </option>
              ))}
            </select>
          )}

          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setAnonymizationConfirmed(false)
            }}
            placeholder={mode === 'template' ? 'Template name' : 'Draft title'}
            className="w-full rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne outline-none placeholder:text-champagne/25 focus:border-gold"
          />
          {mode === 'template' ? (
            <>
              <textarea
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value)
                  setAnonymizationConfirmed(false)
                }}
                rows={3}
                placeholder="Template purpose and intended wedding type"
                className="w-full resize-y rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne outline-none placeholder:text-champagne/25 focus:border-gold"
              />
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gold/15 bg-espresso/35 p-3 text-xs text-champagne/70">
                <input
                  type="checkbox"
                  checked={anonymizationConfirmed}
                  onChange={(event) =>
                    setAnonymizationConfirmed(event.target.checked)
                  }
                  className="mt-0.5"
                />
                <span>
                  I reviewed this content for couple and guest names, contact
                  data, private notes, vendor identity and pricing, contracts,
                  messages, media references, and culturally sensitive details.
                  The server will run an additional deterministic scan.
                </span>
              </label>
            </>
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
            onChange={(event) => {
              setContent(event.target.value)
              setAnonymizationConfirmed(false)
              setFindings([])
            }}
            rows={9}
            placeholder={
              mode === 'template'
                ? 'Paste the Template Intelligence output, including its JSON items block when applicable…'
                : 'Paste the Communication Assistant draft…'
            }
            className="w-full resize-y rounded-lg border border-gold/20 bg-espresso/60 px-3 py-2 text-sm text-champagne outline-none placeholder:text-champagne/25 focus:border-gold"
          />
        </div>
      </div>

      {findings.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3">
          <p className="text-xs font-semibold text-red-100">
            Remove these findings before saving:
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-red-100/85">
            {findings.map((finding, index) => (
              <li key={`${finding.kind}-${finding.excerpt}-${index}`}>
                <strong>{finding.label}:</strong> {finding.excerpt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(message || error) && (
        <p
          className={cn(
            'mt-3 text-xs',
            error ? 'text-red-200' : 'text-emerald-200',
          )}
        >
          {error || message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {mode === 'template' ? (
          <p className="inline-flex items-center gap-1.5 text-[10px] text-champagne/40">
            <ShieldCheck className="size-3.5 text-gold" />
            {selectedTemplateId
              ? 'This creates the next version in the selected template family.'
              : 'This creates version 1 of a new template family.'}
          </p>
        ) : (
          <p className="text-[10px] text-champagne/40">
            Saving creates a draft only. It does not approve or send it.
          </p>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-espresso hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save {mode === 'template' ? 'reviewed version' : 'draft'}
        </button>
      </div>
    </section>
  )
}

export default AiWorkspaceSaveForms
