'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, Loader2, NotebookPen, Plus, X } from 'lucide-react'
import { NOTEBOOK_QUICK_CAPTURE_OPEN_EVENT } from '@/lib/notebook-events'

type Surface = 'planner' | 'admin'

type ContextPayload = {
  activeWeddingId: string
  weddings: Array<{ id: string; title: string; canEdit: boolean }>
}

interface NotebookQuickCaptureProps {
  surface: Surface
  showTrigger?: boolean
}

export function NotebookQuickCapture({ surface, showTrigger = true }: NotebookQuickCaptureProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState<ContextPayload | null>(null)
  const [title, setTitle] = useState('Quick note')
  const [content, setContent] = useState('')
  const [weddingId, setWeddingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (pathname.includes('/notebook')) return
    const handleOpen = () => setOpen(true)
    window.addEventListener(NOTEBOOK_QUICK_CAPTURE_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(NOTEBOOK_QUICK_CAPTURE_OPEN_EVENT, handleOpen)
  }, [pathname])

  useEffect(() => {
    if (!open || context) return
    fetch('/api/notebook/context')
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok || payload.success === false) throw new Error(payload.error || 'Notebook context unavailable.')
        return payload.data as ContextPayload
      })
      .then((data) => {
        setContext(data)
        const active = data.weddings.find((wedding) => wedding.id === data.activeWeddingId && wedding.canEdit)
        setWeddingId(active?.id ?? '')
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Notebook context unavailable.'))
  }, [open, context])

  if (pathname.includes('/notebook')) return null

  const save = async () => {
    if (!content.trim()) {
      setError('Write a note before saving.')
      return
    }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const response = await fetch('/api/notebook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Quick note',
          contentText: content,
          weddingId: weddingId || null,
          noteType: 'QUICK',
          visibility: 'PRIVATE',
          contextType: surface === 'admin' ? 'admin-quick-capture' : weddingId ? 'wedding-quick-capture' : 'planner-quick-capture',
        }),
      })
      const payload = await response.json()
      if (!response.ok || payload.success === false) throw new Error(payload.error || 'Could not save Quick Note.')
      setSaved(true)
      setContent('')
      setTitle('Quick note')
      window.setTimeout(() => {
        setOpen(false)
        setSaved(false)
      }, 650)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save Quick Note.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {showTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-[58] flex min-h-12 items-center gap-2 rounded-full border border-gold/30 bg-espresso px-4 py-3 text-sm font-semibold text-gold shadow-2xl hover:bg-gold/10 md:bottom-6 md:right-6"
          aria-label="Create Quick Note"
        >
          <NotebookPen className="size-4" />
          <span className="hidden sm:inline">Quick Note</span>
          <Plus className="size-3.5 sm:hidden" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center" role="presentation">
          <button className="absolute inset-0 cursor-default" aria-label="Close Quick Note" onClick={() => setOpen(false)} />
          <section role="dialog" aria-modal="true" aria-label="Quick Note" className="relative z-10 w-full max-w-xl rounded-2xl border border-gold/25 bg-espresso p-4 text-champagne shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gold">Notebook</p>
                <h2 className="mt-1 text-lg font-semibold">Quick Note</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gold/15" aria-label="Close"><X className="size-4" /></button>
            </div>

            <div className="mt-4 space-y-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} className="w-full rounded-xl border border-gold/15 bg-black/20 px-3 py-2.5 outline-none focus:border-gold/50" placeholder="Title" />
              <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={7} autoFocus className="w-full resize-y rounded-xl border border-gold/15 bg-black/20 px-3 py-2.5 leading-6 outline-none focus:border-gold/50" placeholder="Capture the thought, decision, promise or follow-up…" />
              {surface === 'planner' && context?.weddings.length ? (
                <label className="block text-xs text-champagne/70">
                  Context
                  <select value={weddingId} onChange={(event) => setWeddingId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gold/15 bg-stone-900 px-3 py-2.5 text-sm text-champagne">
                    <option value="">Personal / portfolio</option>
                    {context.weddings.filter((wedding) => wedding.canEdit).map((wedding) => <option key={wedding.id} value={wedding.id}>{wedding.title}</option>)}
                  </select>
                </label>
              ) : null}
              <p className="text-xs text-champagne/55">Quick Notes are private by default. You can change visibility, link records, use AI, or share later in Notebook.</p>
              {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-2.5 text-xs text-red-100">{error}</p>}
              <button type="button" disabled={saving || saved} onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-espresso disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : <NotebookPen className="size-4" />}
                {saving ? 'Saving…' : saved ? 'Saved' : 'Save Quick Note'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
