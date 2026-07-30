'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Building2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Heart,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { logoutAdmin } from '@/lib/admin-auth'

type Summary = {
  businessAccounts: number
  activeAccounts: number
  couples: number
  weddings: number
  planners: number
  venues: number
  vendors: number
  activeSubscriptions: number
  openSupportCases: number
  openIncidents: number
  paidRevenueCents: number
  pendingRevenueCents: number
}

type BusinessAccount = {
  id: string
  name: string
  slug: string
  type: string
  status: string
  ownerUserId: string | null
  ownerEmail: string | null
  onboardingStatus: string
  subscriptionPlan: string
  subscriptionStatus: string
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
  notes: string | null
  memberCount: number
  weddingCount: number
  createdAt: string
  updatedAt: string
}

type SupportCase = {
  id: string
  businessAccountId: string | null
  businessAccountName: string | null
  title: string
  description: string | null
  category: string
  priority: string
  status: string
  requesterEmail: string | null
  createdAt: string
  updatedAt: string
}

type Incident = {
  id: string
  title: string
  summary: string | null
  status: string
  severity: string
  startedAt: string
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

type Payment = {
  id: string
  businessAccountId: string
  businessAccountName: string
  provider: string
  providerReference: string | null
  type: string
  amountCents: number
  currency: string
  status: string
  dueAt: string | null
  paidAt: string | null
  createdAt: string
}

type AuditRow = {
  id: string
  action: string
  resourceType: string
  resourceId: string | null
  businessAccountName: string | null
  actorEmail: string | null
  details: Record<string, unknown>
  createdAt: string
}

type AdminPayload = {
  success: boolean
  error?: string
  admin: { email: string; role: string }
  summary: Summary
  accounts: BusinessAccount[]
  supportCases: SupportCase[]
  incidents: Incident[]
  payments: Payment[]
  auditLog: AuditRow[]
}

type Section = 'dashboard' | 'accounts' | 'billing' | 'support' | 'operations'

const accountTypeLabels: Record<string, string> = {
  wewed_internal: 'Wewed internal',
  planning_company: 'Planning company',
  couple: 'Couple / client',
  venue: 'Venue',
  vendor: 'Vendor',
  client: 'Business client',
}

function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format((Number(cents) || 0) / 100)
}

