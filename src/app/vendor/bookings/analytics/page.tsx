'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, ExternalLink, Loader2, RefreshCw, TrendingUp } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

type Analytics = {
  business: { id: string; name: string }
  totals: {
    bookingsStarted: number
    bookingsConfirmed: number
    bookingConversionRate: number
    confirmedValueCents: number
    referralOpens: number
    referralBookingStarts: number
    referralConfirmed: number
    completed: number
    cancelled: number
    disputed: number
    averageLeadDays: number | null
    averageValueCents: number | null
    resourceUtilization: number | null
  }
  bookingsByStatus: Record<string,{count:number;valueCents:number}>
  catalogItems: Array<{catalogItemId:string;name:string;starts:number;confirmed:number;valueCents:number}>
  referralLinks: Array<{id:string;token:string;channel:string|null;campaign:string|null;catalogItemId:string|null;isActive:boolean;opens:number;starts:number;confirmed:number;path:string}>
}

function money(cents:number|null|undefined){if(cents==null)return '—';try{return new Intl.NumberFormat(undefined,{style:'currency',currency:'USD'}).format(cents/100)}catch{return `USD ${(cents/100).toFixed(2)}`}}
function pct(value:number|null|undefined){return value==null?'—':`${(value*100).toFixed(1)}%`}
function number(value:number|null|undefined,digits=1){return value==null?'—':new Intl.NumberFormat(undefined,{maximumFractionDigits:digits}).format(value)}
function human(value:string){return value.replaceAll('_',' ').replaceAll('-',' ')}

export default function VendorBookingAnalyticsPage(){
  const [data,setData]=useState<Analytics|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{setLoading(true);setError('');try{const response=await fetch('/api/vendor/booking-analytics',{cache:'no-store'});const payload=await response.json();if(!response.ok||!payload.success)throw new Error(payload.error||'Unable to load booking analytics.');setData(payload.data)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to load booking analytics.')}finally{setLoading(false)}},[])
  useEffect(()=>{void load()},[load])
  const statuses=useMemo(()=>data?Object.entries(data.bookingsByStatus).sort((a,b)=>b[1].count-a[1].count):[],[data])
  return <DashboardAuthGate allowedRoles={['vendor']} wrongRoleMessage="Booking analytics is available to approved Wewed Vendor accounts." title="Booking analytics" description="Sign in as an approved Vendor to view your booking funnel and resource performance.">
    <main className="min-h-dvh bg-ivory px-4 py-8 text-espresso sm:px-6"><div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/vendor/bookings" className="inline-flex items-center gap-2 text-sm font-semibold text-espresso/60"><ArrowLeft className="size-4"/>Booking Center</Link><button onClick={()=>void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 bg-white px-4 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`size-4 ${loading?'animate-spin':''}`}/>Refresh</button></div>
      <section className="mt-5 rounded-3xl border border-gold/20 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-gold-muted">Commerce performance</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Booking analytics</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-espresso/60">Revenue is counted once per booking, even when two bookings have the same value. Superseded booking-line revisions are excluded from item attribution, so amendments do not double-count demand.</p></section>
      {error?<div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</div>:null}
      {loading&&!data?<div className="mt-6 flex items-center justify-center gap-2 rounded-3xl border bg-white p-10"><Loader2 className="size-5 animate-spin"/>Loading analytics…</div>:null}
      {data?<>
        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wider text-espresso/45">Booking conversion</div><div className="mt-2 text-3xl font-semibold">{pct(data.totals.bookingConversionRate)}</div><div className="mt-1 text-xs text-espresso/50">{data.totals.bookingsConfirmed} confirmed of {data.totals.bookingsStarted} started</div></div>
          <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wider text-espresso/45">Confirmed value</div><div className="mt-2 text-3xl font-semibold">{money(data.totals.confirmedValueCents)}</div><div className="mt-1 text-xs text-espresso/50">Booking value, not payment received</div></div>
          <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wider text-espresso/45">Average lead time</div><div className="mt-2 text-3xl font-semibold">{number(data.totals.averageLeadDays)} days</div><div className="mt-1 text-xs text-espresso/50">Request to service date</div></div>
          <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wider text-espresso/45">Allocated utilization</div><div className="mt-2 text-3xl font-semibold">{pct(data.totals.resourceUtilization)}</div><div className="mt-1 text-xs text-espresso/50">Confirmed allocated resource-minutes</div></div>
        </section>
        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border bg-white p-5"><div className="flex items-center gap-2"><BarChart3 className="size-5 text-gold-muted"/><h2 className="font-serif text-2xl">Booking states</h2></div><div className="mt-4 space-y-2">{statuses.length?statuses.map(([status,row])=><div key={status} className="flex items-center justify-between gap-4 rounded-xl bg-ivory p-3 text-sm"><span className="font-medium capitalize">{human(status)}</span><span className="text-right"><strong>{row.count}</strong><span className="ml-2 text-xs text-espresso/45">{money(row.valueCents)}</span></span></div>):<p className="text-sm text-espresso/50">No booking activity yet.</p>}</div></div>
          <div className="rounded-3xl border bg-white p-5"><div className="flex items-center gap-2"><TrendingUp className="size-5 text-gold-muted"/><h2 className="font-serif text-2xl">Referral funnel</h2></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-ivory p-3"><strong className="block text-2xl">{data.totals.referralOpens}</strong><span className="text-xs text-espresso/50">opens</span></div><div className="rounded-xl bg-ivory p-3"><strong className="block text-2xl">{data.totals.referralBookingStarts}</strong><span className="text-xs text-espresso/50">starts</span></div><div className="rounded-xl bg-ivory p-3"><strong className="block text-2xl">{data.totals.referralConfirmed}</strong><span className="text-xs text-espresso/50">confirmed</span></div></div><div className="mt-4 space-y-2">{data.referralLinks.slice(0,8).map(link=><div key={link.id} className="rounded-xl border p-3 text-xs"><div className="flex items-center justify-between gap-3"><strong>{link.campaign||link.channel||'Share link'}</strong><Link href={link.path} target="_blank" className="inline-flex items-center gap-1 text-gold-muted">Open<ExternalLink className="size-3"/></Link></div><div className="mt-1 text-espresso/55">{link.opens} opens · {link.starts} starts · {link.confirmed} confirmed</div></div>)}</div></div>
        </section>
        <section className="mt-6 rounded-3xl border bg-white p-5"><h2 className="font-serif text-2xl">Catalogue conversion</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-espresso/45"><tr><th className="pb-3">Item</th><th className="pb-3">Starts</th><th className="pb-3">Confirmed</th><th className="pb-3">Conversion</th><th className="pb-3">Confirmed value</th></tr></thead><tbody>{data.catalogItems.map(item=><tr key={item.catalogItemId} className="border-t"><td className="py-3 font-medium">{item.name}</td><td className="py-3">{item.starts}</td><td className="py-3">{item.confirmed}</td><td className="py-3">{pct(item.starts?item.confirmed/item.starts:0)}</td><td className="py-3">{money(item.valueCents)}</td></tr>)}</tbody></table></div></section>
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong>Financial interpretation:</strong> confirmed booking value is commercial commitment, not cash received. Wewed payment and contribution records remain the source of truth for paid amount and funding source.</section>
      </>:null}
    </div></main>
  </DashboardAuthGate>
}
