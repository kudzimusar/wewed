'use client'

import { useState } from 'react'
import { AlertTriangle, Calculator, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

type PlanSelection = {
  candidateId: string
  category: string
  priority: string
  providerName: string
  providerSlug: string
  offeringName: string
  packageName?: string | null
  fitScore: number
  warnings: string[]
  why: string[]
  pricing: {
    currency: string
    totalCostCents: number
    totalCashRequiredCents: number
    depositCents: number
    balanceCents: number
    balanceDueRule?: string | null
    lines: Array<{ code: string; label: string; quantity: number; amountCents: number; refundable: boolean }>
  }
}

type PlanResponse = {
  success?: boolean
  error?: string
  code?: string
  briefCompletionScore?: number
  plan?: {
    budgetCents: number
    contingencyCents: number
    spendableBudgetCents: number
    selectedCostCents: number
    remainingCents: number
    coverageComplete: boolean
    selections: PlanSelection[]
    uncoveredRequiredCategories: string[]
    omittedOptionalCategories: string[]
    strategy: string
  }
  diagnostics?: {
    scannedOfferings: number
    entitledOfferings: number
    calculationReadyVariants: number
  }
}

type RequirementsResponse = {
  success?: boolean
  profile?: { currency?: string } | null
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(cents / 100)
}

function title(value: string) {
  return value.replaceAll('-', ' ').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function WeddingArchitectPlan() {
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [result, setResult] = useState<PlanResponse | null>(null)
  const [currency, setCurrency] = useState('USD')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  async function generatePlan() {
    setLoading(true)
    setResult(null)
    setExplanation(null)
    setAiError(null)
    try {
      const [planResponse, requirementsResponse] = await Promise.all([
        fetch('/api/wedding-architect/plan', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/wedding-requirements', { cache: 'no-store', credentials: 'same-origin' }),
      ])
      const plan = await planResponse.json() as PlanResponse
      const requirements = await requirementsResponse.json() as RequirementsResponse
      if (requirements.success && requirements.profile?.currency) setCurrency(requirements.profile.currency)
      setResult(plan)
    } catch {
      setResult({ success: false, error: 'Wedding Architect is temporarily unavailable.' })
    } finally {
      setLoading(false)
    }
  }

  async function explainPlan() {
    setAiLoading(true)
    setAiError(null)
    try {
      const response = await fetch('/api/ai/wedding-architect', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const payload = await response.json() as { success?: boolean; explanation?: string; error?: string }
      if (!response.ok || !payload.success || !payload.explanation) throw new Error(payload.error || 'AI explanation is unavailable.')
      setExplanation(payload.explanation)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI explanation is unavailable.')
    } finally {
      setAiLoading(false)
    }
  }

  const plan = result?.plan
  return (
    <section className="rounded-3xl border border-gold/25 bg-champagne/[0.06] p-5 text-champagne sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Wedding Architect</p>
          <h2 className="mt-2 font-serif text-3xl">Build the wedding against the real marketplace</h2>
          <p className="mt-2 text-sm leading-6 text-champagne/65">Wewed reads the confirmed brief, checks paid provider eligibility and catalogue readiness, calculates exact client-specific prices, reserves contingency, then optimises the complete combination. No provider is contacted by this action.</p>
        </div>
        <button type="button" onClick={generatePlan} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-espresso disabled:opacity-60">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
          {loading ? 'Calculating…' : 'Build wedding plan'}
        </button>
      </div>

      {result && !result.success && (
        <div role="alert" className="mt-5 rounded-2xl border border-clay/35 bg-clay/10 p-4 text-sm text-champagne">
          <div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-clay" /><div><p className="font-semibold">Plan not generated</p><p className="mt-1 text-champagne/70">{result.error}</p></div></div>
        </div>
      )}

      {plan && (
        <div className="mt-6 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Wedding budget', money(plan.budgetCents, currency)],
              ['Contingency reserved', money(plan.contingencyCents, currency)],
              ['Selected services', money(plan.selectedCostCents, currency)],
              ['Still available', money(plan.remainingCents, currency)],
            ].map(([label, value]) => <div key={label} className="rounded-2xl border border-gold/15 bg-espresso/40 p-4"><p className="text-xs text-champagne/50">{label}</p><p className="mt-1 text-lg font-semibold text-gold">{value}</p></div>)}
          </div>

          <div className={`rounded-2xl border p-4 ${plan.coverageComplete ? 'border-sage/30 bg-sage/10' : 'border-gold/25 bg-gold/5'}`}>
            <div className="flex gap-2">
              {plan.coverageComplete ? <CheckCircle2 className="mt-0.5 size-5 text-sage" /> : <AlertTriangle className="mt-0.5 size-5 text-gold" />}
              <div>
                <p className="font-semibold">{plan.coverageComplete ? 'Required categories are covered' : 'The marketplace cannot yet cover every required category'}</p>
                {plan.uncoveredRequiredCategories.length > 0 && <p className="mt-1 text-sm text-champagne/65">Still uncovered: {plan.uncoveredRequiredCategories.map(title).join(', ')}.</p>}
                <p className="mt-1 text-xs text-champagne/50">This is a planning result, not a booking. Availability remains subject to provider confirmation.</p>
              </div>
            </div>
          </div>

          {plan.selections.length > 0 ? (
            <div className="space-y-3">
              {plan.selections.map((selection) => (
                <article key={selection.candidateId} className="rounded-2xl border border-gold/15 bg-champagne p-5 text-espresso">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-clay">{title(selection.category)} · {title(selection.priority)}</p><h3 className="mt-1 font-serif text-2xl">{selection.providerName}</h3><p className="text-sm text-espresso/60">{selection.offeringName}{selection.packageName ? ` · ${selection.packageName}` : ''}</p></div>
                    <div className="text-right"><p className="text-xl font-semibold">{money(selection.pricing.totalCostCents, selection.pricing.currency)}</p><p className="text-xs text-espresso/50">Fit {selection.fitScore}%</p></div>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3"><p>Deposit: <strong>{money(selection.pricing.depositCents, selection.pricing.currency)}</strong></p><p>Balance: <strong>{money(selection.pricing.balanceCents, selection.pricing.currency)}</strong></p><p>Cash incl. refundable security: <strong>{money(selection.pricing.totalCashRequiredCents, selection.pricing.currency)}</strong></p></div>
                  {selection.why.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-espresso/65">{selection.why.slice(0, 5).map((reason) => <li key={reason}>{reason}</li>)}</ul>}
                  {selection.warnings.length > 0 && <div className="mt-4 rounded-xl border border-clay/20 bg-clay/5 p-3 text-xs text-espresso/65">{selection.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div>}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-gold/20 bg-espresso/35 p-5">
              <p className="font-semibold">No automatic provider recommendation has been made.</p>
              <p className="mt-2 text-sm text-champagne/60">Wewed found {result.diagnostics?.scannedOfferings ?? 0} relevant marketplace offerings, but {result.diagnostics?.calculationReadyVariants ?? 0} currently pass the full paid-entitlement, governance, exact-price and client-fit path. The system has intentionally left the plan unfilled rather than estimate or promote an ineligible vendor.</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-gold/15 pt-5">
            <button type="button" onClick={explainPlan} disabled={aiLoading} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/35 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/10 disabled:opacity-60">
              {aiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {aiLoading ? 'AI is reviewing…' : 'Explain this plan with AI'}
            </button>
            <p className="text-xs text-champagne/45">AI explains the server-calculated plan; it cannot change prices, selections or eligibility.</p>
          </div>
          {aiError && <p role="alert" className="rounded-xl border border-clay/30 bg-clay/10 p-3 text-sm">{aiError}</p>}
          {explanation && <div className="prose prose-invert max-w-none rounded-2xl border border-gold/15 bg-espresso/45 p-5 text-sm"><ReactMarkdown>{explanation}</ReactMarkdown></div>}
        </div>
      )}
    </section>
  )
}
