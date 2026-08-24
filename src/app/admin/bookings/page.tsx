'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileSearch, Loader2, RefreshCw, Search } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

type Booking = {
  id: string
  publicReference: string
  status: string
  bookingMode: string
  currency: string
  totalCents: number | null
  depositCents: number | null
  weddingId: string
  weddingTitle: string
  weddingDate: string
  coupleName: string
  providerSlug: string
  providerName: string
  category: string
  serviceEngagementId: string | null
  engagementStatus: string | null
  contractId: string | null
  contractNumber: string | null
  contractStatus: string | null
  budgetItemId: string | null
  budgetEstimatedCost: string | number | null
  budgetActualCost: string | number | null
  budgetPaidAmount: string | number | null
  budgetCurrency: string | null
  paymentCount: number
  netPaid: string | number
  contributionCount: number
  allocatedContributionAmount: string | number
  amendmentCount: number
  pendingAmendmentCount: number
  referralChannel: string | null
  referralCampaign: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
}

function cents(value: number | null, currency: string) {
  if (value == null) return 'Not quoted'
  try { return new Intl.NumberFormat(undefined,{style:'currency',currency}).format(value/100) }
  catch { return `${currency} ${(value/100).toFixed(2)}` }
}
function major(value: string | number | null | undefined, currency='USD') {
  if (value == null) return '—'
  const parsed=Number(value); if(!Number.isFinite(parsed)) return String(value)
  try { return new Intl.NumberFormat(undefined,{style:'currency',currency}).format(parsed) } catch { return `${currency} ${parsed.toFixed(2)}` }
}
function human(value: string | null | undefined) { return value ? value.replaceAll('_',' ') : '—' }

