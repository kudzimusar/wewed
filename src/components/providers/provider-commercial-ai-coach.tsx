'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, Sparkles } from 'lucide-react'

type PriceComponentSummary = {
  label: string
  type: string
  amount: string
  unit: string
  condition: string
}

export function ProviderCommercialAiCoach({
  category,
  description,
  details,
  priceComponents,
  readinessMissing,
}: {
  category: string
  description: string
  details: Record<string, unknown>
  priceComponents: PriceComponentSummary[]
  readinessMissing: string[]
}) {
  const [busy, setBusy] = useState(false)
  const [guidance, setGuidance] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function askAi() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/providers/commercial-guidance', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description,
          details,
          priceComponents,
          readinessMissing,
        }),
      })
      const result = await response.json() as {
        success?: boolean
        guidance?: string
        error?: string
      }
      if (!response.ok || !result.success || !result.guidance) {
        throw new Error(result.error || 'AI catalogue guidance is unavailable.')
      }
      setGuidance(result.guidance)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI catalogue guidance is unavailable.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-gold/20 bg-espresso/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-gold-muted">
            <Sparkles className="size-3.5" /> Wewed AI catalogue coach
          </p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-espresso/55">
            AI reviews only the catalogue information you entered and explains what Wewed still needs to calculate this service. It cannot invent or save prices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void askAi()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold text-gold-muted disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {busy ? 'Reviewing…' : 'Ask AI what is missing'}
        </button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-clay/25 bg-clay/5 px-3 py-2 text-xs leading-5 text-clay">{error}</p>}
      {guidance && (
        <div className="mt-3 rounded-xl border border-gold/15 bg-white p-3 text-xs leading-5 text-espresso/70">
          <p className="mb-2 font-semibold text-espresso">Draft guidance — review before changing your catalogue</p>
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="not-first:mt-2">{children}</p>,
              ul: ({ children }) => <ul className="ml-4 mt-2 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="ml-4 mt-2 list-decimal space-y-1">{children}</ol>,
              strong: ({ children }) => <strong className="font-semibold text-espresso">{children}</strong>,
            }}
          >
            {guidance}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
