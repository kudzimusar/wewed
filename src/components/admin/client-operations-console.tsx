'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  CreditCard,
  Database,
  Layers3,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TYPE_LABELS: Record<string, string> = {
  couple: 'Couples',
  planning_company: 'Planning companies',
  venue: 'Venues',
  vendor: 'Vendors',
  client: 'Other business clients',
}

type DepartmentDefinition = {
  departmentKey: string
  accountType: string
  name: string
  description: string
  systemKey: string
  dataPoints: unknown
  resourceTools: unknown
  defaultEnabled: boolean
  sortOrder: number
}

type DepartmentAssignment = {
  businessAccountId: string
  departmentKey: string
  status: string
  version: number
  updatedAt: string
}

type BillingOffer = {
  offerCode: string
  accountType: string
  name: string
  description: string
  billingModel: string
  legacyPlan: string
  currency: string
  monthlyCents: number | null
  annualCents: number | null
  departmentKeys: unknown
  entitlements: unknown
  selfService: boolean
  status: string
  version: number
}

type ClientAccount = {
  id: string
  name: string
  slug: string
  type: string
  status: string
  onboardingStatus: string
  subscriptionPlan: string
  subscriptionStatus: string
  billingOfferCode: string | null
  billingOfferName: string | null
  billingModel: string | null
  billingInterval: string | null
  billingProfileStatus: string | null
  billingProfileSource: string | null
  currentPeriodEndsAt: string | null
  departments: DepartmentAssignment[]
}

type Payload = {
  success: boolean
  error?: string
  admin: {
    userId: string
    email: string
    role: string
    permissions: string[]
    canManageDepartments: boolean
  }
  definitions: DepartmentDefinition[]
  offers: BillingOffer[]
  accounts: ClientAccount[]
}