export default function AdminBookingsPage() {
  const [bookings,setBookings]=useState<Booking[]>([])
  const [statusCounts,setStatusCounts]=useState<Record<string,number>>({})
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      const params=new URLSearchParams();if(query.trim())params.set('q',query.trim());if(status)params.set('status',status)
      const response=await fetch(`/api/admin/bookings?${params.toString()}`,{cache:'no-store',credentials:'include'})
      const payload=await response.json()
      if(!response.ok||!payload.success)throw new Error(payload.error||'Unable to load booking support records.')
      setBookings(payload.data.bookings||[]);setStatusCounts(payload.data.statusCounts||{})
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to load booking support records.')}finally{setLoading(false)}
  },[query,status])

  useEffect(()=>{void load()},[load])
  const total=useMemo(()=>Object.values(statusCounts).reduce((sum,value)=>sum+value,0),[statusCounts])

  return <DashboardAuthGate allowedRoles={['admin']} wrongRoleMessage="This workspace is restricted to authorized Wewed administrators." title="Booking support" description="Sign in with Wewed Admin support access.">
    <main className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300"><ArrowLeft className="size-4"/>Admin</Link><button onClick={()=>void load()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold"><RefreshCw className={`size-4 ${loading?'animate-spin':''}`}/>Refresh</button></div>
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Read-only commercial support</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Booking support</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">Trace a booking across provider, wedding, Service Engagement, governed contract, Budget, factual payment evidence, Contributions, amendments and referral provenance. This surface intentionally does not bypass vendor/couple/contract/payment governance.</p><div className="mt-5 text-sm text-slate-400">{total} booking records across {Object.keys(statusCounts).length} lifecycle states.</div></section>

        <section className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_240px_auto]"><label className="text-xs font-semibold text-slate-300">Search reference, vendor, wedding or couple<div className="mt-1 flex min-h-11 items-center rounded-xl border border-white/15 bg-black/20 px-3"><Search className="mr-2 size-4 text-slate-500"/><input value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')void load()}} className="w-full bg-transparent text-sm outline-none" placeholder="WW-BKG..., Shandy, wedding title..."/></div></label><label className="text-xs font-semibold text-slate-300">Status<select value={status} onChange={(e)=>setStatus(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3"><option value="">All statuses</option>{Object.entries(statusCounts).map(([key,count])=><option key={key} value={key}>{human(key)} ({count})</option>)}</select></label><button onClick={()=>void load()} className="self-end min-h-11 rounded-xl bg-amber-300 px-5 text-sm font-bold text-slate-950">Search</button></section>

        {error?<div className="mt-4 rounded-2xl border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-100">{error}</div>:null}
        {loading&&!bookings.length?<div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400"><Loader2 className="size-5 animate-spin"/>Loading governed booking evidence…</div>:null}
        <div className="mt-6 space-y-4">{bookings.map((booking)=><article key={booking.id} className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">{human(booking.status)}</span><span className="px-2 py-1 text-xs text-slate-500">{booking.publicReference}</span></div><h2 className="mt-3 font-serif text-3xl">{booking.providerName}</h2><p className="mt-1 text-sm text-slate-400">{booking.weddingTitle} · {booking.coupleName} · {human(booking.category)}</p></div><div className="rounded-2xl bg-black/20 p-4 text-sm lg:w-64"><div className="text-xs uppercase tracking-wider text-slate-500">Booking value</div><div className="mt-1 text-xl font-semibold">{cents(booking.totalCents,booking.currency)}</div>{booking.depositCents!=null?<div className="mt-1 text-xs text-slate-400">Deposit {cents(booking.depositCents,booking.currency)}</div>:null}</div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl bg-black/20 p-3 text-xs"><div className="font-bold text-slate-300">Service Engagement</div><div className="mt-2 text-slate-400">{booking.serviceEngagementId?human(booking.engagementStatus):'Not linked'}</div></div><div className="rounded-2xl bg-black/20 p-3 text-xs"><div className="font-bold text-slate-300">Contract</div><div className="mt-2 text-slate-400">{booking.contractNumber?`${booking.contractNumber} · ${human(booking.contractStatus)}`:'No governed contract'}</div></div><div className="rounded-2xl bg-black/20 p-3 text-xs"><div className="font-bold text-slate-300">Payment facts</div><div className="mt-2 text-slate-400">{booking.paymentCount} records · net {major(booking.netPaid,booking.budgetCurrency||booking.currency)}</div></div><div className="rounded-2xl bg-black/20 p-3 text-xs"><div className="font-bold text-slate-300">Contributions</div><div className="mt-2 text-slate-400">{booking.contributionCount} records · allocated {major(booking.allocatedContributionAmount,booking.budgetCurrency||booking.currency)}</div></div><div className="rounded-2xl bg-black/20 p-3 text-xs"><div className="font-bold text-slate-300">Budget</div><div className="mt-2 text-slate-400">Estimate {major(booking.budgetEstimatedCost,booking.budgetCurrency||booking.currency)} · paid field {major(booking.budgetPaidAmount,booking.budgetCurrency||booking.currency)}</div></div><div className="rounded-2xl bg-black/20 p-3 text-xs"><div className="font-bold text-slate-300">Amendments</div><div className="mt-2 text-slate-400">{booking.amendmentCount} total · {booking.pendingAmendmentCount} pending</div></div><div className="rounded-2xl bg-black/20 p-3 text-xs"><div className="font-bold text-slate-300">Referral</div><div className="mt-2 text-slate-400">{booking.referralChannel||'Direct'}{booking.referralCampaign?` · ${booking.referralCampaign}`:''}</div></div><div className="rounded-2xl bg-black/20 p-3 text-xs"><div className="font-bold text-slate-300">Updated</div><div className="mt-2 text-slate-400">{new Date(booking.updatedAt).toLocaleString()}</div></div></div>
          <div className="mt-4 flex flex-wrap gap-2"><Link href={`/vendors/${encodeURIComponent(booking.providerSlug)}`} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 px-3 text-xs font-semibold"><FileSearch className="size-4"/>Provider profile</Link>{booking.contractId?<Link href={`/planner/contracts/${encodeURIComponent(booking.contractId)}/governance`} className="inline-flex min-h-9 items-center rounded-full border border-white/15 px-3 text-xs font-semibold">Governed contract</Link>:null}</div></article>)}</div>
      </div>
    </main>
  </DashboardAuthGate>
}
