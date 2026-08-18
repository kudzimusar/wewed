'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Governance = {
  contract: { id: string; contractNumber: string; status: string; currentVersionNumber: number }
  versions: Array<{ id: string; versionNumber: number; status: string; issuedAt: string | null; contentSha256: string | null; artifactSha256: string | null }>
  parties: Array<{ id: string; role: string; displayName: string; requiredForReview: boolean }>
  requirements: Array<{ id: string; contractVersionId: string; engagementPartyId: string; requiredRole: string; status: string; acceptedAt: string | null; rejectedAt: string | null }>
  acceptances: Array<{ id: string; contractVersionId: string; engagementPartyId: string; decision: string; representedRole: string; identityKind: string; declarationVersion: string; contractContentSha256: string; contractArtifactSha256: string; sourceChannel: string; decisionAt: string; reason: string | null }>
  amendments: Array<{ id: string; baseVersionId: string; proposedVersionId: string; reason: string; diffSummary: unknown; status: string; proposedAt: string | null; effectiveAt: string | null; rejectedAt: string | null }>
  effectivity: Array<{ contractVersionId: string; effectiveAt: string; acceptanceCertificateVaultObjectId: string; acceptanceCertificateSha256: string }>
  events: Array<{ id: string; versionId: string | null; eventType: string; createdAt: string }>
}

type ReviewLink = { partyId: string; role: string; reviewUrl: string; expiresAt: string }

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.success !== true) throw new Error(body?.error || 'Wewed could not complete the contract governance action.')
  return body.data
}

