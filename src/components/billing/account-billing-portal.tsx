'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  CreditCard,
  Database,
  ExternalLink,
  Layers3,
  Loader2,
  RefreshCw,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  annualMonthlyEquivalent,
  formatUsd,
  type WewedBillingInterval,
  type WewedBillingOffer,
  type WewedBillingOfferCode,
} from '@/lib/wewed-plans'

type Department = {
  departmentKey: string
  name: string
  description: string
  systemKey: string
  dataPoints: unknown
  resourceTools: unknown
  status: string
}

type BillingPayload = {
  success: boolean
  error?: string
  account: {
    id: string
    name: string
    type: string
    status: string
    onboardingStatus: string
    billingOfferCode: WewedBillingOfferCode
    billingOfferName: string
    billingModel: 'free' | 'subscription' | 'contract'
    subscriptionPlan: string
    subscriptionStatus: string
    currentPeriodEndsAt: string | null
    cancelAtPeriodEnd: boolean
    memberRole: string
    stripeCustomerId: string | null
    billingInterval: WewedBillingInterval | null
    billingProfileSource: string | null
  }
  departments: Department[]
  offers: WewedBillingOffer[]
  stripe: {
    mode: 'test' | 'live'
    enabled: boolean
    webhookConfigured: boolean
    offers: Record<
      string,
      {
        accountType: string
        selfService: boolean
        month: boolean
        year: boolean
      }
    >
  }
}

function date(value: string | null | undefined): string {
  if (!value) return 'Not set'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not set'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(parsed)
}

function statusLabel(value: string): string {
  const normalized = value.replaceAll('_', ' ').trim()
  if (!normalized) return 'Not set'
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
}

