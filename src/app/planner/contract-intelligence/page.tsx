'use client'

import { useEffect, useMemo, useState } from 'react'

type Dashboard = {
  advisoryBoundary: string
  aiBoundary: string
  overview: Record<string, number>
  engagements: Array<{ id: string; vendorName: string; serviceCategory: string; lifecycleStatus: string; effectiveContractCount: number; managedPaymentFacts: number; openDisputes: number }>
  contracts: Array<{ id: string; contractNumber: string; title: string; status: string; vendorName: string; serviceCategory: string; pendingAcceptanceRequirements: number; pendingAmendments: number; versions: Array<{ id: string; versionNumber: number; status: string; effective: boolean }> }>
  vendorSignals: Array<{ vendorId: string; vendorName: string; engagementCount: number; effectiveContractCount: number; managedPaymentFacts: number; paymentProofGaps: number; openDisputes: number; externalOrMutualOutcomes: number; activeEvidenceHolds: number }>
  reviewSignals: Array<{ code: string; severity: string; message: string }>
}

export default function ContractIntelligencePage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [explanation, setExplanation] = useState('')
  const [amendmentText, setAmendmentText] = useState('')
  const [proposal, setProposal] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  async function load(nextQuery = '') {
    setLoading(true)
    setError('')
    const response = await fetch(`/api/planner/contract-intelligence${nextQuery.trim() ? `?q=${encodeURIComponent(nextQuery.trim())}` : ''}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) {
      setError(payload?.error || 'Unable to load contract intelligence.')
      setDashboard(null)
    } else {
      setDashboard(payload.dashboard)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const versions = useMemo(() => dashboard?.contracts.flatMap((contract) => contract.versions.map((version) => ({ ...version, label: `${contract.contractNumber} · v${version.versionNumber} · ${contract.title}` }))) ?? [], [dashboard])

  async function explain() {
    if (!selectedVersionId) return
    setAiBusy(true)
    setExplanation('')
    const response = await fetch('/api/planner/contract-intelligence/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractVersionId: selectedVersionId }) })
    const payload = await response.json().catch(() => null)
    setExplanation(response.ok && payload?.success ? payload.explanation : payload?.error || 'AI explanation is unavailable.')
    setAiBusy(false)
  }

  async function assistAmendment() {
    if (!selectedVersionId || !amendmentText.trim()) return
    setAiBusy(true)
    setProposal('')
    const response = await fetch('/api/planner/contract-intelligence/amendment-assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractVersionId: selectedVersionId, amendmentText }) })
    const payload = await response.json().catch(() => null)
    setProposal(response.ok && payload?.success ? payload.proposal : payload?.error || 'AI amendment assistance is unavailable.')
    setAiBusy(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 6 · trusted intelligence</p>
          <h1 className="mt-2 text-3xl font-bold">Contract intelligence, analytics & trust</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-600">Search governed contracts and engagements, inspect factual review signals, and optionally ask AI to explain an exact contract version or extract a proposed amendment.</p>
        </header>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Governance boundary:</strong> Signals are review prompts, not findings. AI explanations are advisory only. No AI action accepts or amends a contract, makes it effective, records a payment, changes evidence, or adjudicates a dispute.
        </section>

        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(query) }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contract number, vendor, service, title or status" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3" />
          <button className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">Search</button>
        </form>

        {loading && <p className="text-sm text-slate-500">Loading governed records…</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {dashboard && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(dashboard.overview).map(([key, value]) => <div key={key} className="rounded-2xl border bg-white p-4"><div className="text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-slate-500">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</div></div>)}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-5">
                <h2 className="text-lg font-semibold">Review signals</h2>
                <p className="mt-1 text-xs text-slate-500">{dashboard.advisoryBoundary}</p>
                <div className="mt-4 space-y-3">
                  {dashboard.reviewSignals.length === 0 ? <p className="text-sm text-slate-500">No current review signals.</p> : dashboard.reviewSignals.map((signal, index) => <div key={`${signal.code}-${index}`} className="rounded-xl border p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{signal.severity} · {signal.code}</div><p className="mt-1 text-sm">{signal.message}</p></div>)}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-5">
                <h2 className="text-lg font-semibold">Vendor factual signals</h2>
                <p className="mt-1 text-xs text-slate-500">Counts describe governed Wewed records. They are not a reputation score or breach/fraud finding.</p>
                <div className="mt-4 space-y-3">
                  {dashboard.vendorSignals.map((vendor) => <div key={vendor.vendorId} className="rounded-xl border p-3"><div className="font-semibold">{vendor.vendorName}</div><p className="mt-1 text-xs text-slate-600">Engagements {vendor.engagementCount} · effective contracts {vendor.effectiveContractCount} · payment facts {vendor.managedPaymentFacts} · proof gaps {vendor.paymentProofGaps} · open disputes {vendor.openDisputes} · external/mutual outcomes {vendor.externalOrMutualOutcomes} · active holds {vendor.activeEvidenceHolds}</p></div>)}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5">
              <h2 className="text-lg font-semibold">Contracts & engagement search</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {dashboard.contracts.map((contract) => <div key={contract.id} className="rounded-xl border p-3"><div className="font-semibold">{contract.contractNumber} · {contract.title}</div><p className="text-xs text-slate-500">{contract.vendorName} · {contract.serviceCategory} · {contract.status}</p><p className="mt-2 text-xs">Pending acceptance requirements: {contract.pendingAcceptanceRequirements} · pending amendments: {contract.pendingAmendments}</p></div>)}
                {dashboard.engagements.map((engagement) => <div key={engagement.id} className="rounded-xl border p-3"><div className="font-semibold">{engagement.vendorName} · {engagement.serviceCategory}</div><p className="text-xs text-slate-500">{engagement.lifecycleStatus} · effective contracts {engagement.effectiveContractCount} · payment facts {engagement.managedPaymentFacts} · open disputes {engagement.openDisputes}</p></div>)}
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5">
              <h2 className="text-lg font-semibold">Optional AI assistance</h2>
              <p className="mt-1 text-xs text-slate-500">{dashboard.aiBoundary}</p>
              <select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)} className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-3">
                <option value="">Choose an exact contract version</option>
                {versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
              </select>
              <div className="mt-3 flex flex-wrap gap-2"><button disabled={!selectedVersionId || aiBusy} onClick={() => void explain()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Explain selected version</button></div>
              {explanation && <div className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{explanation}</div>}
              <textarea value={amendmentText} onChange={(event) => setAmendmentText(event.target.value)} placeholder="Paste or draft the proposed amendment text. Wewed AI will extract a proposal only; it will not create an amendment." className="mt-5 min-h-32 w-full rounded-xl border border-slate-300 p-3" />
              <button disabled={!selectedVersionId || !amendmentText.trim() || aiBusy} onClick={() => void assistAmendment()} className="mt-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Extract amendment proposal</button>
              {proposal && <div className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{proposal}</div>}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