function values(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function label(value: string): string {
  const normalized = value.replaceAll('_', ' ').trim()
  if (!normalized) return 'Not set'
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
}

function formatMoney(cents: number | null, currency: string): string {
  if (cents === null) return 'Contract'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function date(value: string | null): string {
  if (!value) return 'Not set'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? 'Not set'
    : parsed.toLocaleDateString()
}

function AccountOperationsCard({
  account,
  definitions,
  offers,
  canManage,
  working,
  onSave,
}: {
  account: ClientAccount
  definitions: DepartmentDefinition[]
  offers: BillingOffer[]
  canManage: boolean
  working: boolean
  onSave: (
    account: ClientAccount,
    departmentKeys: string[],
    reason: string,
  ) => Promise<void>
}) {
  const accountDefinitions = definitions.filter(
    (definition) => definition.accountType === account.type,
  )
  const enabledAtLoad = account.departments
    .filter((assignment) => assignment.status === 'enabled')
    .map((assignment) => assignment.departmentKey)
  const [selected, setSelected] = useState<string[]>(enabledAtLoad)
  const [reason, setReason] = useState('')
  const offer = offers.find(
    (candidate) => candidate.offerCode === account.billingOfferCode,
  )

  useEffect(() => {
    setSelected(enabledAtLoad)
  }, [account.id, account.departments])

  function toggle(departmentKey: string) {
    setSelected((current) =>
      current.includes(departmentKey)
        ? current.filter((value) => value !== departmentKey)
        : [...current, departmentKey],
    )
  }

  const changed =
    [...selected].sort().join('|') !== [...enabledAtLoad].sort().join('|')

  return (
    <Card className="border-gold/15 bg-white/[0.03] text-champagne">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold">
              {TYPE_LABELS[account.type] || label(account.type)}
            </p>
            <CardTitle className="mt-2 text-xl">{account.name}</CardTitle>
            <p className="mt-1 text-xs text-champagne/40">{account.slug}</p>
          </div>
          <div className="rounded-xl border border-gold/15 bg-black/15 p-3 text-xs leading-5 text-champagne/55 lg:min-w-[290px]">
            <p className="font-semibold text-champagne">
              {offer?.name || account.billingOfferName || 'Billing profile pending'}
            </p>
            <p>
              Model: {label(offer?.billingModel || account.billingModel || 'legacy')}
              {' · '}Status:{' '}
              {label(account.billingProfileStatus || account.subscriptionStatus)}
            </p>
            <p>
              Cadence: {label(account.billingInterval || 'not_set')}
              {' · '}Period end: {date(account.currentPeriodEndsAt)}
            </p>
            <p className="text-champagne/40">
              Compatibility mirror: {label(account.subscriptionPlan)}
              {' · '}Source: {label(account.billingProfileSource || 'compatibility')}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accountDefinitions.map((definition) => {
            const enabled = selected.includes(definition.departmentKey)
            return (
              <label
                key={definition.departmentKey}
                className={`rounded-xl border p-4 transition ${
                  enabled
                    ? 'border-gold/40 bg-gold/10'
                    : 'border-gold/10 bg-black/10'
                } ${canManage ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={!canManage || working}
                    onChange={() => toggle(definition.departmentKey)}
                    className="mt-1 accent-[#BF9B5F]"
                  />
                  <div>
                    <p className="font-semibold">{definition.name}</p>
                    <p className="mt-1 text-[11px] text-gold">
                      System: {label(definition.systemKey)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-champagne/50">
                  {definition.description}
                </p>
                <div className="mt-3 space-y-2 text-[11px] leading-5 text-champagne/45">
                  <p>
                    <Database className="mr-1 inline size-3.5 text-gold" />
                    {values(definition.dataPoints).map(label).join(', ')}
                  </p>
                  <p>
                    <Wrench className="mr-1 inline size-3.5 text-gold" />
                    {values(definition.resourceTools).map(label).join(', ')}
                  </p>
                </div>
              </label>
            )
          })}
        </div>

        {canManage && (
          <div className="mt-4 grid gap-3 rounded-xl border border-gold/15 bg-black/15 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="text-xs text-champagne/50">
              Required reason for changing enabled departments
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain the account-specific operational requirement."
                className="mt-1 min-h-20 w-full rounded-md border border-gold/20 bg-espresso px-3 py-2 text-sm text-champagne"
              />
            </label>
            <Button
              type="button"
              disabled={
                working ||
                !changed ||
                selected.length === 0 ||
                reason.trim().length < 5
              }
              onClick={() => void onSave(account, selected, reason.trim())}
              className="bg-gold text-espresso hover:bg-gold-light"
            >
              {working ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save department set
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ClientOperationsConsole() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [workingAccountId, setWorkingAccountId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [category, setCategory] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/client-operations', {
        cache: 'no-store',
      })
      const payload = (await response.json()) as Payload
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load client operations.')
      }
      setData(payload)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load client operations.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveDepartments(
    account: ClientAccount,
    departmentKeys: string[],
    reason: string,
  ) {
    setWorkingAccountId(account.id)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/admin/client-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replace_account_departments',
          accountId: account.id,
          departmentKeys,
          reason,
        }),
      })
      const payload = (await response.json()) as {
        success?: boolean
        error?: string
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to save account departments.')
      }
      setNotice(`${account.name} department set was updated and audited.`)
      await load()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to save account departments.',
      )
    } finally {
      setWorkingAccountId(null)
    }
  }

  const filteredAccounts = useMemo(
    () =>
      data?.accounts.filter(
        (account) => category === 'all' || account.type === category,
      ) || [],
    [category, data],
  )

  if (loading && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-espresso text-gold">
        <Loader2 className="size-8 animate-spin" />
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-espresso p-6 text-champagne">
        <Card className="max-w-lg border-rose-300/25 bg-white/[0.04] text-champagne">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto size-10 text-gold" />
            <h1 className="mt-4 text-2xl font-semibold">
              Client systems unavailable
            </h1>
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

  const categories = Array.from(
    new Set(data.accounts.map((account) => account.type)),
  )

  return (
    <main className="min-h-screen bg-espresso px-5 py-24 text-champagne lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-gold">
              Client operations · private data loop
            </p>
            <h1 className="mt-2 text-4xl font-semibold">
              Departments, systems, and billing
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-champagne/55">
              Review the exact systems, data points, resource tools, and
              account-specific billing offer assigned to each client category.
              Department changes are scope-checked, non-destructive, reasoned,
              and audited.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading || Boolean(workingAccountId)}
            className="border-gold/25 text-gold hover:bg-gold/10"
          >
            <RefreshCw
              className={`size-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>

        {!data.admin.canManageDepartments && (
          <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm text-champagne/60">
            <ShieldCheck className="mr-2 inline size-4 text-gold" />
            Your role can review client systems and billing assignments but
            cannot alter department sets.
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100">
            <CheckCircle2 className="size-4" /> {notice}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`rounded-full border px-4 py-2 text-xs font-semibold ${
              category === 'all'
                ? 'border-gold bg-gold text-espresso'
                : 'border-gold/20 text-gold'
            }`}
          >
            All categories ({data.accounts.length})
          </button>
          {categories.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCategory(type)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                category === type
                  ? 'border-gold bg-gold text-espresso'
                  : 'border-gold/20 text-gold'
              }`}
            >
              {TYPE_LABELS[type] || label(type)} (
              {data.accounts.filter((account) => account.type === type).length})
            </button>
          ))}
        </div>

        <Card className="border-gold/15 bg-white/[0.03] text-champagne">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5 text-gold" /> Segmented offer catalog
            </CardTitle>
            <p className="text-sm text-champagne/50">
              Prices are isolated by audience. Vendor, venue, and custom-client
              paid services remain contract-only until dedicated Stripe prices
              are approved.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.offers.map((offer) => (
              <div
                key={offer.offerCode}
                className="rounded-xl border border-gold/12 bg-black/10 p-4"
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-gold">
                  {TYPE_LABELS[offer.accountType] || label(offer.accountType)}
                </p>
                <p className="mt-1 font-semibold">{offer.name}</p>
                <p className="mt-2 text-xs leading-5 text-champagne/50">
                  {offer.description}
                </p>
                <p className="mt-3 text-xs text-champagne/60">
                  {formatMoney(offer.monthlyCents, offer.currency)} monthly
                  {' · '}
                  {formatMoney(offer.annualCents, offer.currency)} annual
                </p>
                <p className="mt-1 text-[11px] text-champagne/40">
                  {label(offer.billingModel)} · Legacy mirror:{' '}
                  {label(offer.legacyPlan)} ·{' '}
                  {offer.selfService ? 'Self-service' : 'Internal/contract'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredAccounts.map((account) => (
            <AccountOperationsCard
              key={account.id}
              account={account}
              definitions={data.definitions}
              offers={data.offers}
              canManage={data.admin.canManageDepartments}
              working={workingAccountId === account.id}
              onSave={saveDepartments}
            />
          ))}
        </div>

        {!filteredAccounts.length && (
          <div className="rounded-xl border border-dashed border-gold/20 p-10 text-center text-sm text-champagne/40">
            <Layers3 className="mx-auto mb-3 size-8 text-gold/60" />
            No scoped accounts are available in this category.
          </div>
        )}
      </div>
    </main>
  )
}
