'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { editorRequest, EditorRequestError } from '@/components/wedding/site-editor/api'
import {
  localDraftKey,
  parseStoredLocalDraft,
  resolveLocalDraft,
} from '@/lib/wedding-site/browser-draft'

type Stamped = { value: string; updatedAt: string } | null

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (private mode): unsaved text simply isn't remembered.
  }
}

/**
 * One piece of public site copy with the full lifecycle: Save draft (private), Publish (guests see
 * it on every device), Unpublish (kept as a draft), Cancel (back to the server version).
 */
export function CopyField({
  slug,
  section,
  field,
  label,
  hint,
  multiline = false,
  published,
  draft,
  onChanged,
  onStatus,
}: {
  slug: string
  section: string
  field: string
  label: string
  hint?: string
  multiline?: boolean
  published: Stamped
  draft: Stamped
  onChanged: () => Promise<void>
  onStatus: (message: string) => void
}) {
  const inputId = useId()
  const base = draft ?? published
  const baseValue = base?.value ?? ''
  const baseStamp = base?.updatedAt ?? null
  const storageKey = localDraftKey(slug, section, field)
  const [text, setText] = useState(baseValue)
  const [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState(false)
  const [conflictText, setConflictText] = useState<string | null>(null)
  const lastBase = useRef<string | null>(null)

  // Reset to the server version whenever the server version changes, then consider a local
  // unsaved draft — which is only restored if it was typed over this exact server version.
  useEffect(() => {
    const signature = `${baseStamp}|${baseValue}`
    if (lastBase.current === signature) return
    lastBase.current = signature
    const resolution = resolveLocalDraft(parseStoredLocalDraft(readStorage(storageKey)), baseValue, baseStamp)
    const id = window.setTimeout(() => {
      if (resolution.use === 'local') {
        setText(resolution.value)
        setRestored(true)
      } else {
        if (resolution.discardLocal) writeStorage(storageKey, null)
        setText(baseValue)
        setRestored(false)
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [baseStamp, baseValue, storageKey])

  const dirty = text !== baseValue
  const status = published
    ? draft
      ? 'Published · newer draft saved'
      : 'Published'
    : draft
      ? 'Draft · not visible to guests'
      : 'Not published'

  function change(next: string) {
    setText(next)
    writeStorage(
      storageKey,
      next === baseValue ? null : JSON.stringify({ value: next, baseUpdatedAt: baseStamp, savedAt: new Date().toISOString() }),
    )
  }

  async function run(action: 'draft' | 'publish' | 'unpublish') {
    setBusy(true)
    try {
      await editorRequest(slug, '/site/copy', {
        method: 'POST',
        body: {
          action,
          section,
          field,
          value: text,
          ...(action === 'publish' ? { expectedUpdatedAt: published?.updatedAt ?? null } : {}),
        },
      })
      writeStorage(storageKey, null)
      setRestored(false)
      onStatus(
        action === 'publish'
          ? `${label} published — guests now see it on every device.`
          : action === 'draft'
            ? `${label} saved as a draft. Guests don't see it yet.`
            : `${label} unpublished and kept as a draft.`,
      )
      await onChanged()
    } catch (error) {
      if (error instanceof EditorRequestError && error.conflict) {
        setConflictText(text)
        writeStorage(storageKey, null)
        onStatus(`${label} was changed on another device. The latest version is loaded; choose whether to reuse your text.`)
        await onChanged()
      } else {
        onStatus(error instanceof Error ? error.message : 'Something went wrong.')
      }
    } finally {
      setBusy(false)
    }
  }

  function cancel() {
    writeStorage(storageKey, null)
    setText(baseValue)
    setRestored(false)
  }

  const inputClass =
    'w-full rounded-xl border border-gold/30 bg-white px-3 py-2.5 font-sans text-sm text-espresso shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30'

  return (
    <div className="rounded-2xl border border-gold/20 bg-white/60 p-4" data-copy-field={`${section}.${field}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="font-sans text-sm font-medium text-espresso">
          {label}
        </label>
        <span className="font-sans text-[11px] uppercase tracking-[0.14em] text-espresso/55" data-testid="copy-status">
          {status}
        </span>
      </div>
      {hint ? <p className="mt-1 font-sans text-xs text-espresso/55">{hint}</p> : null}
      {multiline ? (
        <textarea id={inputId} rows={5} value={text} onChange={(event) => change(event.target.value)} className={`mt-2 ${inputClass}`} />
      ) : (
        <input id={inputId} value={text} onChange={(event) => change(event.target.value)} className={`mt-2 ${inputClass}`} />
      )}
      {conflictText !== null ? (
        <div className="mt-3 rounded-xl border border-plum/30 bg-plum/5 p-3" role="alert">
          <p className="font-sans text-xs font-medium text-plum">Your unsaved version (not published):</p>
          <p className="mt-1 whitespace-pre-line font-sans text-xs text-espresso/75">{conflictText || '(empty)'}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => { change(conflictText); setConflictText(null) }} className="min-h-11 rounded-full border border-plum/40 px-4 font-sans text-xs text-plum">
              Use my text
            </button>
            <button type="button" onClick={() => setConflictText(null)} className="min-h-11 rounded-full px-4 font-sans text-xs text-espresso/70">
              Keep latest
            </button>
          </div>
        </div>
      ) : null}
      {restored ? (
        <p className="mt-2 font-sans text-xs text-plum">Restored your unsaved changes from this browser.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !dirty} onClick={() => void run('draft')} className="min-h-11 rounded-full border border-gold/40 px-4 font-sans text-xs uppercase tracking-[0.14em] text-espresso disabled:opacity-40">
          Save draft
        </button>
        <button type="button" disabled={busy || (!dirty && !draft)} onClick={() => void run('publish')} className="min-h-11 rounded-full bg-espresso px-4 font-sans text-xs uppercase tracking-[0.14em] text-champagne disabled:opacity-40">
          Publish
        </button>
        <button type="button" disabled={busy || !dirty} onClick={cancel} className="min-h-11 rounded-full px-4 font-sans text-xs uppercase tracking-[0.14em] text-espresso/70 disabled:opacity-40">
          Cancel
        </button>
        {published ? (
          <button type="button" disabled={busy} onClick={() => void run('unpublish')} className="ml-auto min-h-11 rounded-full px-4 font-sans text-xs uppercase tracking-[0.14em] text-clay disabled:opacity-40">
            Unpublish
          </button>
        ) : null}
      </div>
    </div>
  )
}
