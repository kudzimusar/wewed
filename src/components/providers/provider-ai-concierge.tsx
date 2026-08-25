'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Loader2, Sparkles, X } from 'lucide-react'

type ConciergeResult = {
  traceId: string
  summary: string
  facts: Array<{ label: string; value: string; source?: string }>
  recommendations: Array<{ title: string; rationale?: string; confidence?: string; action?: string }>
  missingInformation: Array<{ id?: string; question: string; reason?: string; required?: boolean }>
  proposedActions: Array<{ type: string; label: string; payload?: Record<string, unknown>; requiresConfirmation: true }>
  warnings: string[]
  provenance: { modelReleaseId: string; promptReleaseId: string; skillVersion: string; generatedAt: string }
}

type Outcome = 'understand_service' | 'compare_options' | 'structure_need' | 'prepare_enquiry'

const STARTERS: Array<{ label: string; outcome: Outcome; prompt: string }> = [
  { label: 'Help me choose', outcome: 'structure_need', prompt: 'Help me work out which of these services best fits what I need.' },
  { label: 'Compare services', outcome: 'compare_options', prompt: 'Compare the published services and explain the important trade-offs.' },
  { label: 'What am I missing?', outcome: 'structure_need', prompt: 'I am considering this vendor. What information should I decide before I enquire or book?' },
  { label: 'Prepare an enquiry', outcome: 'prepare_enquiry', prompt: 'Help me prepare a concise enquiry. Ask only for information that is genuinely missing.' },
]

function openExistingEnquiry() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
  const target = buttons.find((button) => button.textContent?.trim().toLowerCase() === 'ask a question')
    ?? buttons.find((button) => button.textContent?.trim().toLowerCase() === 'enquire')
    ?? buttons.find((button) => button.textContent?.trim().toLowerCase() === 'ask')
  if (target) {
    target.click()
    return true
  }
  document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return false
}