export function PlannerContractGovernance({ contractId }: { contractId: string }) {
  const [data, setData] = useState<Governance | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [reviewLinks, setReviewLinks] = useState<ReviewLink[]>([])
  const [reason, setReason] = useState('')
  const [changes, setChanges] = useState({ serviceDescription: '', agreedAmount: '', currency: '', serviceDate: '', serviceLocation: '' })

  const load = useCallback(async () => {
    try {
      setError('')
      const next = await jsonRequest(`/api/planner/contracts/${encodeURIComponent(contractId)}/governance`)
      setData(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load contract governance.')
    }
  }, [contractId])

  useEffect(() => { void load() }, [load])

  const partyById = useMemo(() => new Map((data?.parties ?? []).map((party) => [party.id, party])), [data?.parties])
  const openAmendment = data?.amendments.find((item) => ['DRAFT', 'PROPOSED', 'PARTIALLY_ACCEPTED'].includes(item.status)) ?? null
  const effectiveVersion = data?.versions.find((version) => version.status === 'EFFECTIVE') ?? null

  async function createAmendment() {
    setBusy('create')
    setError('')
    setReviewLinks([])
    try {
      const payloadChanges: Record<string, unknown> = {}
      if (changes.serviceDescription.trim()) payloadChanges.serviceDescription = changes.serviceDescription
      if (changes.agreedAmount.trim()) payloadChanges.agreedAmount = changes.agreedAmount
      if (changes.currency.trim()) payloadChanges.currency = changes.currency
      if (changes.serviceDate.trim()) payloadChanges.serviceDate = changes.serviceDate
      if (changes.serviceLocation.trim()) payloadChanges.serviceLocation = changes.serviceLocation
      await jsonRequest(`/api/planner/contracts/${encodeURIComponent(contractId)}/amendments`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason, changes: payloadChanges }),
      })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create amendment.')
    } finally { setBusy('') }
  }

  async function issueAmendment(amendmentId: string) {
    setBusy(`issue:${amendmentId}`)
    setError('')
    try {
      const result = await jsonRequest(`/api/planner/contracts/${encodeURIComponent(contractId)}/amendments/${encodeURIComponent(amendmentId)}/issue`, { method: 'POST' })
      setReviewLinks(result.reviewLinks ?? [])
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to issue amendment.')
    } finally { setBusy('') }
  }

  async function rotate(versionId: string) {
    setBusy(`rotate:${versionId}`)
    setError('')
    try {
      const result = await jsonRequest(`/api/planner/contracts/${encodeURIComponent(contractId)}/versions/${encodeURIComponent(versionId)}/review-links/rotate`, { method: 'POST' })
      setReviewLinks(result.reviewLinks ?? [])
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to rotate pending review links.')
    } finally { setBusy('') }
  }

  async function openVault(vaultObjectId: string) {
    setError('')
    try {
      const result = await jsonRequest(`/api/planner/vault/${encodeURIComponent(vaultObjectId)}`)
      if (!result?.url) throw new Error('Secure Vault URL was not returned.')
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open Vault object.')
    }
  }

  if (!data) {
    return <div className="rounded-2xl border border-gold/20 bg-white p-6 text-sm text-espresso/65">{error || 'Loading governed contract acceptance…'}</div>
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gold/20 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Phase 3 governance</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="font-serif text-3xl text-espresso">{data.contract.contractNumber}</h1><p className="mt-1 text-sm text-espresso/55">Status: {data.contract.status.replaceAll('_', ' ')}</p></div>
          <div className="rounded-full border border-gold/25 bg-champagne px-4 py-2 text-xs font-semibold text-espresso">Current version {data.contract.currentVersionNumber}</div>
        </div>
        <p className="mt-4 text-sm leading-6 text-espresso/65">Viewing is never acceptance. Every final decision below is tied to an exact contract digest and is append-only. Admin support cannot manufacture a party receipt.</p>
      </section>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <section className="rounded-2xl border border-gold/20 bg-white p-5">
        <h2 className="font-serif text-2xl text-espresso">Version acceptance</h2>
        <div className="mt-4 space-y-4">
          {data.versions.map((version) => {
            const requirements = data.requirements.filter((row) => row.contractVersionId === version.id)
            const effectivity = data.effectivity.find((row) => row.contractVersionId === version.id)
            const canRotate = ['ISSUED', 'AWAITING_ACCEPTANCE', 'PARTIALLY_ACCEPTED'].includes(version.status) && requirements.some((row) => row.status === 'PENDING')
            return (
              <article key={version.id} className="rounded-xl border border-espresso/10 bg-ivory p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>Version {version.versionNumber}</strong><span className="ml-2 text-xs uppercase tracking-wide text-espresso/45">{version.status.replaceAll('_', ' ')}</span></div>{canRotate ? <button type="button" onClick={() => rotate(version.id)} disabled={busy === `rotate:${version.id}`} className="rounded-full border border-gold/30 px-3 py-1.5 text-xs font-semibold text-gold-muted disabled:opacity-50">Rotate pending links</button> : null}</div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div className="break-all rounded-lg bg-white p-2">Canonical: {version.contentSha256 || 'draft'}</div><div className="break-all rounded-lg bg-white p-2">Artifact: {version.artifactSha256 || 'draft'}</div></div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {requirements.map((row) => {
                    const party = partyById.get(row.engagementPartyId)
                    const receipt = data.acceptances.find((item) => item.contractVersionId === version.id && item.engagementPartyId === row.engagementPartyId)
                    return <div key={row.id} className="rounded-lg border border-espresso/10 bg-white p-3 text-xs"><p className="font-semibold">{party?.displayName || row.requiredRole}</p><p className="mt-1 text-espresso/55">{row.requiredRole.replaceAll('_', ' ')} · {row.status}</p>{receipt ? <p className="mt-2 text-espresso/60">Receipt {receipt.id}<br/>{new Date(receipt.decisionAt).toLocaleString()} · {receipt.identityKind.replaceAll('_', ' ')}</p> : <p className="mt-2 text-espresso/40">No decision receipt yet</p>}</div>
                  })}
                </div>
                {effectivity ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><span>Effective {new Date(effectivity.effectiveAt).toLocaleString()} · Acceptance Certificate SHA-256 {effectivity.acceptanceCertificateSha256}</span><button type="button" onClick={() => openVault(effectivity.acceptanceCertificateVaultObjectId)} className="rounded-full border border-emerald-300 px-3 py-1.5 font-semibold">Open certificate</button></div> : null}
              </article>
            )
          })}
        </div>
      </section>

      {reviewLinks.length ? <section className="rounded-2xl border border-gold/20 bg-champagne p-5"><h2 className="font-serif text-xl">Fresh secure review links</h2><p className="mt-2 text-xs text-espresso/55">Raw tokens are shown only in this response. Send each link only to its named party.</p><div className="mt-3 space-y-2">{reviewLinks.map((link) => <div key={`${link.partyId}-${link.reviewUrl}`} className="flex flex-col gap-2 rounded-xl bg-white p-3 text-xs sm:flex-row sm:items-center sm:justify-between"><span>{partyById.get(link.partyId)?.displayName || link.role} · expires {new Date(link.expiresAt).toLocaleString()}</span><button type="button" onClick={() => navigator.clipboard.writeText(link.reviewUrl)} className="rounded-full border border-gold/25 px-3 py-1.5 font-semibold">Copy secure link</button></div>)}</div></section> : null}

      <section className="rounded-2xl border border-gold/20 bg-white p-5">
        <h2 className="font-serif text-2xl text-espresso">Amendments</h2>
        <p className="mt-2 text-sm leading-6 text-espresso/60">An effective version is never edited in place. A material change creates a replacement version and a visible diff; the old version remains effective until the replacement is fully accepted.</p>
        {data.amendments.length ? <div className="mt-4 space-y-3">{data.amendments.map((item) => <article key={item.id} className="rounded-xl border border-espresso/10 bg-ivory p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{item.id}</strong><span className="ml-2 text-xs text-espresso/45">{item.status}</span></div>{item.status === 'DRAFT' ? <button type="button" disabled={busy === `issue:${item.id}`} onClick={() => issueAmendment(item.id)} className="rounded-full bg-espresso px-4 py-2 text-xs font-semibold text-champagne disabled:opacity-50">Issue amendment</button> : null}</div><p className="mt-2 text-sm text-espresso/65">{item.reason}</p><pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-espresso/65">{JSON.stringify(item.diffSummary, null, 2)}</pre></article>)}</div> : null}

        {data.contract.status === 'EFFECTIVE' && !openAmendment && effectiveVersion ? <div className="mt-5 rounded-xl border border-gold/15 bg-champagne/60 p-4"><h3 className="font-semibold">Propose replacement terms</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs">Reason<input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-gold/20 bg-white px-3 py-2 text-sm" placeholder="Why is this material change needed?" /></label><label className="text-xs">Currency<input value={changes.currency} onChange={(event) => setChanges((current) => ({ ...current, currency: event.target.value }))} className="mt-1 w-full rounded-lg border border-gold/20 bg-white px-3 py-2 text-sm" placeholder="USD" /></label><label className="text-xs sm:col-span-2">Service description<textarea value={changes.serviceDescription} onChange={(event) => setChanges((current) => ({ ...current, serviceDescription: event.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-gold/20 bg-white px-3 py-2 text-sm" /></label><label className="text-xs">Agreed amount<input value={changes.agreedAmount} onChange={(event) => setChanges((current) => ({ ...current, agreedAmount: event.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-gold/20 bg-white px-3 py-2 text-sm" /></label><label className="text-xs">Service date<input value={changes.serviceDate} onChange={(event) => setChanges((current) => ({ ...current, serviceDate: event.target.value }))} type="date" className="mt-1 w-full rounded-lg border border-gold/20 bg-white px-3 py-2 text-sm" /></label><label className="text-xs sm:col-span-2">Service location<input value={changes.serviceLocation} onChange={(event) => setChanges((current) => ({ ...current, serviceLocation: event.target.value }))} className="mt-1 w-full rounded-lg border border-gold/20 bg-white px-3 py-2 text-sm" /></label></div><button type="button" disabled={busy === 'create'} onClick={createAmendment} className="mt-4 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-espresso disabled:opacity-50">Create governed amendment draft</button></div> : null}
      </section>

      <section className="rounded-2xl border border-gold/20 bg-white p-5"><h2 className="font-serif text-xl">Audit trail</h2><div className="mt-3 max-h-72 space-y-2 overflow-auto text-xs">{data.events.map((event) => <div key={event.id} className="flex justify-between gap-3 rounded-lg bg-ivory px-3 py-2"><span>{event.eventType.replaceAll('_', ' ')}</span><span className="text-espresso/45">{new Date(event.createdAt).toLocaleString()}</span></div>)}</div></section>
    </div>
  )
}
