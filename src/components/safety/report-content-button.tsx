'use client'

import { useState } from 'react'
import { Flag, Loader2, X } from 'lucide-react'

type ReportSubject = 'COMMUNICATION_MESSAGE' | 'COMMUNICATION_USER' | 'AI_OUTPUT'

const REASONS = [
  ['HARASSMENT', 'Harassment or bullying'],
  ['HATE', 'Hateful content'],
  ['SEXUAL', 'Sexual content'],
  ['VIOLENCE', 'Violence or threats'],
  ['SPAM', 'Spam'],
  ['SCAM', 'Scam or fraud'],
  ['PRIVACY', 'Privacy concern'],
  ['DANGEROUS', 'Dangerous content'],
  ['INACCURATE_AI', 'Unsafe or inaccurate AI answer'],
  ['OTHER', 'Something else'],
] as const

export function ReportContentButton({
  subjectType,
  conversationId,
  messageId,
  targetUserId,
  sourceArea,
  sourceId,
  contentSnapshot,
  label = 'Report',
  className = '',
}: {
  subjectType: ReportSubject
  conversationId?: string
  messageId?: string
  targetUserId?: string
  sourceArea?: 'WEDDING_AI' | 'NOTEBOOK_AI' | 'MARKETPLACE_AI' | 'PROVIDER_AI'
  sourceId?: string
  contentSnapshot?: string
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(subjectType === 'AI_OUTPUT' ? 'INACCURATE_AI' : 'OTHER')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function submit() {
    setSubmitting(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/safety/reports', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectType,
          conversationId,
          messageId,
          targetUserId,
          sourceArea,
          sourceId,
          contentSnapshot: contentSnapshot?.slice(0, 8000),
          reason,
          details,
        }),
      })
      const payload = await response.json().catch(() => ({})) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to submit this report.')
      }
      setFeedback('Report submitted. Wewed will review it.')
      setDetails('')
      window.setTimeout(() => setOpen(false), 1200)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to submit this report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setFeedback(null); setOpen(true) }}
        className={`inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${className}`}
      >
        <Flag className="size-3" /> {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Report content">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => !submitting && setOpen(false)} aria-label="Close report" />
          <section className="relative z-10 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 text-left text-stone-900 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-base font-bold">Report to Wewed</h2><p className="mt-1 text-xs leading-5 text-stone-500">Your report is confidential and will be reviewed by Wewed.</p></div>
              <button type="button" disabled={submitting} onClick={() => setOpen(false)} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-stone-100" aria-label="Close"><X className="size-4" /></button>
            </div>
            <label className="mt-4 block text-xs font-semibold">Reason
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm">
                {REASONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold">More details (optional)
              <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-stone-300 px-3 py-2 text-sm" placeholder="Tell us what happened." />
            </label>
            {feedback ? <p className="mt-3 text-xs leading-5" role="status">{feedback}</p> : null}
            <button type="button" onClick={() => void submit()} disabled={submitting} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-50">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />} Submit report
            </button>
          </section>
        </div>
      ) : null}
    </>
  )
}
