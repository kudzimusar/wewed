'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  UsersRound,
} from 'lucide-react'
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
    cancelAtPeriodEnd: boolean
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

type AuthPayload = {
  success: boolean
  authorized: boolean
  user?: {
    displayName?: string | null
    email?: string
    role?: string
  } | null
  activeWedding?: {
    id: string
    slug?: string | null
    title?: string | null
    date?: string | null
    venue?: string | null
    venueCity?: string | null
    venueCountry?: string | null
  } | null
}

type WeddingProfile = {
  id: string
  slug: string
  title: string
  date: string
  venue: string | null
  venueCity: string | null
  venueCountry: string | null
  couple: {
    id: string
    slug: string
    partner1: string
    partner2: string
    surname: string | null
  }
}

type WeddingContentPayload = {
  success: boolean
  data?: { wedding?: WeddingProfile }
}

function date(value: string | null | undefined) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function venue(profile: WeddingProfile | null, activeWedding: AuthPayload['activeWedding']) {
  const values = profile
    ? [profile.venue, profile.venueCity, profile.venueCountry]
    : [activeWedding?.venue, activeWedding?.venueCity, activeWedding?.venueCountry]
  return values.filter(Boolean).join(', ') || 'Not set'
}

export function AccountBillingPortal() {
  const searchParams = useSearchParams()
  const checkoutResult = searchParams.get('checkout')
  const autoSyncAttempted = useRef(false)
  const [data, setData] = useState<BillingPayload | null>(null)
  const [auth, setAuth] = useState<AuthPayload | null>(null)
  const [weddingProfile, setWeddingProfile] = useState<WeddingProfile | null>(null)
  const [interval, setInterval] = useState<WewedBillingInterval>('month')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncNotice, setSyncNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [billingResponse, authResponse] = await Promise.all([
        fetch('/api/billing/account', { cache: 'no-store' }),
        fetch('/api/auth/me', { cache: 'no-store' }),
      ])
      const billingPayload = (await billingResponse.json()) as BillingPayload
      if (!billingResponse.ok || !billingPayload.success) {
        throw new Error(billingPayload.error || 'Unable to load billing.')
      }
      setData(billingPayload)
      if (billingPayload.account.billingInterval) {
        setInterval(billingPayload.account.billingInterval)
      }

      if (authResponse.ok) {
        const authPayload = (await authResponse.json()) as AuthPayload
        setAuth(authPayload)
        const slug = authPayload.authorized ? authPayload.activeWedding?.slug : null
        if (slug) {
          const weddingResponse = await fetch(
            `/api/wedding-content?slug=${encodeURIComponent(slug)}`,
            { cache: 'no-store' },
          )
          if (weddingResponse.ok) {
            const weddingPayload = (await weddingResponse.json()) as WeddingContentPayload
            setWeddingProfile(weddingPayload.data?.wedding || null)
          } else {
            setWeddingProfile(null)
          }
        } else {
          setWeddingProfile(null)
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load billing.')
    } finally {
      setLoading(false)
    }
  }, [])

  const synchronize = useCallback(async (silent = false) => {
    setWorking('sync')
    if (!silent) setError(null)
    try {
      const response = await fetch('/api/billing/sync', { method: 'POST' })
      const payload = (await response.json()) as {
        success?: boolean
        error?: string
        subscription?: {
          plan?: string
          status?: string
          cancelAtPeriodEnd?: boolean
        }
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to synchronize Stripe billing.')
      }
      setSyncNotice('Stripe subscription synchronized with this Wewed account.')
      await load()
    } catch (caught) {
      const message = caught instanceof Error
        ? caught.message
        : 'Unable to synchronize Stripe billing.'
      setError(message)
    } finally {
      setWorking(null)
    }
  }, [load])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (
      checkoutResult === 'success' &&
      data?.account.stripeCustomerId &&
      !autoSyncAttempted.current
    ) {
      autoSyncAttempted.current = true
      void synchronize(true)
    }
  }, [checkoutResult, data?.account.stripeCustomerId, synchronize])

  async function openBilling(action: 'checkout' | 'portal', plan?: PaidPlanId) {
    setWorking(plan ? `${plan}:${interval}` : action)
    setError(null)
    setSyncNotice(null)
    try {
      const response = await fetch('/api/billing/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, plan, interval }),
      })
      const payload = (await response.json()) as { success?: boolean; url?: string | null; error?: string }
      if (!response.ok || !payload.success || !payload.url) {
        throw new Error(payload.error || 'Unable to open Stripe.')
      }
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

  const paidPlans = WEWED_PLANS.filter((plan): plan is typeof plan & { id: PaidPlanId } => plan.id !== 'free')
  const activeWedding = auth?.activeWedding || null
  const partners = weddingProfile?.couple
    ? `${weddingProfile.couple.partner1} & ${weddingProfile.couple.partner2}`
    : data.account.name
  const activePlan = data.account.subscriptionPlan !== 'free'
  const currentPlanName = WEWED_PLANS.find(
    (plan) => plan.id === data.account.subscriptionPlan,
  )?.publicName || data.account.subscriptionPlan.replaceAll('_', ' ')

  return (
    <main className="min-h-screen bg-espresso px-5 py-8 text-champagne sm:py-10 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Link href="/planner" className="text-sm text-gold hover:text-gold-light">← Back to couple workspace</Link>
            <p className="mt-5 text-xs uppercase tracking-[0.22em] text-gold">Stripe Billing</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{data.account.name}</h1>
            <p className="mt-2 text-sm text-champagne/55">Manage the Wewed subscription for this active business account.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => data.account.stripeCustomerId
              ? void synchronize(false)
              : void load()}
            disabled={loading || Boolean(working)}
            className="border-gold/25 text-gold hover:bg-gold/10"
          >
            <RefreshCw className={`size-4 ${loading || working === 'sync' ? 'animate-spin' : ''}`} />
            {data.account.stripeCustomerId ? 'Sync & refresh' : 'Refresh'}
          </Button>
        </div>

        <Card className="border-gold/20 bg-white/[0.045] text-champagne">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold">Linked couple profile</p>
              <CardTitle className="mt-2 text-2xl">{partners}</CardTitle>
            </div>
            <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
              Active workspace
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-3 text-sm text-champagne/65 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <UsersRound className="mt-0.5 size-4 text-gold" />
                <div><p className="text-xs uppercase tracking-[0.14em] text-champagne/40">Account owner</p><p className="mt-1">{auth?.user?.displayName || partners}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 size-4 text-gold" />
                <div><p className="text-xs uppercase tracking-[0.14em] text-champagne/40">Wedding</p><p className="mt-1">{weddingProfile?.title || activeWedding?.title || 'Linked wedding workspace'}</p><p className="text-xs text-champagne/40">{date(weddingProfile?.date || activeWedding?.date)}</p></div>
              </div>
              <div className="flex items-start gap-3 sm:col-span-2">
                <MapPin className="mt-0.5 size-4 text-gold" />
                <div><p className="text-xs uppercase tracking-[0.14em] text-champagne/40">Venue</p><p className="mt-1">{venue(weddingProfile, activeWedding)}</p></div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
              <Button asChild className="bg-gold text-espresso hover:bg-gold-light"><Link href="/planner">Open couple workspace</Link></Button>
              <Button asChild variant="outline" className="border-gold/25 text-gold hover:bg-gold/10"><Link href="/">View wedding site</Link></Button>
            </div>
          </CardContent>
        </Card>

        {data.stripe.mode === 'test' && <div className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100"><strong>Stripe Sandbox:</strong> Checkout uses test cards only. Sandbox customer, subscription and webhook state is isolated from live billing and never enters the live revenue ledger.</div>}
        {checkoutResult === 'success' && <div className="flex items-center gap-3 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100"><CheckCircle2 className="size-5" />{activePlan ? 'Stripe Checkout completed and the subscription is synchronized.' : 'Stripe Checkout completed. Wewed is verifying the subscription with Stripe.'}</div>}
        {checkoutResult === 'cancelled' && <div className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-sm text-gold-light">Checkout was cancelled. No plan change was applied.</div>}
        {syncNotice && <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{syncNotice}</div>}
        {error && <div className="rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-100">{error}</div>}
        {data.account.cancelAtPeriodEnd && <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold-light"><strong>Cancellation scheduled:</strong> The subscription remains active through {date(data.account.currentPeriodEndsAt)}. It can be resumed from the Stripe Customer Portal before that date.</div>}

        <Card
          aria-label="Subscription overview"
          className="overflow-hidden border-gold/15 bg-white/[0.04] py-0 text-champagne"
        >
          <CardContent className="p-0">
            <h2 className="sr-only">Subscription overview</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0 border-b border-r border-gold/10 p-4 sm:p-5 lg:border-b-0">
                <p className="text-[10px] uppercase tracking-[0.15em] text-champagne/45 sm:text-xs">Current plan</p>
                <p className="mt-1.5 truncate text-xl font-semibold text-gold sm:text-2xl">{currentPlanName}</p>
              </div>
              <div className="min-w-0 border-b border-gold/10 p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <p className="text-[10px] uppercase tracking-[0.15em] text-champagne/45 sm:text-xs">Subscription</p>
                <p className="mt-1.5 truncate text-xl font-semibold capitalize text-emerald-100 sm:text-2xl">{data.account.subscriptionStatus.replaceAll('_', ' ')}</p>
                {data.account.cancelAtPeriodEnd && <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-gold">Cancels at period end</p>}
              </div>
              <div className="min-w-0 border-r border-gold/10 p-4 sm:p-5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-champagne/45 sm:text-xs">Billing cadence</p>
                <p className="mt-1.5 truncate text-xl font-semibold capitalize sm:text-2xl">{data.account.billingInterval || 'Not set'}</p>
              </div>
              <div className="min-w-0 p-4 sm:p-5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-champagne/45 sm:text-xs">{data.account.cancelAtPeriodEnd ? 'Access ends' : 'Next renewal'}</p>
                <p className="mt-1.5 whitespace-nowrap text-lg font-semibold sm:text-xl">{date(data.account.currentPeriodEndsAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                        <Link href="/register?plan=enterprise">Apply through Wewed</Link>
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
