'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, CreditCard, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  WEWED_PLANS,
  annualMonthlyEquivalent,
  formatUsd,
  type WewedBillingInterval,
  type WewedPlanId,
} from '@/lib/wewed-plans'

type PaidPlanId = Exclude<WewedPlanId, 'free'>

type BillingPayload = {
  success: boolean
  error?: string
  account: {
    id: string
    name: string
    type: string
    status: string
    subscriptionPlan: string
    subscriptionStatus: string
    currentPeriodEndsAt: string | null
    memberRole: string
    stripeCustomerId: string | null
    billingInterval: WewedBillingInterval | null
  }
  stripe: {
    mode: 'test' | 'live'
    enabled: boolean
    webhookConfigured: boolean
    plans: Record<PaidPlanId, Record<WewedBillingInterval, boolean>>
  }
}

function date(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value))
}

export function AccountBillingPortal() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<BillingPayload | null>(null)
  const [interval, setInterval] = useState<WewedBillingInterval>('month')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/billing/account', { cache: 'no-store' })
      const payload = (await response.json()) as BillingPayload
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load billing.')
      setData(payload)
      if (payload.account.billingInterval) setInterval(payload.account.billingInterval)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load billing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function openBilling(action: 'checkout' | 'portal', plan?: PaidPlanId) {
    setWorking(plan ? `${plan}:${interval}` : action)
    setError(null)
    try {
      const response = await fetch('/api/billing/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, plan, interval }),
      })
      const payload = (await response.json()) as { success?: boolean; url?: string | null; error?: string }
      if (!response.ok || !payload.success || !payload.url) throw new Error(payload.error || 'Unable to open Stripe.')
      window.location.assign(payload.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open Stripe.')
      setWorking(null)
    }
  }

  if (loading && !data) {
    return <main className="flex min-h-screen items-center justify-center bg-espresso text-champagne"><Loader2 className="size-8 animate-spin text-gold" /></main>
  }

  if (!data) {
    return <main className="flex min-h-screen items-center justify-center bg-espresso p-6 text-champagne"><Card className="max-w-lg border-red-300/25 bg-white/[0.04] text-champagne"><CardContent className="p-8 text-center"><CreditCard className="mx-auto size-10 text-gold" /><h1 className="mt-4 text-2xl font-semibold">Billing unavailable</h1><p className="mt-3 text-sm text-champagne/60">{error}</p><Button onClick={() => void load()} className="mt-6 bg-gold text-espresso hover:bg-gold-light">Retry</Button></CardContent></Card></main>
  }

  const checkoutResult = searchParams.get('checkout')
  const paidPlans = WEWED_PLANS.filter((plan): plan is typeof plan & { id: PaidPlanId } => plan.id !== 'free')

  return (
    <main className="min-h-screen bg-espresso px-5 py-14 text-champagne lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <a href="/" className="text-sm text-gold hover:text-gold-light">← Back to Wewed</a>
            <p className="mt-6 text-xs uppercase tracking-[0.22em] text-gold">Stripe Billing</p>
            <h1 className="mt-2 text-4xl font-semibold">{data.account.name}</h1>
            <p className="mt-2 text-sm text-champagne/55">Manage the Wewed subscription for this active business account.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading || Boolean(working)} className="border-gold/25 text-gold hover:bg-gold/10"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>

        {data.stripe.mode === 'test' && <div className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100"><strong>Stripe Sandbox:</strong> Checkout uses test cards only. Sandbox customer, subscription and webhook state is isolated from live billing and never enters the live revenue ledger.</div>}
        {checkoutResult === 'success' && <div className="flex items-center gap-3 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100"><CheckCircle2 className="size-5" />Stripe Checkout completed. Subscription status will update through the signed webhook.</div>}
        {checkoutResult === 'cancelled' && <div className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-sm text-gold-light">Checkout was cancelled. No plan change was applied.</div>}
        {error && <div className="rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-100">{error}</div>}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-gold/15 bg-white/[0.04] text-champagne"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-champagne/45">Current plan</p><p className="mt-2 text-2xl font-semibold capitalize">{data.account.subscriptionPlan.replaceAll('_', ' ')}</p></CardContent></Card>
          <Card className="border-gold/15 bg-white/[0.04] text-champagne"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-champagne/45">Subscription</p><p className="mt-2 text-2xl font-semibold capitalize">{data.account.subscriptionStatus.replaceAll('_', ' ')}</p></CardContent></Card>
          <Card className="border-gold/15 bg-white/[0.04] text-champagne"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-champagne/45">Billing cadence</p><p className="mt-2 text-2xl font-semibold capitalize">{data.account.billingInterval || 'Not set'}</p></CardContent></Card>
          <Card className="border-gold/15 bg-white/[0.04] text-champagne"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.16em] text-champagne/45">Current period ends</p><p className="mt-2 text-2xl font-semibold">{date(data.account.currentPeriodEndsAt)}</p></CardContent></Card>
        </div>

        {!data.stripe.enabled && <div className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-sm text-gold-light">Stripe server credentials are not yet configured in Vercel. The billing interface is installed but cannot create Checkout sessions.</div>}
        {data.stripe.enabled && !data.stripe.webhookConfigured && <div className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-sm text-gold-light">Stripe Checkout is available, but the signed webhook secret must be configured before subscription state can synchronize safely.</div>}

        <Card className="border-gold/20 bg-white/[0.045] text-champagne">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Choose a paid plan</CardTitle>
              <p className="mt-1 text-sm text-champagne/50">Annual billing includes two months free.</p>
            </div>
            <div className="inline-flex rounded-full border border-gold/25 bg-black/15 p-1">
              <button type="button" onClick={() => setInterval('month')} className={`rounded-full px-4 py-2 text-xs font-semibold ${interval === 'month' ? 'bg-gold text-espresso' : 'text-champagne/60'}`}>Monthly</button>
              <button type="button" onClick={() => setInterval('year')} className={`rounded-full px-4 py-2 text-xs font-semibold ${interval === 'year' ? 'bg-gold text-espresso' : 'text-champagne/60'}`}>Annual</button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {paidPlans.map((plan) => {
              const cents = interval === 'year' ? plan.annualCents : plan.monthlyCents
              const monthlyEquivalent = interval === 'year' ? annualMonthlyEquivalent(plan) : null
              const configured = data.stripe.plans[plan.id][interval]
              const workKey = `${plan.id}:${interval}`

              return (
                <div key={plan.id} className="flex flex-col rounded-xl border border-gold/15 bg-black/10 p-5">
                  <p className="text-lg font-semibold">{plan.publicName}</p>
                  <p className="mt-1 text-xs text-gold">{plan.audience}</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="font-serif text-4xl">{formatUsd(cents)}</span>
                    <span className="pb-1 text-xs text-champagne/45">/{interval === 'year' ? 'year' : 'month'}</span>
                  </div>
                  {monthlyEquivalent !== null && <p className="mt-1 text-xs text-champagne/40">{formatUsd(monthlyEquivalent)}/month equivalent.</p>}
                  <p className="mt-4 text-xs leading-5 text-champagne/50">{plan.summary}</p>

                  <div className="mt-auto pt-5">
                    {plan.selfService ? (
                      <Button onClick={() => void openBilling('checkout', plan.id)} disabled={!data.stripe.enabled || !configured || Boolean(working)} className="w-full bg-gold text-espresso hover:bg-gold-light">
                        {working === workKey ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                        {configured ? 'Open Checkout' : `${interval === 'year' ? 'Annual' : 'Monthly'} price not configured`}
                      </Button>
                    ) : (
                      <Button asChild variant="outline" className="w-full border-gold/25 text-gold hover:bg-gold/10">
                        <a href="/register?plan=enterprise">Apply through Wewed</a>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-gold/15 bg-white/[0.035] text-champagne">
          <CardHeader><CardTitle className="text-lg">Existing Stripe subscription</CardTitle></CardHeader>
          <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div><p className="text-sm text-champagne/65">Update payment methods, review invoices, change plans or cancel through Stripe Customer Portal.</p><p className="mt-1 text-xs text-champagne/40">A Stripe customer is created automatically at the first Checkout.</p></div>
            <Button variant="outline" onClick={() => void openBilling('portal')} disabled={!data.stripe.enabled || !data.account.stripeCustomerId || Boolean(working)} className="border-gold/25 text-gold hover:bg-gold/10">{working === 'portal' ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}Open Customer Portal</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
