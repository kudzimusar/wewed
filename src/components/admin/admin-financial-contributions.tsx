'use client'

import { useEffect, useState } from 'react'
import { CircleDollarSign, Gift, HandHeart, Loader2, Store, Users } from 'lucide-react'

interface CurrencySummary { currency: string; cashReceived: number; directVendorPaid: number; inKindValue: number; pledged: number; availableCash: number }
interface Analytics { contributions: number; weddingsUsingContributions: number; campaigns: number; directVendorPayments: number; inKindContributions: number; thankYousOutstanding: number; explicitlyUnattributedFundingRows: number; summaryByCurrency: CurrencySummary[] }

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) }
  catch { return `${currency} ${Math.round(value).toLocaleString()}` }
}

export function AdminFinancialContributions() {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    void fetch('/api/admin/contributions/analytics', { cache: 'no-store' }).then(async (response) => {
      const body = await response.json()
      if (!response.ok || body.success === false) throw new Error(body.error || 'Could not load financial contribution analytics.')
      if (!cancelled) setData(body.data)
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load analytics.') })
    return () => { cancelled = true }
  }, [])

  return <main className="min-h-dvh bg-espresso px-4 pb-28 pt-8 text-champagne sm:px-6" data-admin-financial-contributions>
    <div className="mx-auto max-w-6xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Admin · Resource accounting</p>
      <h1 className="mt-2 font-serif text-3xl">Financial Contributions</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-champagne/55">Operational visibility into wedding support recorded in the Planner. This is separate from Guest Stories / “Our Village” moderation and never combines different currencies.</p>
      {error && <div role="alert" className="mt-5 rounded-xl border border-clay/30 bg-clay/10 p-3 text-sm text-clay-light">{error}</div>}
      {!data && !error ? <div className="mt-12 flex justify-center"><Loader2 className="size-7 animate-spin text-gold" /></div> : data ? <>
        <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ['Recorded', data.contributions, HandHeart], ['Weddings', data.weddingsUsingContributions, Users], ['Campaigns', data.campaigns, Gift], ['Direct vendor payments', data.directVendorPayments, Store],
            ['In-kind records', data.inKindContributions, Gift], ['Thank-yous pending', data.thankYousOutstanding, HandHeart], ['Unattributed funding rows', data.explicitlyUnattributedFundingRows, CircleDollarSign],
          ].map(([label, value, Icon]) => <section key={String(label)} className="rounded-2xl border border-gold/15 bg-white/[0.025] p-4"><Icon className="size-4 text-gold" /><p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-champagne/45">{String(label)}</p><p className="mt-1 font-serif text-2xl">{Number(value).toLocaleString()}</p></section>)}
        </div>
        <section className="mt-6 rounded-2xl border border-gold/15 bg-white/[0.025] p-4 sm:p-5">
          <h2 className="font-serif text-xl">Value by currency</h2><p className="mt-1 text-xs text-champagne/45">Each currency is its own accounting bucket.</p>
          {data.summaryByCurrency.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{data.summaryByCurrency.map((row) => <div key={row.currency} className="rounded-xl border border-gold/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">{row.currency}</p><p className="mt-2 text-sm">Received {money(row.cashReceived,row.currency)} · Direct vendor {money(row.directVendorPaid,row.currency)}</p><p className="mt-1 text-xs text-champagne/50">In-kind {money(row.inKindValue,row.currency)} · Pledged {money(row.pledged,row.currency)} · Available {money(row.availableCash,row.currency)}</p></div>)}</div> : <p className="mt-4 text-sm text-champagne/50">No financial Contributions have been recorded yet.</p>}
        </section>
      </> : null}
    </div>
  </main>
}