export function ProviderAiConcierge({
  providerSlug,
  providerName,
  enquiryEnabled,
}: {
  providerSlug: string
  providerName: string
  enquiryEnabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [outcome, setOutcome] = useState<Outcome>('structure_need')
  const [result, setResult] = useState<ConciergeResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const starters = enquiryEnabled ? STARTERS : STARTERS.filter((starter) => starter.outcome !== 'prepare_enquiry')

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  async function ask(nextOutcome = outcome, nextInput = input) {
    const question = nextInput.trim()
    if (!question) return
    if (nextOutcome === 'prepare_enquiry' && !enquiryEnabled) {
      setError('This provider is not currently accepting enquiries. Ask Wewed to compare or explain the published services instead.')
      return
    }
    setBusy(true); setError(''); setResult(null); setOutcome(nextOutcome)
    try {
      const response = await fetch('/api/ai/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerSlug, input: question, outcome: nextOutcome }),
      })
      const payload = await response.json() as { success?: boolean; result?: ConciergeResult; error?: string }
      if (!response.ok || !payload.success || !payload.result) throw new Error(payload.error || 'Wewed AI could not prepare guidance.')
      setResult(payload.result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Wewed AI could not prepare guidance.')
    } finally { setBusy(false) }
  }

  function useStarter(starter: (typeof STARTERS)[number]) {
    setInput(starter.prompt)
    setOutcome(starter.outcome)
    void ask(starter.outcome, starter.prompt)
  }

  function continueToEnquiry() {
    if (!enquiryEnabled) {
      setError('This provider is not currently accepting enquiries.')
      return
    }
    if (!openExistingEnquiry()) {
      setError('The enquiry panel could not be opened automatically. Use the Ask or Enquire action on the provider page.')
      return
    }
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#d7b36c]/45 bg-[#d7b36c]/10 px-5 text-sm font-semibold text-[#f7e7c7] hover:bg-[#d7b36c]/18"
      >
        <Sparkles className="size-4" /> Ask Wewed
      </button>

      {open ? <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 sm:items-center" role="dialog" aria-modal="true" aria-label={`Ask Wewed about ${providerName}`}>
        <button type="button" className="absolute inset-0 cursor-default" aria-label="Close Ask Wewed" onClick={() => setOpen(false)} />
        <section className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-[#e4d7c6] bg-[#fbf7f1] shadow-2xl sm:max-w-2xl sm:rounded-3xl">
          <header className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e7dccf] bg-[#fbf7f1]/96 px-5 py-4 backdrop-blur sm:px-6">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#9b7635]"><Sparkles className="size-3.5" /> Wewed AI · Marketplace Concierge</div>
              <h2 className="mt-1 font-serif text-3xl text-[#211a15]">Ask about {providerName}</h2>
              <p className="mt-1 text-xs leading-5 text-[#74685c]">Guidance uses published marketplace information. Price, availability and bookings still come from Wewed’s deterministic systems.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="ml-4 inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[#ded1c0] bg-white text-[#554a40]" aria-label="Close"><X className="size-4" /></button>
          </header>

          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap gap-2">
              {starters.map((starter) => <button key={starter.label} type="button" disabled={busy} onClick={() => useStarter(starter)} className="rounded-full border border-[#dbcdbb] bg-white px-3 py-2 text-xs font-semibold text-[#5f5347] hover:border-[#b99452] disabled:opacity-50">{starter.label}</button>)}
            </div>

            <div className="mt-4 rounded-2xl border border-[#dfd2c1] bg-white p-3 shadow-sm">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Example: We need around 100 chairs in Harare in December, probably including setup."
                rows={4}
                className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 text-[#211a15] outline-none placeholder:text-[#9a8c7c]"
                maxLength={4000}
              />
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#eee5d9] pt-3">
                <span className="text-[11px] text-[#8b7d6f]">Nothing is booked or sent by asking.</span>
                <button type="button" disabled={busy || !input.trim()} onClick={() => void ask()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#211a15] px-4 text-xs font-bold text-white disabled:opacity-45">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Ask Wewed
                </button>
              </div>
            </div>

            {!enquiryEnabled ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950/80">This provider is not currently accepting enquiries. You can still use Wewed AI to understand and compare the published services.</div> : null}
            {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}

            {result ? <div className="mt-5 space-y-4">
              <section className="rounded-2xl border border-[#dfd1bd] bg-[#fffdf9] p-5">
                <div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#9b7635]">Wewed’s read</div>
                <p className="mt-2 text-sm leading-7 text-[#3d342c]">{result.summary}</p>
              </section>

              {result.facts.length ? <section><h3 className="text-xs font-bold uppercase tracking-[.1em] text-[#786b5f]">Published facts used</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{result.facts.map((fact, index) => <div key={`${fact.label}-${index}`} className="rounded-xl border border-[#e4d9ca] bg-white p-3"><div className="text-[10px] font-bold uppercase tracking-[.08em] text-[#9b8b7c]">{fact.label}</div><div className="mt-1 text-sm text-[#352d27]">{fact.value}</div></div>)}</div></section> : null}

              {result.recommendations.length ? <section><h3 className="text-xs font-bold uppercase tracking-[.1em] text-[#786b5f]">Suggestions</h3><div className="mt-2 space-y-2">{result.recommendations.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-xl border border-[#e4d9ca] bg-white p-4"><div className="font-semibold text-[#2d261f]">{item.title}</div>{item.rationale ? <p className="mt-1 text-sm leading-6 text-[#74685c]">{item.rationale}</p> : null}</div>)}</div></section> : null}

              {result.missingInformation.length ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-xs font-bold uppercase tracking-[.1em] text-amber-800">Useful questions before you commit</h3><ul className="mt-2 space-y-2 text-sm leading-6 text-amber-950/80">{result.missingInformation.map((item, index) => <li key={`${item.question}-${index}`}>• {item.question}</li>)}</ul></section> : null}

              {result.warnings.length ? <div className="rounded-xl border border-[#e3d7c7] bg-[#f4eee5] px-4 py-3 text-xs leading-5 text-[#6c6055]">{result.warnings.join(' ')}</div> : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5dacd] pt-4">
                <span className="text-[10px] text-[#958779]">Wewed AI guidance · {result.provenance.modelReleaseId}</span>
                {enquiryEnabled ? <button type="button" onClick={continueToEnquiry} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#b58a3d] px-4 text-xs font-bold text-white hover:bg-[#9f7733]">Continue to enquiry <ArrowRight className="size-4" /></button> : null}
              </div>
            </div> : null}
          </div>
        </section>
      </div> : null}
    </>
  )
}
