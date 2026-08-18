'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileSearch2, Loader2, RefreshCw, Scale, ShieldCheck, WalletCards } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TransactionGovernancePanel } from '@/components/wedding/planner/modules/transaction-governance-panel'

type WeddingOption = {
  id: string
  slug: string
  title: string
  date: string
  venue: string
  venueCity: string
  venueCountry: string
}

type EngagementRow = {
  id: string
  origin: string
  recordMode: string
  lifecycleStatus: string
  serviceCategory: string
  serviceDescription: string | null
  agreedAmount: number | null
  currency: string
  serviceDate: string | null
  serviceLocation: string | null
  createdAt: string
  vendor: { id: string; name: string; category: string }
  contracts: Array<{ id: string; contractNumber: string; status: string; currentVersionNumber: number }>
}

type Payload = {
  admin: { userId: string; role: string }
  weddings: WeddingOption[]
  selectedWedding: WeddingOption | null
  engagements: EngagementRow[]
}

async function adminJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!payload || !response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`)
  return payload
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function money(value: number | null, currency: string): string {
  if (value === null) return 'Not recorded'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export function AdminTransactionGovernanceConsole() {
  const [data, setData] = useState<Payload | null>(null)
  const [selectedWeddingId, setSelectedWeddingId] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'payments' | 'disputes'>('payments')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (weddingId = '') => {
    setLoading(true)
    setError(null)
    try {
      const suffix = weddingId ? `?weddingId=${encodeURIComponent(weddingId)}` : ''
      const payload = await adminJson<Payload>(`/api/admin/transaction-governance${suffix}`)
      setData(payload)
      setSelectedWeddingId(payload.selectedWedding?.id ?? weddingId)
      setExpandedId(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load transaction governance records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load('')
  }, [load])

  if (loading && !data) {
    return <main className="flex min-h-screen items-center justify-center bg-espresso text-gold"><Loader2 className="size-8 animate-spin" /></main>
  }

  return (
    <main className="min-h-screen bg-espresso px-4 py-24 text-champagne sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold">Phase 4 · support authority</p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Payments, evidence & disputes</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-champagne/55">
              Read-only support view across scoped Service Engagements. Admin can inspect reconciliation flags, payment facts, evidence holds and dispute trails, but this surface cannot record money, accept a contract, release a hold, or adjudicate an issue.
            </p>
          </div>
          <Button type="button" variant="outline" disabled={loading} onClick={() => void load(selectedWeddingId)} className="border-gold/25 bg-transparent text-gold hover:bg-gold/10"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </header>

        <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm text-champagne/60">
          <ShieldCheck className="mr-2 inline size-4 text-gold" />
          Support authority is observational here. Party acceptance and dispute outcome sources remain outside Admin authorship.
        </div>

        {error && <div role="alert" className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay-light">{error}</div>}

        <section className="rounded-2xl border border-gold/15 bg-white/[0.03] p-4">
          <label className="text-xs font-medium text-champagne/60" htmlFor="admin-transaction-wedding">Wedding in your Admin scope</label>
          <select id="admin-transaction-wedding" value={selectedWeddingId} disabled={loading || !data?.weddings.length} onChange={(event) => { const next = event.target.value; setSelectedWeddingId(next); if (next) void load(next) }} className="mt-2 h-11 w-full rounded-lg border border-gold/20 bg-espresso px-3 text-sm text-champagne">
            {!data?.weddings.length && <option value="">No scoped weddings available</option>}
            {data?.weddings.map((wedding) => <option key={wedding.id} value={wedding.id}>{wedding.title} · {new Date(wedding.date).toLocaleDateString()} · {wedding.venueCity}</option>)}
          </select>
        </section>

        <section className="space-y-3">
          {data?.engagements.map((engagement) => {
            const expanded = expandedId === engagement.id
            const contract = engagement.contracts[0]
            return (
              <article key={engagement.id} className="rounded-2xl border border-gold/15 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-xl">{engagement.vendor.name}</h2><Badge variant="outline" className="border-gold/20 text-gold">{titleCase(engagement.lifecycleStatus)}</Badge></div>
                    <p className="mt-1 text-xs text-champagne/45">{titleCase(engagement.serviceCategory)} · {titleCase(engagement.origin)} / {titleCase(engagement.recordMode)} · {money(engagement.agreedAmount, engagement.currency)}</p>
                    {contract && <p className="mt-1 text-[10px] text-champagne/35">{contract.contractNumber} · {titleCase(contract.status)} · version {contract.currentVersionNumber}</p>}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setExpandedId(expanded ? null : engagement.id)} className="border-gold/20 text-gold"><FileSearch2 className="size-4" />{expanded ? 'Close support view' : 'Inspect governance'}</Button>
                </div>

                {expanded && (
                  <div className="mt-4 space-y-3 border-t border-gold/10 pt-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant={mode === 'payments' ? 'default' : 'outline'} onClick={() => setMode('payments')} className={mode === 'payments' ? 'bg-gold text-espresso hover:bg-gold-light' : 'border-gold/20 text-gold'}><WalletCards className="size-4" />Payments & reconciliation</Button>
                      <Button type="button" size="sm" variant={mode === 'disputes' ? 'default' : 'outline'} onClick={() => setMode('disputes')} className={mode === 'disputes' ? 'bg-gold text-espresso hover:bg-gold-light' : 'border-gold/20 text-gold'}><Scale className="size-4" />Evidence & disputes</Button>
                    </div>
                    <TransactionGovernancePanel engagementId={engagement.id} mode={mode} readOnly adminVault endpoint={`/api/admin/service-engagements/${engagement.id}/transactions`} />
                  </div>
                )}
              </article>
            )
          })}
          {data && data.engagements.length === 0 && <div className="rounded-xl border border-dashed border-gold/20 px-5 py-12 text-center text-sm text-champagne/50">This wedding has no Service Engagement records.</div>}
        </section>
      </div>
    </main>
  )
}
