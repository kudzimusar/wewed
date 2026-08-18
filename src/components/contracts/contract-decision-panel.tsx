'use client'

import { useMemo, useState } from 'react'

export function ContractDecisionPanel(props: {
  token: string
  viewerName: string
  emailRequired: boolean
  canDecide: boolean
  currentDecision: string | null
  decisionAt: string | null
  declaration: string
}) {
  const [identityName, setIdentityName] = useState(props.viewerName)
  const [identityEmail, setIdentityEmail] = useState('')
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'ACCEPTED' | 'REJECTED' | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const decidedLabel = useMemo(() => {
    if (!props.currentDecision) return null
    return `${props.currentDecision.replaceAll('_', ' ').toLowerCase()}${props.decisionAt ? ` on ${new Date(props.decisionAt).toLocaleString()}` : ''}`
  }, [props.currentDecision, props.decisionAt])

  async function decide(decision: 'ACCEPTED' | 'REJECTED') {
    setError('')
    setResult(null)
    if (!identityName.trim()) {
      setError('Confirm the party name shown on this review link.')
      return
    }
    if (props.emailRequired && !identityEmail.trim()) {
      setError('Confirm the email address for this governed party.')
      return
    }
    if (decision === 'ACCEPTED' && !declarationAccepted) {
      setError('Tick the explicit acceptance declaration before accepting.')
      return
    }
    setBusy(decision)
    try {
      const response = await fetch(`/api/contracts/review/${encodeURIComponent(props.token)}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, identityName, identityEmail, declarationAccepted, reason }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body?.success !== true) throw new Error(body?.error || 'Wewed could not record the contract decision.')
      if (body.data?.effective) setResult('All required parties have accepted this exact version. The contract is now effective and an Acceptance Certificate has been stored in the Wewed Vault.')
      else if (decision === 'ACCEPTED') setResult('Your acceptance receipt has been recorded for this exact version. The contract is not effective until every remaining required party accepts.')
      else setResult('Your rejection has been recorded. This version cannot be edited into different terms; a new governed version is required for any changes.')
      window.setTimeout(() => window.location.reload(), 900)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wewed could not record the contract decision.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-2xl border border-[#a8874e]/25 bg-[#2d211b] p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a96e]">Explicit party decision</p>
      {decidedLabel ? (
        <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-100/10 p-4 text-sm">
          This review party already recorded a final decision: <strong>{decidedLabel}</strong>. The receipt is immutable.
        </div>
      ) : null}
      {!props.canDecide && !props.currentDecision ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4 text-sm text-[#f3ead8]/70">This version is not currently accepting a party decision.</div>
      ) : null}
      {props.canDecide ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">Party name
              <input value={identityName} onChange={(event) => setIdentityName(event.target.value)} autoComplete="name" className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-[#f3ead8] outline-none focus:border-[#c5a96e]" />
            </label>
            <label className="text-sm">Email {props.emailRequired ? '(required)' : '(if recorded)'}
              <input value={identityEmail} onChange={(event) => setIdentityEmail(event.target.value)} type="email" autoComplete="email" className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-[#f3ead8] outline-none focus:border-[#c5a96e]" />
            </label>
          </div>
          <label className="flex gap-3 rounded-xl border border-[#a8874e]/20 bg-[#fff7e6]/5 p-4 text-sm leading-6">
            <input type="checkbox" checked={declarationAccepted} onChange={(event) => setDeclarationAccepted(event.target.checked)} className="mt-1 size-4 shrink-0" />
            <span>{props.declaration}</span>
          </label>
          <label className="block text-sm">Optional rejection reason / decision note
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={2000} className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-[#f3ead8] outline-none focus:border-[#c5a96e]" />
          </label>
          {error ? <p role="alert" className="rounded-xl border border-red-300/20 bg-red-100/10 p-3 text-sm text-red-100">{error}</p> : null}
          {result ? <p className="rounded-xl border border-emerald-300/20 bg-emerald-100/10 p-3 text-sm text-emerald-100">{result}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={Boolean(busy)} onClick={() => decide('ACCEPTED')} className="rounded-full bg-[#c5a96e] px-5 py-2.5 text-sm font-semibold text-[#211914] disabled:opacity-50">{busy === 'ACCEPTED' ? 'Recording…' : 'Accept this exact version'}</button>
            <button type="button" disabled={Boolean(busy)} onClick={() => decide('REJECTED')} className="rounded-full border border-red-200/30 px-5 py-2.5 text-sm font-semibold text-red-100 disabled:opacity-50">{busy === 'REJECTED' ? 'Recording…' : 'Reject this version'}</button>
          </div>
          <p className="text-xs leading-5 text-[#f3ead8]/45">Wewed records the exact version digests, party role, declaration version, server timestamp and privacy-preserving identity evidence. Admin cannot submit this decision on your behalf.</p>
        </div>
      ) : null}
    </section>
  )
}
