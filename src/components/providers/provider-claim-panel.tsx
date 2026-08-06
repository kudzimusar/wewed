'use client'

import { useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'

const inputClass = 'mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-white px-3 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20'
const textareaClass = 'mt-1.5 min-h-24 w-full rounded-xl border border-gold/25 bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20'

export function ProviderClaimPanel({
  slug,
  businessName,
  listingStatus,
  sourceSummary,
  lastSourceCheckAt,
}: {
  slug: string
  businessName: string
  listingStatus: string
  sourceSummary: string | null
  lastSourceCheckAt: string | null
}) {
  const [claimBusy, setClaimBusy] = useState(false)
  const [claimNotice, setClaimNotice] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportNotice, setReportNotice] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  async function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setClaimBusy(true)
    setClaimNotice(null)
    setClaimError(null)

    try {
      const response = await fetch(`/api/providers/${encodeURIComponent(slug)}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimantName: form.get('claimantName'),
          claimantEmail: form.get('claimantEmail'),
          claimantPhone: form.get('claimantPhone'),
          relationship: form.get('relationship'),
          verificationMethod: form.get('verificationMethod'),
          evidenceUrl: form.get('evidenceUrl'),
          message: form.get('message'),
          declarationAccepted: form.get('declarationAccepted') === 'on',
        }),
      })
      const payload = await response.json() as { success?: boolean; message?: string; error?: string; reference?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to submit claim.')
      setClaimNotice(`${payload.message || 'Claim submitted.'}${payload.reference ? ` Reference: ${payload.reference}` : ''}`)
      event.currentTarget.reset()
    } catch (caught) {
      setClaimError(caught instanceof Error ? caught.message : 'Unable to submit claim.')
    } finally {
      setClaimBusy(false)
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setReportBusy(true)
    setReportNotice(null)
    setReportError(null)

    try {
      const response = await fetch(`/api/providers/${encodeURIComponent(slug)}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: form.get('requestType'),
          reporterName: form.get('reporterName'),
          reporterEmail: form.get('reporterEmail'),
          fieldKey: form.get('fieldKey'),
          suggestedValue: form.get('suggestedValue'),
          reason: form.get('reason'),
          evidenceUrl: form.get('evidenceUrl'),
        }),
      })
      const payload = await response.json() as { success?: boolean; message?: string; error?: string; reference?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to submit report.')
      setReportNotice(`${payload.message || 'Report submitted.'}${payload.reference ? ` Reference: ${payload.reference}` : ''}`)
      event.currentTarget.reset()
    } catch (caught) {
      setReportError(caught instanceof Error ? caught.message : 'Unable to submit report.')
    } finally {
      setReportBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-gold/25 bg-champagne/70 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-6 shrink-0 text-gold-muted" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-muted">Provisional business listing</p>
            <h2 className="mt-2 font-serif text-3xl">Is this your business?</h2>
            <p className="mt-3 text-sm leading-6 text-espresso/65">
              Wewed created this listing from public business information. It has not yet been verified by the owner and does not currently accept Wewed enquiries.
            </p>
            {sourceSummary && <p className="mt-3 text-xs leading-5 text-espresso/50">Source summary: {sourceSummary}</p>}
            {lastSourceCheckAt && <p className="mt-1 text-xs text-espresso/45">Public information last checked {new Date(lastSourceCheckAt).toLocaleDateString()}.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-espresso p-6 text-champagne">
        <ShieldCheck className="size-6 text-gold" />
        <h2 className="mt-4 font-serif text-3xl">Claim {businessName}</h2>
        <p className="mt-3 text-sm leading-6 text-champagne/65">
          Wewed verifies every claim before granting profile authority. Approval lets the owner correct the listing, add authorised media, publish packages and enable enquiries.
        </p>

        {listingStatus === 'claim_pending' && (
          <div className="mt-5 rounded-xl border border-gold/25 bg-gold/10 p-4 text-sm text-champagne/75">
            A claim is already under review. Another authorised representative may still submit evidence, but no ownership access is granted until Wewed approves a claimant.
          </div>
        )}

        <form onSubmit={submitClaim} className="mt-5 space-y-4">
          <label className="block text-xs text-champagne/65">Your name<input name="claimantName" required maxLength={160} className={inputClass} /></label>
          <label className="block text-xs text-champagne/65">Business email<input name="claimantEmail" type="email" required maxLength={180} className={inputClass} /></label>
          <label className="block text-xs text-champagne/65">Business phone<input name="claimantPhone" maxLength={80} className={inputClass} /></label>
          <label className="block text-xs text-champagne/65">Relationship to the business<select name="relationship" required className={inputClass}><option value="">Select…</option><option value="Owner">Owner</option><option value="Director">Director</option><option value="Manager">Manager</option><option value="Authorised employee">Authorised employee</option><option value="Agency or authorised representative">Agency or authorised representative</option></select></label>
          <label className="block text-xs text-champagne/65">Preferred verification method<select name="verificationMethod" required className={inputClass}><option value="">Select…</option><option value="domain_email">Email on the business domain</option><option value="business_phone">Code to the published business phone</option><option value="social_account">Control of an official social account</option><option value="registration_document">Business registration document</option><option value="manual_review">Manual Wewed review</option></select></label>
          <label className="block text-xs text-champagne/65">Evidence link, when available<input name="evidenceUrl" type="url" placeholder="https://" className={inputClass} /></label>
          <label className="block text-xs text-champagne/65">Additional context<textarea name="message" maxLength={2000} className={textareaClass} /></label>
          <label className="flex items-start gap-3 text-xs leading-5 text-champagne/65"><input name="declarationAccepted" type="checkbox" required className="mt-1 accent-[#BF9B5F]" />I confirm that I am authorised to represent this business and that the evidence I submit is accurate.</label>
          {(claimError || claimNotice) && <p role={claimError ? 'alert' : 'status'} className={`rounded-xl border p-3 text-xs ${claimError ? 'border-clay/40 bg-clay/10' : 'border-sage/40 bg-sage/10'}`}>{claimError || claimNotice}</p>}
          <button type="submit" disabled={claimBusy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-espresso disabled:opacity-60">{claimBusy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Submit ownership claim</button>
        </form>
      </section>

      <details className="rounded-3xl border border-gold/20 bg-white p-6">
        <summary className="cursor-pointer font-semibold text-gold-muted">Report incorrect information or request removal</summary>
        <form onSubmit={submitReport} className="mt-5 space-y-4">
          <label className="block text-xs text-espresso/60">Request type<select name="requestType" required className={inputClass}><option value="correction">Correct information</option><option value="duplicate">Duplicate listing</option><option value="privacy">Privacy concern</option><option value="removal">Request removal</option><option value="closed_business">Business has closed</option><option value="other">Other</option></select></label>
          <label className="block text-xs text-espresso/60">Your name<input name="reporterName" maxLength={160} className={inputClass} /></label>
          <label className="block text-xs text-espresso/60">Email for follow-up<input name="reporterEmail" type="email" maxLength={180} className={inputClass} /></label>
          <label className="block text-xs text-espresso/60">Field to correct<input name="fieldKey" placeholder="Phone, city, website…" maxLength={120} className={inputClass} /></label>
          <label className="block text-xs text-espresso/60">Suggested value<input name="suggestedValue" maxLength={1000} className={inputClass} /></label>
          <label className="block text-xs text-espresso/60">Reason<textarea name="reason" required maxLength={2500} className={textareaClass} /></label>
          <label className="block text-xs text-espresso/60">Supporting link<input name="evidenceUrl" type="url" placeholder="https://" className={inputClass} /></label>
          {(reportError || reportNotice) && <p role={reportError ? 'alert' : 'status'} className={`rounded-xl border p-3 text-xs ${reportError ? 'border-clay/35 bg-clay/10' : 'border-sage/35 bg-sage/10'}`}>{reportError || reportNotice}</p>}
          <button type="submit" disabled={reportBusy} className="flex items-center justify-center gap-2 rounded-xl border border-gold/30 px-4 py-3 text-sm font-semibold text-gold-muted disabled:opacity-60">{reportBusy && <Loader2 className="size-4 animate-spin" />}Submit report</button>
        </form>
      </details>
    </div>
  )
}