function values(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function accountTypeLabel(value: string): string {
  if (value === 'couple') return 'Couple account'
  if (value === 'planning_company') return 'Planning company'
  if (value === 'venue') return 'Venue account'
  if (value === 'vendor') return 'Vendor account'
  if (value === 'client') return 'Business client'
  return statusLabel(value)
}

export function AccountBillingPortal() {
  const searchParams = useSearchParams()
  const checkoutResult = searchParams.get('checkout')
  const autoSyncAttempted = useRef(false)
  const [data, setData] = useState<BillingPayload | null>(null)
  const [interval, setInterval] =
    useState<WewedBillingInterval>('month')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncNotice, setSyncNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/billing/account', {
        cache: 'no-store',
      })
      const payload = (await response.json()) as BillingPayload
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load billing.')
      }
      setData(payload)
      if (payload.account.billingInterval) {
        setInterval(payload.account.billingInterval)
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to load billing.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const synchronize = useCallback(
    async (silent = false) => {
      setWorking('sync')
      if (!silent) setError(null)
      try {
        const response = await fetch('/api/billing/sync', {
          method: 'POST',
        })
        const payload = (await response.json()) as {
          success?: boolean
          error?: string
        }
        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error || 'Unable to synchronize Stripe billing.',
          )
        }
        setSyncNotice(
          'Stripe subscription synchronized with this account and offer.',
        )
        await load()
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to synchronize Stripe billing.',
        )
      } finally {
        setWorking(null)
      }
    },
    [load],
  )

  useEffect(() => {
    void load()
  }, [load])

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

  async function openBilling(
    action: 'checkout' | 'portal',
    offerCode?: WewedBillingOfferCode,
  ) {
    setWorking(offerCode ? `${offerCode}:${interval}` : action)
    setError(null)
    setSyncNotice(null)
    try {
      const response = await fetch('/api/billing/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, offerCode, interval }),
      })
      const payload = (await response.json()) as {
        success?: boolean
        url?: string | null
        error?: string
      }
      if (!response.ok || !payload.success || !payload.url) {
        throw new Error(payload.error || 'Unable to open Stripe.')
      }
      window.location.assign(payload.url)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to open Stripe.',
      )
      setWorking(null)
    }
  }

  if (loading && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-espresso text-champagne">
        <Loader2 className="size-8 animate-spin text-gold" />
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-espresso p-6 text-champagne">
        <Card className="max-w-lg border-red-300/25 bg-white/[0.04] text-champagne">
          <CardContent className="p-8 text-center">
            <CreditCard className="mx-auto size-10 text-gold" />
            <h1 className="mt-4 text-2xl font-semibold">Billing unavailable</h1>
            <p className="mt-3 text-sm text-champagne/60">{error}</p>
            <Button
              onClick={() => void load()}
              className="mt-6 bg-gold text-espresso hover:bg-gold-light"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  const activeOffer = data.offers.find(
    (offer) => offer.code === data.account.billingOfferCode,
  )
  const cancellationScheduled = data.account.cancelAtPeriodEnd
  const subscriptionStatusLabel = cancellationScheduled
    ? `${statusLabel(data.account.subscriptionStatus)} — cancellation scheduled`
    : statusLabel(data.account.subscriptionStatus)
  const enabledDepartments = data.departments.filter(
    (department) => department.status === 'enabled',
  )

  return (
    <main className="min-h-screen bg-espresso px-5 py-8 text-champagne sm:py-10 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Link
              href="/"
              className="text-sm text-gold hover:text-gold-light"
            >
              ← Back to Wewed
            </Link>
            <p className="mt-5 text-xs uppercase tracking-[0.22em] text-gold">
              {accountTypeLabel(data.account.type)} · segmented billing
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              {data.account.name}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-champagne/55">
              Offers, systems, data points, and resources below are restricted to
              this account category. Other customer categories are never shown as
              interchangeable plans.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              data.account.stripeCustomerId
                ? void synchronize(false)
                : void load()
            }
            disabled={loading || Boolean(working)}
            className="border-gold/25 text-gold hover:bg-gold/10"
          >
            <RefreshCw
              className={`size-4 ${
                loading || working === 'sync' ? 'animate-spin' : ''
              }`}
            />
            {data.account.stripeCustomerId ? 'Sync & refresh' : 'Refresh'}
          </Button>
        </div>

        {data.stripe.mode === 'test' && (
          <div className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
            <strong>Stripe Sandbox:</strong> test customer and subscription state
            stays in environment-prefixed metadata and never enters the live
            revenue ledger or authoritative live billing profile.
          </div>
        )}
        {checkoutResult === 'success' && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="size-5" /> Stripe Checkout completed. Wewed
            is verifying the account category and offer with Stripe.
          </div>
        )}
        {checkoutResult === 'cancelled' && (
          <div className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-sm text-gold-light">
            Checkout was cancelled. No offer or billing-profile change was
            applied.
          </div>
        )}
        {syncNotice && (
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
            {syncNotice}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}
        {cancellationScheduled && (
          <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold-light">
            <strong>Cancellation scheduled:</strong>{' '}
            {data.account.billingOfferName} remains active until{' '}
            {date(data.account.currentPeriodEndsAt)} and will not renew.
          </div>
        )}

        <Card
          aria-label="Subscription overview"
          className="overflow-hidden border-gold/15 bg-white/[0.04] py-0 text-champagne"
        >
          <CardContent className="p-0">
            <div className="grid grid-cols-2 lg:grid-cols-4">
              <div className="border-b border-r border-gold/10 p-4 sm:p-5 lg:border-b-0">
                <p className="text-[10px] uppercase tracking-[0.15em] text-champagne/45 sm:text-xs">
                  Current offer
                </p>
                <p className="mt-1.5 text-xl font-semibold text-gold sm:text-2xl">
                  {data.account.billingOfferName}
                </p>
              </div>
              <div className="border-b border-gold/10 p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <p className="text-[10px] uppercase tracking-[0.15em] text-champagne/45 sm:text-xs">
                  Billing model
                </p>
                <p className="mt-1.5 text-xl font-semibold capitalize sm:text-2xl">
                  {data.account.billingModel}
                </p>
              </div>
              <div className="border-r border-gold/10 p-4 sm:p-5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-champagne/45 sm:text-xs">
                  Subscription
                </p>
                <p className="mt-1.5 text-lg font-semibold text-emerald-100">
                  {subscriptionStatusLabel}
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-champagne/45 sm:text-xs">
                  {cancellationScheduled ? 'Access until' : 'Next renewal'}
                </p>
                <p className="mt-1.5 text-lg font-semibold">
                  {date(data.account.currentPeriodEndsAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gold/20 bg-white/[0.045] text-champagne">
          <CardHeader>
            <CardTitle className="text-xl">
              Your departments, systems, and resources
            </CardTitle>
            <p className="text-sm text-champagne/50">
              {enabledDepartments.length} operational area
              {enabledDepartments.length === 1 ? '' : 's'} enabled for this{' '}
              {accountTypeLabel(data.account.type).toLowerCase()}.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {enabledDepartments.map((department) => {
              const dataPoints = values(department.dataPoints)
              const tools = values(department.resourceTools)
              return (
                <div
                  key={department.departmentKey}
                  className="rounded-xl border border-gold/15 bg-black/10 p-5"
                >
                  <div className="flex items-start gap-3">
                    <Layers3 className="mt-0.5 size-5 text-gold" />
                    <div>
                      <p className="font-semibold">{department.name}</p>
                      <p className="mt-1 text-xs text-gold">
                        System: {statusLabel(department.systemKey)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-champagne/50">
                    {department.description}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-champagne/40">
                        <Database className="size-3.5" /> Data points
                      </p>
                      <p className="mt-1 text-xs leading-5 text-champagne/60">
                        {dataPoints.map(statusLabel).join(', ')}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-champagne/40">
                        <Wrench className="size-3.5" /> Resource tools
                      </p>
                      <p className="mt-1 text-xs leading-5 text-champagne/60">
                        {tools.map(statusLabel).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {!data.stripe.enabled && (
          <div className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-sm text-gold-light">
            Stripe server credentials are not configured in this environment.
            No Checkout session can be created.
          </div>
        )}
        {data.stripe.enabled && !data.stripe.webhookConfigured && (
          <div className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-3 text-sm text-gold-light">
            Stripe Checkout is present, but the signed webhook secret must be
            configured before subscription state can synchronize safely.
          </div>
        )}

        <Card className="border-gold/20 bg-white/[0.045] text-champagne">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">
                Offers for {accountTypeLabel(data.account.type)}
              </CardTitle>
              <p className="mt-1 text-sm text-champagne/50">
                Only category-compatible offers are available.
              </p>
            </div>
            <div className="inline-flex rounded-full border border-gold/25 bg-black/15 p-1">
              <button
                type="button"
                onClick={() => setInterval('month')}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  interval === 'month'
                    ? 'bg-gold text-espresso'
                    : 'text-champagne/60'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setInterval('year')}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  interval === 'year'
                    ? 'bg-gold text-espresso'
                    : 'text-champagne/60'
                }`}
              >
                Annual
              </button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.offers.map((offer) => {
              const cents =
                interval === 'year'
                  ? offer.annualCents
                  : offer.monthlyCents
              const monthlyEquivalent =
                interval === 'year'
                  ? annualMonthlyEquivalent(offer)
                  : null
              const stripeOffer = data.stripe.offers[offer.code]
              const configured = Boolean(stripeOffer?.[interval])
              const workKey = `${offer.code}:${interval}`
              const isCurrent = offer.code === data.account.billingOfferCode

              return (
                <div
                  key={offer.code}
                  className="flex flex-col rounded-xl border border-gold/15 bg-black/10 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">
                        {offer.publicName}
                      </p>
                      <p className="mt-1 text-xs text-gold">
                        {offer.audience}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-emerald-100">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="font-serif text-4xl">
                      {formatUsd(cents)}
                    </span>
                    {cents !== null && cents > 0 && (
                      <span className="pb-1 text-xs text-champagne/45">
                        /{interval === 'year' ? 'year' : 'month'}
                      </span>
                    )}
                  </div>
                  {monthlyEquivalent !== null && monthlyEquivalent > 0 && (
                    <p className="mt-1 text-xs text-champagne/40">
                      {formatUsd(monthlyEquivalent)}/month equivalent.
                    </p>
                  )}
                  <p className="mt-4 text-xs leading-5 text-champagne/50">
                    {offer.summary}
                  </p>
                  <ul className="mt-4 space-y-1 text-xs text-champagne/55">
                    {offer.features.map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-5">
                    {offer.selfService ? (
                      <Button
                        onClick={() =>
                          void openBilling('checkout', offer.code)
                        }
                        disabled={
                          isCurrent ||
                          !data.stripe.enabled ||
                          !configured ||
                          Boolean(working)
                        }
                        className="w-full bg-gold text-espresso hover:bg-gold-light"
                      >
                        {working === workKey ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CreditCard className="size-4" />
                        )}
                        {isCurrent
                          ? 'Current offer'
                          : configured
                            ? 'Open Checkout'
                            : `${
                                interval === 'year' ? 'Annual' : 'Monthly'
                              } price not configured`}
                      </Button>
                    ) : offer.billingModel === 'contract' ? (
                      <Button
                        asChild
                        variant="outline"
                        className="w-full border-gold/25 text-gold hover:bg-gold/10"
                      >
                        <Link href="/register?plan=enterprise">
                          Apply through Wewed
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        disabled
                        variant="outline"
                        className="w-full border-gold/20 text-champagne/45"
                      >
                        Included foundation
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-gold/15 bg-white/[0.035] text-champagne">
          <CardHeader>
            <CardTitle className="text-lg">
              Existing Stripe subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-champagne/65">
                Review invoices, payment methods, renewal, or cancellation through
                Stripe Customer Portal.
              </p>
              <p className="mt-1 text-xs text-champagne/40">
                Current offer: {activeOffer?.publicName || data.account.billingOfferName}
                {' · '}Profile source:{' '}
                {data.account.billingProfileSource || 'compatibility'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void openBilling('portal')}
              disabled={
                !data.stripe.enabled ||
                !data.account.stripeCustomerId ||
                Boolean(working)
              }
              className="border-gold/25 text-gold hover:bg-gold/10"
            >
              {working === 'portal' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              Open Customer Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
