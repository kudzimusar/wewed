'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, Sparkles } from 'lucide-react'

export function WeddingBriefAiCoach() {
  const [busy, setBusy] = useState(false)
  const [guidance, setGuidance] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reviewBrief() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/wedding-requirements/guidance', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const result = await response.json() as {
        success?: boolean
        guidance?: string
        error?: string
      }
      if (!response.ok || !result.success || !result.guidance) {
        throw new Error(result.error || 'AI wedding-brief guidance is unavailable.')
      }
      setGuidance(result.guidance)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI wedding-brief guidance is unavailable.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-5 rounded-3xl border border-gold/20 bg-champagne/[0.055] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            <Sparkles className="size-4" /> Wewed AI brief coach
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-champagne/60">
            Save the shared brief, then AI can identify the most important missing answers for later marketplace calculation and optimisation. It cannot save changes, invent prices, or recommend vendors at this stage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reviewBrief()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-4 py-2.5 text-xs font-semibold text-gold disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? 'Reviewing brief…' : 'Ask AI what is missing'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </p>
      )}

      {guidance && (
        <div className="mt-4 rounded-2xl border border-gold/15 bg-espresso/70 p-4 text-sm leading-6 text-champagne/75">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gold">Draft guidance</p>
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="not-first:mt-2">{children}</p>,
              ul: ({ children }) => <ul className="ml-4 mt-2 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="ml-4 mt-2 list-decimal space-y-1">{children}</ol>,
              strong: ({ children }) => <strong className="font-semibold text-champagne">{children}</strong>,
            }}
          >
            {guidance}
          </ReactMarkdown>
        </div>
      )}
    </section>
  )
}