function date(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusClass(value: string) {
  if (['active', 'paid', 'resolved', 'complete', 'free'].includes(value)) {
    return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
  }
  if (['suspended', 'failed', 'cancelled', 'urgent', 'major', 'critical'].includes(value)) {
    return 'border-red-300/30 bg-red-300/10 text-red-100'
  }
  return 'border-gold/30 bg-gold/10 text-gold-light'
}

function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusClass(value)}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string | number
  detail: string
  icon: typeof Building2
}) {
  return (
    <Card className="border-gold/15 bg-white/[0.04] text-champagne shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-champagne/50">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-champagne">{value}</p>
            <p className="mt-1 text-xs text-champagne/45">{detail}</p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-gold/10 p-2.5 text-gold">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function WewedAdminConsole() {
  const [data, setData] = useState<AdminPayload | null>(null)
  const [section, setSection] = useState<Section>('dashboard')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/overview', { cache: 'no-store' })
      const payload = (await response.json()) as AdminPayload
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load the Wewed Admin Console.')
      }
      setData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load admin data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(payload: Record<string, unknown>, successMessage: string) {
    setWorking(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch('/api/admin/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'The admin action failed.')
      }
      setNotice(successMessage)
      await load()
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The admin action failed.')
      return false
    } finally {
      setWorking(false)
    }
  }

  const filteredAccounts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return (data?.accounts ?? []).filter((account) => {
      const matchesType = typeFilter === 'all' || account.type === typeFilter
      const matchesQuery =
        !normalized ||
        account.name.toLowerCase().includes(normalized) ||
        account.slug.toLowerCase().includes(normalized) ||
        account.ownerEmail?.toLowerCase().includes(normalized)
      return matchesType && matchesQuery
    })
  }, [data?.accounts, query, typeFilter])

  function signOut() {
    logoutAdmin()
    window.location.assign('/')
  }

  if (loading && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-espresso text-champagne">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-gold" />
          <p className="mt-4 text-sm text-champagne/60">Loading Wewed business operations…</p>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-espresso p-6 text-champagne">
        <Card className="w-full max-w-lg border-red-300/20 bg-white/[0.04] text-champagne">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto size-10 text-gold" />
            <h1 className="mt-4 text-2xl font-semibold">Wewed administrator access required</h1>
            <p className="mt-3 text-sm text-champagne/60">{error}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => void load()} className="bg-gold text-espresso hover:bg-gold-light">
                Retry
              </Button>
              <Button variant="outline" onClick={signOut} className="border-gold/30 text-gold hover:bg-gold/10">
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  const nav: Array<{ id: Section; label: string; icon: typeof Building2 }> = [
    { id: 'dashboard', label: 'Dashboard', icon: ClipboardList },
    { id: 'accounts', label: 'Business accounts', icon: Building2 },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'support', label: 'Support', icon: Users },
    { id: 'operations', label: 'Operations', icon: AlertTriangle },
  ]

  return (
    <main className="min-h-screen bg-espresso text-champagne">
      <header className="sticky top-0 z-30 border-b border-gold/15 bg-espresso/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-gold">Wewed parent company</p>
              <h1 className="text-xl font-semibold">Business Admin Console</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-champagne/45">Signed in as</p>
              <p className="text-sm text-champagne/80">{data.admin.email}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void load()}
              disabled={loading || working}
              className="border-gold/25 text-gold hover:bg-gold/10"
              aria-label="Refresh admin data"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={signOut}
              className="border-gold/25 text-gold hover:bg-gold/10"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-5 py-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-2xl border border-gold/15 bg-white/[0.035] p-3 lg:sticky lg:top-24">
          <nav className="grid gap-1 sm:grid-cols-5 lg:grid-cols-1">
            {nav.map((item) => {
              const Icon = item.icon
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                    active
                      ? 'bg-gold text-espresso'
                      : 'text-champagne/65 hover:bg-white/[0.05] hover:text-champagne'
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
          <div className="mt-4 hidden rounded-xl border border-gold/10 bg-black/10 p-4 lg:block">
            <p className="text-[10px] uppercase tracking-[0.18em] text-champagne/40">Hierarchy</p>
            <p className="mt-2 text-xs leading-5 text-champagne/60">
              Wewed → Business account → Team → Couples, weddings, venues and vendors
            </p>
          </div>
        </aside>

        <section className="min-w-0 space-y-6">
          {(error || notice) && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                error
                  ? 'border-red-300/25 bg-red-300/10 text-red-100'
                  : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
              }`}
            >
              {error || notice}
            </div>
          )}

          {section === 'dashboard' && (
            <>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold">Company overview</p>
                <h2 className="mt-2 text-3xl font-semibold">Wewed business operations</h2>
                <p className="mt-2 max-w-3xl text-sm text-champagne/55">
                  Global visibility across planning companies, couples, venues, vendors, billing and support.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Business accounts" value={data.summary.businessAccounts} detail={`${data.summary.activeAccounts} active`} icon={Building2} />
                <SummaryCard label="Couples" value={data.summary.couples} detail={`${data.summary.weddings} weddings`} icon={Heart} />
                <SummaryCard label="Planners" value={data.summary.planners} detail="Active platform planner users" icon={Users} />
                <SummaryCard label="Venues & vendors" value={data.summary.venues + data.summary.vendors} detail={`${data.summary.venues} venues · ${data.summary.vendors} vendors`} icon={Store} />
                <SummaryCard label="Subscriptions" value={data.summary.activeSubscriptions} detail="Active or trialing accounts" icon={CreditCard} />
                <SummaryCard label="Paid revenue" value={money(data.summary.paidRevenueCents)} detail="Recorded payments" icon={CircleDollarSign} />
                <SummaryCard label="Open support" value={data.summary.openSupportCases} detail="Cases requiring attention" icon={ClipboardList} />
                <SummaryCard label="Open incidents" value={data.summary.openIncidents} detail="Platform operations" icon={AlertTriangle} />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="border-gold/15 bg-white/[0.035] text-champagne">
                  <CardHeader>
                    <CardTitle className="text-lg">Account mix</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(
                      data.accounts.reduce<Record<string, number>>((totals, account) => {
                        if (account.type !== 'wewed_internal') totals[account.type] = (totals[account.type] || 0) + 1
                        return totals
                      }, {}),
                    ).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between rounded-xl border border-gold/10 bg-black/10 px-4 py-3">
                        <span className="text-sm text-champagne/70">{accountTypeLabels[type] || type}</span>
                        <span className="text-lg font-semibold">{count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-gold/15 bg-white/[0.035] text-champagne">
                  <CardHeader>
                    <CardTitle className="text-lg">Recent company activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.auditLog.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-gold/20 p-5 text-sm text-champagne/45">
                        Admin changes will appear here.
                      </p>
                    ) : (
                      data.auditLog.slice(0, 8).map((row) => (
                        <div key={row.id} className="border-b border-gold/10 pb-3 last:border-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-champagne/80">{row.action.replaceAll('_', ' ')}</p>
                              <p className="mt-1 text-xs text-champagne/40">
                                {row.businessAccountName || row.resourceType} · {row.actorEmail || 'System'}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] text-champagne/35">{date(row.createdAt)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {section === 'accounts' && (
            <AccountsSection
              accounts={filteredAccounts}
              allAccounts={data.accounts}
              query={query}
              typeFilter={typeFilter}
              working={working}
              onQuery={setQuery}
              onTypeFilter={setTypeFilter}
              onAction={act}
            />
          )}

          {section === 'billing' && (
            <BillingSection accounts={data.accounts} payments={data.payments} summary={data.summary} working={working} onAction={act} />
          )}

          {section === 'support' && (
            <SupportSection accounts={data.accounts} cases={data.supportCases} working={working} onAction={act} />
          )}

          {section === 'operations' && (
            <OperationsSection incidents={data.incidents} working={working} onAction={act} />
          )}
        </section>
      </div>
    </main>
  )
}

function AccountsSection({
  accounts,
  allAccounts,
  query,
  typeFilter,
  working,
  onQuery,
  onTypeFilter,
  onAction,
}: {
  accounts: BusinessAccount[]
  allAccounts: BusinessAccount[]
  query: string
  typeFilter: string
  working: boolean
  onQuery: (value: string) => void
  onTypeFilter: (value: string) => void
  onAction: (payload: Record<string, unknown>, message: string) => Promise<boolean>
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('planning_company')
  const [plan, setPlan] = useState('free')
  const [notes, setNotes] = useState('')

  async function create(event: FormEvent) {
    event.preventDefault()
    const ok = await onAction(
      { action: 'create_account', name, type, subscriptionPlan: plan, notes },
      `${name} was added to Wewed onboarding.`,
    )
    if (ok) {
      setName('')
      setNotes('')
      setShowCreate(false)
    }
  }

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Client registry</p>
          <h2 className="mt-2 text-3xl font-semibold">Business accounts</h2>
          <p className="mt-2 text-sm text-champagne/55">{allAccounts.length} total accounts, including the Wewed parent account.</p>
        </div>
        <Button onClick={() => setShowCreate((value) => !value)} className="bg-gold text-espresso hover:bg-gold-light">
          <Plus className="size-4" />
          Onboard business
        </Button>
      </div>

      {showCreate && (
        <Card className="border-gold/20 bg-white/[0.045] text-champagne">
          <CardHeader><CardTitle className="text-lg">Start business onboarding</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Business name" required className="border-gold/20 bg-black/15" />
              <select value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
                <option value="planning_company">Planning company</option>
                <option value="couple">Couple / client</option>
                <option value="venue">Venue</option>
                <option value="vendor">Vendor</option>
                <option value="client">Other business client</option>
              </select>
              <select value={plan} onChange={(event) => setPlan(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Onboarding notes" className="border-gold/20 bg-black/15" />
              <div className="md:col-span-2 xl:col-span-4 flex justify-end">
                <Button type="submit" disabled={working || !name.trim()} className="bg-gold text-espresso hover:bg-gold-light">
                  {working ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Create account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" />
          <Input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search account, slug or owner email" className="border-gold/20 bg-white/[0.035] pl-10" />
        </div>
        <select value={typeFilter} onChange={(event) => onTypeFilter(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
          <option value="all">All account types</option>
          <option value="planning_company">Planning companies</option>
          <option value="couple">Couples</option>
          <option value="venue">Venues</option>
          <option value="vendor">Vendors</option>
          <option value="wewed_internal">Wewed internal</option>
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {accounts.map((account) => (
          <Card key={account.id} className="border-gold/15 bg-white/[0.035] text-champagne">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{account.name}</p>
                  <p className="mt-1 text-xs text-champagne/40">{accountTypeLabels[account.type] || account.type} · {account.slug}</p>
                </div>
                <Status value={account.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gold/10 bg-black/10 p-3">
                  <p className="text-xs text-champagne/40">Team members</p>
                  <p className="mt-1 text-xl font-semibold">{account.memberCount}</p>
                </div>
                <div className="rounded-xl border border-gold/10 bg-black/10 p-3">
                  <p className="text-xs text-champagne/40">Linked weddings</p>
                  <p className="mt-1 text-xl font-semibold">{account.weddingCount}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-champagne/45">
                  Account status
                  <select
                    value={account.status}
                    disabled={working || account.type === 'wewed_internal'}
                    onChange={(event) => void onAction({ action: 'update_account', id: account.id, status: event.target.value }, `${account.name} status updated.`)}
                    className="mt-1 h-9 w-full rounded-md border border-gold/20 bg-espresso px-2 text-sm text-champagne"
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="suspended">Suspended</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="text-xs text-champagne/45">
                  Onboarding
                  <select
                    value={account.onboardingStatus}
                    disabled={working}
                    onChange={(event) => void onAction({ action: 'update_account', id: account.id, onboardingStatus: event.target.value }, `${account.name} onboarding updated.`)}
                    className="mt-1 h-9 w-full rounded-md border border-gold/20 bg-espresso px-2 text-sm text-champagne"
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="complete">Complete</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </label>
                <label className="text-xs text-champagne/45">
                  Plan
                  <select
                    value={account.subscriptionPlan}
                    disabled={working || account.type === 'wewed_internal'}
                    onChange={(event) => void onAction({ action: 'update_account', id: account.id, subscriptionPlan: event.target.value }, `${account.name} plan updated.`)}
                    className="mt-1 h-9 w-full rounded-md border border-gold/20 bg-espresso px-2 text-sm text-champagne"
                  >
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="internal">Internal</option>
                  </select>
                </label>
                <label className="text-xs text-champagne/45">
                  Subscription
                  <select
                    value={account.subscriptionStatus}
                    disabled={working || account.type === 'wewed_internal'}
                    onChange={(event) => void onAction({ action: 'update_account', id: account.id, subscriptionStatus: event.target.value }, `${account.name} subscription updated.`)}
                    className="mt-1 h-9 w-full rounded-md border border-gold/20 bg-espresso px-2 text-sm text-champagne"
                  >
                    <option value="free">Free</option>
                    <option value="trialing">Trialing</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past due</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gold/10 pt-4 text-xs text-champagne/40">
                <span>{account.ownerEmail || 'No owner assigned'}</span>
                <span>Updated {date(account.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function BillingSection({
  accounts,
  payments,
  summary,
  working,
  onAction,
}: {
  accounts: BusinessAccount[]
  payments: Payment[]
  summary: Summary
  working: boolean
  onAction: (payload: Record<string, unknown>, message: string) => Promise<boolean>
}) {
  const billable = accounts.filter((account) => account.type !== 'wewed_internal')
  const [businessAccountId, setBusinessAccountId] = useState(billable[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState('paid')
  const [reference, setReference] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    const ok = await onAction(
      { action: 'record_payment', businessAccountId, amount: Number(amount), status, provider: 'manual', providerReference: reference },
      'Payment record saved.',
    )
    if (ok) {
      setAmount('')
      setReference('')
    }
  }

  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Subscriptions and payments</p>
        <h2 className="mt-2 text-3xl font-semibold">Billing operations</h2>
        <p className="mt-2 text-sm text-champagne/55">Manual billing is available now; Stripe can attach to the same records later.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Paid revenue" value={money(summary.paidRevenueCents)} detail="All recorded paid transactions" icon={CircleDollarSign} />
        <SummaryCard label="Pending revenue" value={money(summary.pendingRevenueCents)} detail="Pending or due transactions" icon={CreditCard} />
        <SummaryCard label="Active subscriptions" value={summary.activeSubscriptions} detail="Active and trialing accounts" icon={Building2} />
      </div>

      <Card className="border-gold/20 bg-white/[0.045] text-champagne">
        <CardHeader><CardTitle className="text-lg">Record payment</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <select value={businessAccountId} onChange={(event) => setBusinessAccountId(event.target.value)} required className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
              {billable.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount (USD)" required className="border-gold/20 bg-black/15" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="due">Due</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference (optional)" className="border-gold/20 bg-black/15" />
            <div className="md:col-span-2 xl:col-span-4 flex justify-end">
              <Button type="submit" disabled={working || !businessAccountId || !amount} className="bg-gold text-espresso hover:bg-gold-light">
                {working ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                Save payment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-gold/15 bg-white/[0.035] text-champagne">
        <CardHeader><CardTitle className="text-lg">Recent payment records</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {payments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gold/20 p-6 text-sm text-champagne/45">No payment records yet.</p>
          ) : payments.map((payment) => (
            <div key={payment.id} className="flex flex-col justify-between gap-3 rounded-xl border border-gold/10 bg-black/10 p-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-medium">{payment.businessAccountName}</p>
                <p className="mt-1 text-xs text-champagne/40">{payment.providerReference || payment.provider} · {date(payment.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-lg font-semibold">{money(payment.amountCents, payment.currency)}</p>
                <Status value={payment.status} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}

function SupportSection({
  accounts,
  cases,
  working,
  onAction,
}: {
  accounts: BusinessAccount[]
  cases: SupportCase[]
  working: boolean
  onAction: (payload: Record<string, unknown>, message: string) => Promise<boolean>
}) {
  const [businessAccountId, setBusinessAccountId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('normal')

  async function submit(event: FormEvent) {
    event.preventDefault()
    const ok = await onAction(
      { action: 'create_support_case', businessAccountId: businessAccountId || null, title, description, priority, category: 'support' },
      'Support case created.',
    )
    if (ok) {
      setTitle('')
      setDescription('')
      setPriority('normal')
    }
  }

  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Client assistance</p>
        <h2 className="mt-2 text-3xl font-semibold">Support desk</h2>
        <p className="mt-2 text-sm text-champagne/55">Track client problems, access issues and operational follow-up.</p>
      </div>

      <Card className="border-gold/20 bg-white/[0.045] text-champagne">
        <CardHeader><CardTitle className="text-lg">Create support case</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <select value={businessAccountId} onChange={(event) => setBusinessAccountId(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
              <option value="">Platform / unassigned</option>
              {accounts.filter((account) => account.type !== 'wewed_internal').map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
              <option value="low">Low priority</option>
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Case title" required className="border-gold/20 bg-black/15 md:col-span-2" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What happened, what is affected, and what needs to be done?" className="min-h-24 rounded-md border border-gold/20 bg-black/15 px-3 py-2 text-sm md:col-span-2" />
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={working || !title.trim()} className="bg-gold text-espresso hover:bg-gold-light">
                {working ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create case
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {cases.length === 0 ? (
          <Card className="border-dashed border-gold/20 bg-transparent text-champagne"><CardContent className="p-8 text-center text-sm text-champagne/45">No support cases.</CardContent></Card>
        ) : cases.map((supportCase) => (
          <Card key={supportCase.id} className="border-gold/15 bg-white/[0.035] text-champagne">
            <CardContent className="p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{supportCase.title}</h3>
                    <Status value={supportCase.priority} />
                    <Status value={supportCase.status} />
                  </div>
                  <p className="mt-2 text-sm text-champagne/55">{supportCase.description || 'No description supplied.'}</p>
                  <p className="mt-3 text-xs text-champagne/35">{supportCase.businessAccountName || 'Platform'} · Created {date(supportCase.createdAt)}</p>
                </div>
                <select
                  value={supportCase.status}
                  disabled={working}
                  onChange={(event) => void onAction({ action: 'update_support_case', id: supportCase.id, status: event.target.value }, 'Support case status updated.')}
                  className="h-9 shrink-0 rounded-md border border-gold/20 bg-espresso px-2 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="waiting_client">Waiting for client</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function OperationsSection({
  incidents,
  working,
  onAction,
}: {
  incidents: Incident[]
  working: boolean
  onAction: (payload: Record<string, unknown>, message: string) => Promise<boolean>
}) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [severity, setSeverity] = useState('minor')

  async function submit(event: FormEvent) {
    event.preventDefault()
    const ok = await onAction(
      { action: 'create_incident', title, summary, severity },
      'Platform incident recorded.',
    )
    if (ok) {
      setTitle('')
      setSummary('')
      setSeverity('minor')
    }
  }

  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Platform health</p>
        <h2 className="mt-2 text-3xl font-semibold">Operations and incidents</h2>
        <p className="mt-2 text-sm text-champagne/55">Record outages and service degradation now; automated monitoring can connect later.</p>
      </div>

      <Card className="border-gold/20 bg-white/[0.045] text-champagne">
        <CardHeader><CardTitle className="text-lg">Record incident</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Incident title" required className="border-gold/20 bg-black/15" />
            <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Systems affected and current impact" className="min-h-24 rounded-md border border-gold/20 bg-black/15 px-3 py-2 text-sm md:col-span-2" />
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={working || !title.trim()} className="bg-gold text-espresso hover:bg-gold-light">
                {working ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
                Start incident
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {incidents.length === 0 ? (
          <Card className="border-dashed border-gold/20 bg-transparent text-champagne"><CardContent className="p-8 text-center text-sm text-champagne/45">No incidents recorded.</CardContent></Card>
        ) : incidents.map((incident) => (
          <Card key={incident.id} className="border-gold/15 bg-white/[0.035] text-champagne">
            <CardContent className="p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{incident.title}</h3>
                    <Status value={incident.severity} />
                    <Status value={incident.status} />
                  </div>
                  <p className="mt-2 text-sm text-champagne/55">{incident.summary || 'No impact summary supplied.'}</p>
                  <p className="mt-3 text-xs text-champagne/35">Started {date(incident.startedAt)}</p>
                </div>
                <select
                  value={incident.status}
                  disabled={working}
                  onChange={(event) => void onAction({ action: 'update_incident', id: incident.id, status: event.target.value }, 'Incident status updated.')}
                  className="h-9 shrink-0 rounded-md border border-gold/20 bg-espresso px-2 text-sm"
                >
                  <option value="investigating">Investigating</option>
                  <option value="identified">Identified</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
