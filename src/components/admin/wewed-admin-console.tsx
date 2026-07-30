'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Eye,
  FileClock,
  Filter,
  Gauge,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { logoutAdmin } from '@/lib/admin-auth'
import {
  ACCOUNT_LIFECYCLE_STATUSES,
  WEWED_ADMIN_ROLES,
  WEWED_ADMIN_ROLE_LABELS,
  canTransitionAccount,
  hasWewedAdminPermission,
  normalizeAccountLifecycleStatus,
  permissionForAccountTransition,
  type AccountLifecycleStatus,
  type WewedAdminPermission,
  type WewedAdminRole,
} from '@/lib/wewed-admin-policy'

type Summary = {
  businessAccounts: number
  activeAccounts: number
  pendingReviewAccounts: number
  restrictedAccounts: number
  couples: number
  weddings: number
  upcomingWeddings: number
  completedWeddings: number
  weddingsWithoutActiveOwner: number
  planners: number
  venues: number
  vendors: number
  activeSubscriptions: number
  openSupportCases: number
  urgentSupportCases: number
  openIncidents: number
  paidRevenueCents: number
  pendingRevenueCents: number
  accountsWithoutOwner: number
  accountsWithoutMembers: number
  incompleteOnboarding: number
}

type RiskSignal = {
  key: string
  label: string
  count: number
  severity: string
}

type Analytics = {
  reportingWindow: string
  accountStatusCounts: Record<string, number>
  accountTypeCounts: Record<string, number>
  subscriptionCounts: Record<string, number>
  onboardingCompletionRate: number
  averageApprovalAgeDays: number
  staleAccountCount: number
  averageWeddingsPerPlanningBusiness: number
  couplesPerActivePlanner: number | null
  riskSignals: RiskSignal[]
}

type BusinessAccount = {
  id: string
  name: string
  slug: string
  type: string
  status: string
  ownerUserId: string | null
  ownerEmail: string | null
  ownerName: string | null
  ownerLastLoginAt: string | null
  onboardingStatus: string
  subscriptionPlan: string
  subscriptionStatus: string
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
  notes: string | null
  metadata: Record<string, unknown>
  memberCount: number
  activeMemberCount: number
  weddingCount: number
  linkedEntityCount: number
  lastActivityAt: string
  riskFlags: string[]
  createdAt: string
  updatedAt: string
}

type AccountMember = {
  id: string
  businessAccountId: string
  userId: string
  role: string
  status: string
  permissions: unknown
  email: string
  name: string | null
  userActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

type AccountLink = {
  id: string
  businessAccountId: string
  entityType: string
  entityId: string
  relationship: string
  displayName: string
  createdAt: string
}

type AdminUser = {
  membershipId: string
  userId: string
  email: string
  name: string | null
  userActive: boolean
  lastLoginAt: string | null
  role: string
  status: string
  permissions: unknown
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
  businessAccountId: string | null
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
  admin: {
    email: string
    role: string
    permissions: string[]
    membershipId: string
  }
  summary: Summary
  analytics: Analytics
  accounts: BusinessAccount[]
  accountMembers: AccountMember[]
  accountLinks: AccountLink[]
  adminUsers: AdminUser[]
  supportCases: SupportCase[]
  incidents: Incident[]
  payments: Payment[]
  auditLog: AuditRow[]
}

type Section =
  | 'overview'
  | 'accounts'
  | 'approvals'
  | 'users'
  | 'billing'
  | 'support'
  | 'operations'
  | 'audit'

type ActionHandler = (
  payload: Record<string, unknown>,
  successMessage: string,
) => Promise<boolean>

const accountTypeLabels: Record<string, string> = {
  wewed_internal: 'Wewed internal',
  planning_company: 'Planning company',
  couple: 'Couple / client',
  venue: 'Venue',
  vendor: 'Vendor',
  client: 'Business client',
}

const lifecycleLabels: Record<AccountLifecycleStatus, string> = {
  pending_review: 'Pending review',
  active: 'Active',
  rejected: 'Rejected',
  suspended: 'Suspended',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
  archived: 'Archived',
}

const riskLabels: Record<string, string> = {
  missing_owner: 'Missing owner',
  no_active_members: 'No active members',
  incomplete_onboarding: 'Incomplete onboarding',
  restricted_access: 'Restricted access',
  billing_attention: 'Billing attention',
  inactive_60_days: 'Inactive 60+ days',
}

function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format((Number(cents) || 0) / 100)
}

function date(value: string | null | undefined, includeTime = true) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(value))
}

function statusClass(value: string) {
  if (['active', 'paid', 'resolved', 'complete', 'free'].includes(value)) {
    return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
  }
  if (['rejected', 'suspended', 'blocked', 'failed', 'cancelled', 'urgent', 'major', 'critical'].includes(value)) {
    return 'border-red-300/30 bg-red-300/10 text-red-100'
  }
  if (['archived', 'revoked', 'closed'].includes(value)) {
    return 'border-champagne/15 bg-champagne/5 text-champagne/55'
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

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  emphasis = 'normal',
}: {
  label: string
  value: string | number
  detail: string
  icon: LucideIcon
  emphasis?: 'normal' | 'warning' | 'critical'
}) {
  const emphasisClass =
    emphasis === 'critical'
      ? 'border-red-300/25 bg-red-300/[0.06]'
      : emphasis === 'warning'
        ? 'border-gold/25 bg-gold/[0.06]'
        : 'border-gold/15 bg-white/[0.04]'

  return (
    <Card className={`${emphasisClass} text-champagne shadow-none`}>
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

function Distribution({
  title,
  values,
  labels,
}: {
  title: string
  values: Record<string, number>
  labels?: Record<string, string>
}) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, count]) => sum + count, 0)

  return (
    <Card className="border-gold/15 bg-white/[0.035] text-champagne">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-champagne/45">No data available.</p>
        ) : (
          entries.map(([key, count]) => {
            const percentage = total ? Math.round((count / total) * 100) : 0
            return (
              <div key={key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-champagne/70">{labels?.[key] || key.replaceAll('_', ' ')}</span>
                  <span className="font-semibold">{count} <span className="font-normal text-champagne/35">({percentage}%)</span></span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

export function WewedAdminConsole() {
  const [data, setData] = useState<AdminPayload | null>(null)
  const [section, setSection] = useState<Section>('overview')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [sort, setSort] = useState('activity')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [transition, setTransition] = useState<{ account: BusinessAccount; status: AccountLifecycleStatus } | null>(null)

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

  const can = useCallback(
    (permission: WewedAdminPermission) =>
      Boolean(data && hasWewedAdminPermission(data.admin.permissions, permission)),
    [data],
  )

  const filteredAccounts = useMemo(() => {
    if (!data) return []
    const normalized = query.trim().toLowerCase()
    const result = data.accounts.filter((account) => {
      const members = data.accountMembers.filter((member) => member.businessAccountId === account.id)
      const links = data.accountLinks.filter((link) => link.businessAccountId === account.id)
      const matchesType = typeFilter === 'all' || account.type === typeFilter
      const matchesStatus = statusFilter === 'all' || account.status === statusFilter
      const matchesRisk = riskFilter === 'all' || account.riskFlags.includes(riskFilter)
      const matchesQuery =
        !normalized ||
        account.name.toLowerCase().includes(normalized) ||
        account.slug.toLowerCase().includes(normalized) ||
        account.ownerEmail?.toLowerCase().includes(normalized) ||
        members.some((member) => member.email.toLowerCase().includes(normalized)) ||
        links.some((link) => link.displayName.toLowerCase().includes(normalized))
      return matchesType && matchesStatus && matchesRisk && matchesQuery
    })

    return result.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sort === 'weddings') return b.weddingCount - a.weddingCount
      if (sort === 'risk') return b.riskFlags.length - a.riskFlags.length
      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    })
  }, [data, query, riskFilter, sort, statusFilter, typeFilter])

  const selectedAccount = data?.accounts.find((account) => account.id === selectedAccountId) ?? null

  function signOut() {
    logoutAdmin()
    window.location.assign('/')
  }

  function openFilteredAccounts(nextRisk: string) {
    setRiskFilter(nextRisk)
    setSection('accounts')
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
              <Button onClick={() => void load()} className="bg-gold text-espresso hover:bg-gold-light">Retry</Button>
              <Button variant="outline" onClick={signOut} className="border-gold/30 text-gold hover:bg-gold/10">Sign out</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  const nav: Array<{ id: Section; label: string; icon: LucideIcon; permission: WewedAdminPermission }> = [
    { id: 'overview', label: 'Overview', icon: Gauge, permission: 'admin.overview.read' },
    { id: 'accounts', label: 'Accounts', icon: Building2, permission: 'admin.accounts.read' },
    { id: 'approvals', label: 'Approvals', icon: ClipboardCheck, permission: 'admin.accounts.read' },
    { id: 'users', label: 'Users & Roles', icon: ShieldCheck, permission: 'admin.members.read' },
    { id: 'billing', label: 'Billing', icon: CreditCard, permission: 'admin.billing.read' },
    { id: 'support', label: 'Support', icon: Users, permission: 'admin.support.read' },
    { id: 'operations', label: 'Operations', icon: AlertTriangle, permission: 'admin.incidents.read' },
    { id: 'audit', label: 'Audit Log', icon: FileClock, permission: 'admin.audit.read' },
  ].filter((item) => can(item.permission))

  return (
    <main className="min-h-screen bg-espresso text-champagne" data-admin-console="true">
      <header className="sticky top-0 z-30 border-b border-gold/15 bg-espresso/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
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
            <div className="hidden text-right md:block">
              <p className="text-xs text-champagne/45">{WEWED_ADMIN_ROLE_LABELS[data.admin.role as WewedAdminRole] || data.admin.role}</p>
              <p className="text-sm text-champagne/80">{data.admin.email}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading || working} className="border-gold/25 text-gold hover:bg-gold/10" aria-label="Refresh admin data">
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button type="button" variant="outline" onClick={signOut} className="border-gold/25 text-gold hover:bg-gold/10">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1700px] gap-6 px-5 py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-2xl border border-gold/15 bg-white/[0.035] p-3 lg:sticky lg:top-24">
          <nav className="grid gap-1 sm:grid-cols-4 lg:grid-cols-1">
            {nav.map((item) => {
              const Icon = item.icon
              const active = section === item.id
              return (
                <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${active ? 'bg-gold text-espresso' : 'text-champagne/65 hover:bg-white/[0.05] hover:text-champagne'}`}>
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                  {item.id === 'approvals' && data.summary.pendingReviewAccounts > 0 && (
                    <span className="ml-auto rounded-full bg-espresso px-2 py-0.5 text-[10px] text-gold">{data.summary.pendingReviewAccounts}</span>
                  )}
                </button>
              )
            })}
          </nav>
          <div className="mt-4 hidden rounded-xl border border-gold/10 bg-black/10 p-4 lg:block">
            <p className="text-[10px] uppercase tracking-[0.18em] text-champagne/40">Access policy</p>
            <p className="mt-2 text-xs leading-5 text-champagne/60">Actions are enforced by platform role, account lifecycle rules and server-side audit controls.</p>
          </div>
        </aside>

        <section className="min-w-0 space-y-6">
          {(error || notice) && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-300/25 bg-red-300/10 text-red-100' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'}`}>
              {error || notice}
            </div>
          )}

          {section === 'overview' && (
            <OverviewSection data={data} onApprovals={() => setSection('approvals')} onRisk={openFilteredAccounts} onSection={setSection} />
          )}

          {section === 'accounts' && (
            <AccountsSection
              data={data}
              accounts={filteredAccounts}
              query={query}
              typeFilter={typeFilter}
              statusFilter={statusFilter}
              riskFilter={riskFilter}
              sort={sort}
              working={working}
              can={can}
              onQuery={setQuery}
              onTypeFilter={setTypeFilter}
              onStatusFilter={setStatusFilter}
              onRiskFilter={setRiskFilter}
              onSort={setSort}
              onSelect={setSelectedAccountId}
              onAction={act}
              onTransition={(account, status) => setTransition({ account, status })}
            />
          )}

          {section === 'approvals' && (
            <ApprovalsSection data={data} can={can} onSelect={(id) => { setSelectedAccountId(id); setSection('accounts') }} onTransition={(account, status) => setTransition({ account, status })} />
          )}

          {section === 'users' && (
            <UsersRolesSection data={data} working={working} can={can} onAction={act} />
          )}

          {section === 'billing' && (
            <BillingSection accounts={data.accounts} payments={data.payments} summary={data.summary} working={working} canManage={can('admin.billing.manage')} onAction={act} />
          )}

          {section === 'support' && (
            <SupportSection accounts={data.accounts} cases={data.supportCases} working={working} canManage={can('admin.support.manage')} onAction={act} />
          )}

          {section === 'operations' && (
            <OperationsSection incidents={data.incidents} working={working} canManage={can('admin.incidents.manage')} onAction={act} />
          )}

          {section === 'audit' && <AuditSection rows={data.auditLog} />}
        </section>
      </div>

      {selectedAccount && (
        <AccountInspector
          account={selectedAccount}
          members={data.accountMembers.filter((member) => member.businessAccountId === selectedAccount.id)}
          links={data.accountLinks.filter((link) => link.businessAccountId === selectedAccount.id)}
          payments={data.payments.filter((payment) => payment.businessAccountId === selectedAccount.id)}
          supportCases={data.supportCases.filter((item) => item.businessAccountId === selectedAccount.id)}
          auditRows={data.auditLog.filter((row) => row.businessAccountId === selectedAccount.id)}
          working={working}
          can={can}
          onClose={() => setSelectedAccountId(null)}
          onAction={act}
          onTransition={(status) => setTransition({ account: selectedAccount, status })}
        />
      )}

      {transition && (
        <LifecycleDialog
          account={transition.account}
          status={transition.status}
          working={working}
          onClose={() => setTransition(null)}
          onSubmit={async (reason, note) => {
            const ok = await act(
              { action: 'transition_account', id: transition.account.id, status: transition.status, reason, note },
              `${transition.account.name} moved to ${lifecycleLabels[transition.status]}.`,
            )
            if (ok) setTransition(null)
          }}
        />
      )}
    </main>
  )
}

function OverviewSection({
  data,
  onApprovals,
  onRisk,
  onSection,
}: {
  data: AdminPayload
  onApprovals: () => void
  onRisk: (risk: string) => void
  onSection: (section: Section) => void
}) {
  const riskClick: Record<string, () => void> = {
    pending_approvals: onApprovals,
    missing_owners: () => onRisk('missing_owner'),
    missing_members: () => onRisk('no_active_members'),
    billing_attention: () => onSection('billing'),
    urgent_support: () => onSection('support'),
    open_incidents: () => onSection('operations'),
    wedding_ownership: () => onSection('accounts'),
  }

  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Operational intelligence</p>
        <h2 className="mt-2 text-3xl font-semibold">What needs attention now</h2>
        <p className="mt-2 max-w-3xl text-sm text-champagne/55">Current-state analysis across account governance, onboarding, ownership, billing and platform operations.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.analytics.riskSignals.map((signal) => (
          <button key={signal.key} type="button" onClick={riskClick[signal.key]} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${signal.count > 0 && signal.severity === 'critical' ? 'border-red-300/30 bg-red-300/[0.07]' : signal.count > 0 ? 'border-gold/30 bg-gold/[0.06]' : 'border-gold/12 bg-white/[0.025]'}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.15em] text-champagne/50">{signal.label}</p>
              <AlertTriangle className={`size-4 ${signal.count > 0 ? 'text-gold' : 'text-champagne/25'}`} />
            </div>
            <p className="mt-3 text-3xl font-semibold">{signal.count}</p>
            <p className="mt-1 text-xs text-champagne/40">Open filtered view</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Business accounts" value={data.summary.businessAccounts} detail={`${data.summary.activeAccounts} active · ${data.summary.restrictedAccounts} restricted`} icon={Building2} />
        <MetricCard label="Approval backlog" value={data.summary.pendingReviewAccounts} detail={`${data.analytics.averageApprovalAgeDays} average days waiting`} icon={ClipboardCheck} emphasis={data.summary.pendingReviewAccounts ? 'warning' : 'normal'} />
        <MetricCard label="Onboarding complete" value={`${data.analytics.onboardingCompletionRate}%`} detail={`${data.summary.incompleteOnboarding} accounts incomplete`} icon={CheckCircle2} emphasis={data.summary.incompleteOnboarding ? 'warning' : 'normal'} />
        <MetricCard label="Wedding ownership risk" value={data.summary.weddingsWithoutActiveOwner} detail="Weddings without an active owner membership" icon={LockKeyhole} emphasis={data.summary.weddingsWithoutActiveOwner ? 'critical' : 'normal'} />
        <MetricCard label="Upcoming weddings" value={data.summary.upcomingWeddings} detail={`${data.summary.completedWeddings} completed`} icon={Store} />
        <MetricCard label="Weddings per planner business" value={data.analytics.averageWeddingsPerPlanningBusiness} detail="Average linked wedding portfolio" icon={BarChart3} />
        <MetricCard label="Pending exposure" value={money(data.summary.pendingRevenueCents)} detail={`${data.summary.activeSubscriptions} active or trialing subscriptions`} icon={CircleDollarSign} emphasis={data.summary.pendingRevenueCents > 0 ? 'warning' : 'normal'} />
        <MetricCard label="Open support" value={data.summary.openSupportCases} detail={`${data.summary.urgentSupportCases} high priority`} icon={Users} emphasis={data.summary.urgentSupportCases ? 'critical' : 'normal'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Distribution title="Account lifecycle" values={data.analytics.accountStatusCounts} labels={lifecycleLabels} />
        <Distribution title="Account mix" values={data.analytics.accountTypeCounts} labels={accountTypeLabels} />
        <Distribution title="Subscription state" values={data.analytics.subscriptionCounts} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-gold/15 bg-white/[0.035] text-champagne">
          <CardHeader><CardTitle className="text-lg">Priority account queue</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.accounts.filter((account) => account.type !== 'wewed_internal' && (account.status === 'pending_review' || account.riskFlags.length > 0)).slice(0, 10).map((account) => (
              <div key={account.id} className="flex flex-col justify-between gap-3 rounded-xl border border-gold/10 bg-black/10 p-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{account.name}</p><Status value={account.status} /></div>
                  <p className="mt-1 text-xs text-champagne/40">{account.riskFlags.map((flag) => riskLabels[flag] || flag).join(' · ') || 'Pending review'}</p>
                </div>
                <Button variant="outline" onClick={() => onRisk(account.riskFlags[0] || 'all')} className="border-gold/20 text-gold hover:bg-gold/10">Review</Button>
              </div>
            ))}
            {data.accounts.filter((account) => account.type !== 'wewed_internal' && (account.status === 'pending_review' || account.riskFlags.length > 0)).length === 0 && (
              <p className="rounded-xl border border-dashed border-gold/20 p-6 text-sm text-champagne/45">No account exceptions are currently open.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-gold/15 bg-white/[0.035] text-champagne">
          <CardHeader><CardTitle className="text-lg">Operating ratios</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Ratio label="Couples per active planner" value={data.analytics.couplesPerActivePlanner === null ? 'No active planners' : String(data.analytics.couplesPerActivePlanner)} />
            <Ratio label="Accounts without owners" value={`${data.summary.accountsWithoutOwner} of ${data.summary.businessAccounts}`} />
            <Ratio label="Accounts without active members" value={`${data.summary.accountsWithoutMembers} of ${data.summary.businessAccounts}`} />
            <Ratio label="Inactive for 60+ days" value={`${data.analytics.staleAccountCount} accounts`} />
            <Ratio label="Reporting window" value={data.analytics.reportingWindow} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Ratio({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-gold/10 pb-3 last:border-0 last:pb-0"><span className="text-sm text-champagne/55">{label}</span><span className="text-right text-sm font-semibold">{value}</span></div>
}

function AccountsSection({
  data,
  accounts,
  query,
  typeFilter,
  statusFilter,
  riskFilter,
  sort,
  working,
  can,
  onQuery,
  onTypeFilter,
  onStatusFilter,
  onRiskFilter,
  onSort,
  onSelect,
  onAction,
  onTransition,
}: {
  data: AdminPayload
  accounts: BusinessAccount[]
  query: string
  typeFilter: string
  statusFilter: string
  riskFilter: string
  sort: string
  working: boolean
  can: (permission: WewedAdminPermission) => boolean
  onQuery: (value: string) => void
  onTypeFilter: (value: string) => void
  onStatusFilter: (value: string) => void
  onRiskFilter: (value: string) => void
  onSort: (value: string) => void
  onSelect: (id: string) => void
  onAction: ActionHandler
  onTransition: (account: BusinessAccount, status: AccountLifecycleStatus) => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('planning_company')
  const [plan, setPlan] = useState('free')
  const [notes, setNotes] = useState('')

  async function create(event: FormEvent) {
    event.preventDefault()
    const ok = await onAction({ action: 'create_account', name, type, subscriptionPlan: plan, notes }, `${name} was added to the approval queue.`)
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
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Governed registry</p>
          <h2 className="mt-2 text-3xl font-semibold">Business accounts</h2>
          <p className="mt-2 text-sm text-champagne/55">Compare, filter and inspect {data.summary.businessAccounts} client and partner accounts.</p>
        </div>
        {can('admin.accounts.create') && (
          <Button onClick={() => setShowCreate((value) => !value)} className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Onboard business</Button>
        )}
      </div>

      {showCreate && (
        <Card className="border-gold/20 bg-white/[0.045] text-champagne">
          <CardHeader><CardTitle className="text-lg">Create pending account</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Business name" required className="border-gold/20 bg-black/15" />
              <select value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
                <option value="planning_company">Planning company</option><option value="couple">Couple / client</option><option value="venue">Venue</option><option value="vendor">Vendor</option><option value="client">Other business client</option>
              </select>
              <select value={plan} onChange={(event) => setPlan(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
                <option value="free">Free</option><option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option>
              </select>
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Review notes" className="border-gold/20 bg-black/15" />
              <div className="flex justify-end md:col-span-2 xl:col-span-4"><Button type="submit" disabled={working || !name.trim()} className="bg-gold text-espresso hover:bg-gold-light">{working ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Create for review</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-gold/15 bg-white/[0.025] text-champagne">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_repeat(4,minmax(145px,auto))]">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search account, owner, member or wedding" className="border-gold/20 bg-black/15 pl-10" /></div>
            <FilterSelect value={typeFilter} onChange={onTypeFilter}><option value="all">All types</option><option value="planning_company">Planning companies</option><option value="couple">Couples</option><option value="venue">Venues</option><option value="vendor">Vendors</option><option value="wewed_internal">Wewed internal</option></FilterSelect>
            <FilterSelect value={statusFilter} onChange={onStatusFilter}><option value="all">All statuses</option>{ACCOUNT_LIFECYCLE_STATUSES.map((status) => <option key={status} value={status}>{lifecycleLabels[status]}</option>)}</FilterSelect>
            <FilterSelect value={riskFilter} onChange={onRiskFilter}><option value="all">All risk signals</option>{Object.entries(riskLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</FilterSelect>
            <FilterSelect value={sort} onChange={onSort}><option value="activity">Recent activity</option><option value="name">Account name</option><option value="created">Newest created</option><option value="weddings">Wedding portfolio</option><option value="risk">Risk count</option></FilterSelect>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-gold/15 bg-white/[0.025]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-gold/15 bg-black/15 text-[10px] uppercase tracking-[0.16em] text-champagne/45">
              <tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Lifecycle</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Weddings</th><th className="px-4 py-3">Onboarding</th><th className="px-4 py-3">Activity</th><th className="px-4 py-3">Signals</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {accounts.map((account) => (
                <tr key={account.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-4"><p className="font-semibold">{account.name}</p><p className="mt-1 text-xs text-champagne/40">{accountTypeLabels[account.type] || account.type} · {account.slug}</p></td>
                  <td className="px-4 py-4"><Status value={account.status} /></td>
                  <td className="px-4 py-4"><p className="max-w-[190px] truncate text-champagne/75">{account.ownerName || account.ownerEmail || 'Not assigned'}</p></td>
                  <td className="px-4 py-4"><span className="font-semibold">{account.activeMemberCount}</span><span className="text-champagne/35"> / {account.memberCount}</span></td>
                  <td className="px-4 py-4 font-semibold">{account.weddingCount}</td>
                  <td className="px-4 py-4"><Status value={account.onboardingStatus} /></td>
                  <td className="px-4 py-4 text-xs text-champagne/50">{date(account.lastActivityAt)}</td>
                  <td className="px-4 py-4"><div className="flex max-w-[220px] flex-wrap gap-1">{account.riskFlags.length ? account.riskFlags.slice(0, 3).map((flag) => <span key={flag} className="rounded-md border border-gold/15 bg-gold/5 px-2 py-1 text-[10px] text-gold-light">{riskLabels[flag] || flag}</span>) : <span className="text-xs text-emerald-100/70">No current flags</span>}</div></td>
                  <td className="px-4 py-4"><Button variant="outline" onClick={() => onSelect(account.id)} className="border-gold/20 text-gold hover:bg-gold/10"><Eye className="size-4" />Inspect</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {accounts.length === 0 && <p className="p-10 text-center text-sm text-champagne/45">No accounts match the selected filters.</p>}
      </div>
    </>
  )
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><Filter className="size-4" />{children}</select>
}

function ApprovalsSection({ data, can, onSelect, onTransition }: { data: AdminPayload; can: (permission: WewedAdminPermission) => boolean; onSelect: (id: string) => void; onTransition: (account: BusinessAccount, status: AccountLifecycleStatus) => void }) {
  const pending = data.accounts.filter((account) => account.status === 'pending_review')
  const reconsider = data.accounts.filter((account) => account.status === 'rejected')
  const restricted = data.accounts.filter((account) => ['suspended', 'blocked', 'cancelled', 'archived'].includes(account.status))

  return (
    <>
      <div><p className="text-xs uppercase tracking-[0.2em] text-gold">Decision queues</p><h2 className="mt-2 text-3xl font-semibold">Approvals and account lifecycle</h2><p className="mt-2 text-sm text-champagne/55">Approve new accounts, reconsider rejections and review restricted clients with an auditable reason.</p></div>
      <ApprovalList title="Pending review" detail={`${pending.length} applications awaiting a decision`} accounts={pending} actions={(account) => [
        ...(can('admin.accounts.approve') ? [{ label: 'Approve', status: 'active' as const }] : []),
        ...(can('admin.accounts.reject') ? [{ label: 'Reject', status: 'rejected' as const }] : []),
      ]} onSelect={onSelect} onTransition={onTransition} />
      <ApprovalList title="Rejected applications" detail={`${reconsider.length} accounts may be returned to review`} accounts={reconsider} actions={() => can('admin.accounts.restore') ? [{ label: 'Return to review', status: 'pending_review' as const }] : []} onSelect={onSelect} onTransition={onTransition} />
      <ApprovalList title="Restricted and archived" detail={`${restricted.length} accounts are outside normal active service`} accounts={restricted} actions={(account) => can('admin.accounts.restore') && account.status !== 'archived' ? [{ label: 'Restore active', status: 'active' as const }] : can('admin.accounts.restore') ? [{ label: 'Restore to review', status: 'pending_review' as const }] : []} onSelect={onSelect} onTransition={onTransition} />
    </>
  )
}

function ApprovalList({ title, detail, accounts, actions, onSelect, onTransition }: { title: string; detail: string; accounts: BusinessAccount[]; actions: (account: BusinessAccount) => Array<{ label: string; status: AccountLifecycleStatus }>; onSelect: (id: string) => void; onTransition: (account: BusinessAccount, status: AccountLifecycleStatus) => void }) {
  return (
    <Card className="border-gold/15 bg-white/[0.035] text-champagne">
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle><p className="text-sm text-champagne/45">{detail}</p></CardHeader>
      <CardContent className="space-y-3">
        {accounts.length === 0 ? <p className="rounded-xl border border-dashed border-gold/20 p-6 text-sm text-champagne/45">No accounts in this queue.</p> : accounts.map((account) => (
          <div key={account.id} className="flex flex-col justify-between gap-4 rounded-xl border border-gold/10 bg-black/10 p-4 lg:flex-row lg:items-center">
            <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{account.name}</p><Status value={account.status} /></div><p className="mt-1 text-xs text-champagne/40">Created {date(account.createdAt)} · {account.ownerEmail || 'No owner'} · {account.activeMemberCount} active members</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onSelect(account.id)} className="border-gold/20 text-gold hover:bg-gold/10"><Eye className="size-4" />Inspect</Button>{actions(account).map((action) => <Button key={action.status} onClick={() => onTransition(account, action.status)} className="bg-gold text-espresso hover:bg-gold-light">{action.label}</Button>)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function AccountInspector({ account, members, links, payments, supportCases, auditRows, working, can, onClose, onAction, onTransition }: { account: BusinessAccount; members: AccountMember[]; links: AccountLink[]; payments: Payment[]; supportCases: SupportCase[]; auditRows: AuditRow[]; working: boolean; can: (permission: WewedAdminPermission) => boolean; onClose: () => void; onAction: ActionHandler; onTransition: (status: AccountLifecycleStatus) => void }) {
  const [notes, setNotes] = useState(account.notes || '')
  useEffect(() => setNotes(account.notes || ''), [account.id, account.notes])
  const currentStatus = normalizeAccountLifecycleStatus(account.status)
  const transitions = ACCOUNT_LIFECYCLE_STATUSES.filter((status) => canTransitionAccount(currentStatus, status) && can(permissionForAccountTransition(currentStatus, status)))
  const lifecycle = account.metadata?.lifecycle && typeof account.metadata.lifecycle === 'object' ? account.metadata.lifecycle as Record<string, unknown> : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${account.name} account inspector`}>
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-gold/20 bg-espresso shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gold/15 bg-espresso/95 p-5 backdrop-blur">
          <div><p className="text-xs uppercase tracking-[0.18em] text-gold">Account inspector</p><h2 className="mt-1 text-2xl font-semibold">{account.name}</h2><div className="mt-2 flex flex-wrap items-center gap-2"><Status value={account.status} /><span className="text-xs text-champagne/40">{accountTypeLabels[account.type] || account.type} · {account.slug}</span></div></div>
          <Button variant="outline" onClick={onClose} className="border-gold/20 text-gold hover:bg-gold/10" aria-label="Close account inspector"><X className="size-4" /></Button>
        </div>
        <div className="space-y-6 p-5">
          {account.riskFlags.length > 0 && <div className="rounded-xl border border-gold/25 bg-gold/[0.06] p-4"><p className="text-xs uppercase tracking-[0.16em] text-gold">Operational signals</p><div className="mt-3 flex flex-wrap gap-2">{account.riskFlags.map((flag) => <span key={flag} className="rounded-full border border-gold/20 px-3 py-1 text-xs text-gold-light">{riskLabels[flag] || flag}</span>)}</div></div>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><InspectorMetric label="Owner" value={account.ownerName || account.ownerEmail || 'Not assigned'} /><InspectorMetric label="Active team" value={`${account.activeMemberCount} / ${account.memberCount}`} /><InspectorMetric label="Weddings" value={String(account.weddingCount)} /><InspectorMetric label="Last activity" value={date(account.lastActivityAt)} /></div>

          {lifecycle && <Card className="border-gold/15 bg-white/[0.03] text-champagne"><CardHeader><CardTitle className="text-base">Latest lifecycle decision</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2"><Ratio label="Previous status" value={String(lifecycle.previousStatus || '—')} /><Ratio label="Changed at" value={date(typeof lifecycle.changedAt === 'string' ? lifecycle.changedAt : null)} /><div className="sm:col-span-2"><p className="text-xs text-champagne/40">Reason</p><p className="mt-1 text-champagne/75">{String(lifecycle.reason || '—')}</p></div></CardContent></Card>}

          {account.type !== 'wewed_internal' && transitions.length > 0 && <Card className="border-gold/20 bg-white/[0.04] text-champagne"><CardHeader><CardTitle className="text-base">Lifecycle actions</CardTitle><p className="text-xs text-champagne/45">Every action requires a reason and creates an audit record.</p></CardHeader><CardContent className="flex flex-wrap gap-2">{transitions.map((status) => <Button key={status} onClick={() => onTransition(status)} variant={status === 'active' ? 'default' : 'outline'} className={status === 'active' ? 'bg-gold text-espresso hover:bg-gold-light' : 'border-gold/25 text-gold hover:bg-gold/10'}>{lifecycleLabels[status]}</Button>)}</CardContent></Card>}

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="border-gold/15 bg-white/[0.03] text-champagne"><CardHeader><CardTitle className="text-base">Team memberships</CardTitle></CardHeader><CardContent className="space-y-3">{members.length ? members.map((member) => <div key={member.id} className="rounded-xl border border-gold/10 bg-black/10 p-3"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium">{member.name || member.email}</p><p className="mt-1 text-xs text-champagne/40">{member.email} · {member.role}</p></div><Status value={member.status} /></div><p className="mt-2 text-xs text-champagne/35">Last login {date(member.lastLoginAt)}</p></div>) : <Empty text="No business members are linked." />}</CardContent></Card>
            <Card className="border-gold/15 bg-white/[0.03] text-champagne"><CardHeader><CardTitle className="text-base">Linked records</CardTitle></CardHeader><CardContent className="space-y-3">{links.length ? links.map((link) => <div key={link.id} className="flex items-center justify-between gap-3 rounded-xl border border-gold/10 bg-black/10 p-3"><div><p className="text-sm font-medium">{link.displayName}</p><p className="mt-1 text-xs text-champagne/40">{link.entityType} · {link.relationship}</p></div></div>) : <Empty text="No linked platform records." />}</CardContent></Card>
          </div>

          <Card className="border-gold/15 bg-white/[0.03] text-champagne"><CardHeader><CardTitle className="text-base">Account controls</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
            <label className="text-xs text-champagne/45">Onboarding<select value={account.onboardingStatus} disabled={working || !can('admin.accounts.approve')} onChange={(event) => void onAction({ action: 'update_account', id: account.id, onboardingStatus: event.target.value }, `${account.name} onboarding updated.`)} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm text-champagne"><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="complete">Complete</option><option value="blocked">Blocked</option></select></label>
            <label className="text-xs text-champagne/45">Subscription plan<select value={account.subscriptionPlan} disabled={working || !can('admin.billing.manage')} onChange={(event) => void onAction({ action: 'update_account', id: account.id, subscriptionPlan: event.target.value }, `${account.name} plan updated.`)} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm text-champagne"><option value="free">Free</option><option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option><option value="internal">Internal</option></select></label>
            <label className="text-xs text-champagne/45">Subscription status<select value={account.subscriptionStatus} disabled={working || !can('admin.billing.manage')} onChange={(event) => void onAction({ action: 'update_account', id: account.id, subscriptionStatus: event.target.value }, `${account.name} subscription updated.`)} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm text-champagne"><option value="free">Free</option><option value="trialing">Trialing</option><option value="active">Active</option><option value="past_due">Past due</option><option value="cancelled">Cancelled</option></select></label>
            <label className="text-xs text-champagne/45 md:col-span-2">Internal notes<textarea value={notes} disabled={!can('admin.accounts.approve')} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-gold/20 bg-black/15 px-3 py-2 text-sm" /><div className="mt-2 flex justify-end"><Button disabled={working || !can('admin.accounts.approve')} onClick={() => void onAction({ action: 'update_account', id: account.id, notes }, `${account.name} notes updated.`)} className="bg-gold text-espresso hover:bg-gold-light">Save notes</Button></div></label>
          </CardContent></Card>

          <div className="grid gap-5 xl:grid-cols-2"><Card className="border-gold/15 bg-white/[0.03] text-champagne"><CardHeader><CardTitle className="text-base">Billing history</CardTitle></CardHeader><CardContent className="space-y-3">{payments.length ? payments.slice(0, 8).map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 border-b border-gold/10 pb-3 last:border-0"><div><p className="text-sm font-medium">{money(payment.amountCents, payment.currency)}</p><p className="text-xs text-champagne/40">{date(payment.createdAt)}</p></div><Status value={payment.status} /></div>) : <Empty text="No visible payment records." />}</CardContent></Card><Card className="border-gold/15 bg-white/[0.03] text-champagne"><CardHeader><CardTitle className="text-base">Support history</CardTitle></CardHeader><CardContent className="space-y-3">{supportCases.length ? supportCases.slice(0, 8).map((item) => <div key={item.id} className="border-b border-gold/10 pb-3 last:border-0"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{item.title}</p><Status value={item.status} /></div><p className="mt-1 text-xs text-champagne/40">{item.priority} · {date(item.createdAt)}</p></div>) : <Empty text="No visible support records." />}</CardContent></Card></div>

          <Card className="border-gold/15 bg-white/[0.03] text-champagne"><CardHeader><CardTitle className="text-base">Account audit timeline</CardTitle></CardHeader><CardContent className="space-y-3">{auditRows.length ? auditRows.slice(0, 15).map((row) => <div key={row.id} className="border-b border-gold/10 pb-3 last:border-0"><div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="text-sm font-medium">{row.action.replaceAll('_', ' ')}</p><span className="text-xs text-champagne/35">{date(row.createdAt)}</span></div><p className="mt-1 text-xs text-champagne/40">{row.actorEmail || 'System'} · {JSON.stringify(row.details)}</p></div>) : <Empty text="No visible audit events." />}</CardContent></Card>
        </div>
      </div>
    </div>
  )
}

function InspectorMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-gold/10 bg-black/10 p-3"><p className="text-xs text-champagne/40">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div> }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-gold/15 p-4 text-sm text-champagne/40">{text}</p> }

function LifecycleDialog({ account, status, working, onClose, onSubmit }: { account: BusinessAccount; status: AccountLifecycleStatus; working: boolean; onClose: () => void; onSubmit: (reason: string, note: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); await onSubmit(reason, note) }
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Account lifecycle confirmation"><Card className="w-full max-w-xl border-gold/25 bg-espresso text-champagne shadow-2xl"><CardHeader><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-gold">Lifecycle confirmation</p><CardTitle className="mt-2 text-xl">Move {account.name} to {lifecycleLabels[status]}?</CardTitle></div><Button variant="outline" onClick={onClose} className="border-gold/20 text-gold hover:bg-gold/10"><X className="size-4" /></Button></div></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="rounded-xl border border-gold/15 bg-black/10 p-4 text-sm text-champagne/60">Current status: <strong className="text-champagne">{account.status.replaceAll('_', ' ')}</strong>. Historical wedding, billing, support and audit records will be preserved.</div><label className="block text-xs text-champagne/50">Reason required<textarea value={reason} onChange={(event) => setReason(event.target.value)} required placeholder="Explain why this decision is being made." className="mt-1 min-h-24 w-full rounded-md border border-gold/20 bg-black/15 px-3 py-2 text-sm" /></label><label className="block text-xs text-champagne/50">Internal note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add follow-up instructions or evidence." className="mt-1 min-h-20 w-full rounded-md border border-gold/20 bg-black/15 px-3 py-2 text-sm" /></label><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose} className="border-gold/20 text-gold hover:bg-gold/10">Cancel</Button><Button type="submit" disabled={working || !reason.trim()} className="bg-gold text-espresso hover:bg-gold-light">{working ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Confirm decision</Button></div></form></CardContent></Card></div>
}

function UsersRolesSection({ data, working, can, onAction }: { data: AdminPayload; working: boolean; can: (permission: WewedAdminPermission) => boolean; onAction: ActionHandler }) {
  const canManage = can('admin.members.manage')
  return <><div><p className="text-xs uppercase tracking-[0.2em] text-gold">Platform access</p><h2 className="mt-2 text-3xl font-semibold">Users and roles</h2><p className="mt-2 text-sm text-champagne/55">Manage active parent-company memberships. Application admin status remains a separate entry prerequisite.</p></div><div className="overflow-hidden rounded-2xl border border-gold/15 bg-white/[0.025]"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-gold/15 bg-black/15 text-[10px] uppercase tracking-[0.16em] text-champagne/45"><tr><th className="px-4 py-3">Administrator</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Membership</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Last login</th></tr></thead><tbody className="divide-y divide-gold/10">{data.adminUsers.map((admin) => <tr key={admin.membershipId}><td className="px-4 py-4"><p className="font-semibold">{admin.name || admin.email}</p><p className="mt-1 text-xs text-champagne/40">{admin.email}</p></td><td className="px-4 py-4"><select value={admin.role} disabled={working || !canManage} onChange={(event) => void onAction({ action: 'update_admin_role', membershipId: admin.membershipId, role: event.target.value, status: admin.status }, `${admin.email} role updated.`)} className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-sm">{WEWED_ADMIN_ROLES.map((role) => <option key={role} value={role}>{WEWED_ADMIN_ROLE_LABELS[role]}</option>)}</select></td><td className="px-4 py-4"><select value={admin.status} disabled={working || !canManage} onChange={(event) => void onAction({ action: 'update_admin_role', membershipId: admin.membershipId, role: admin.role, status: event.target.value }, `${admin.email} membership updated.`)} className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-sm"><option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option></select></td><td className="px-4 py-4"><Status value={admin.userActive ? 'active' : 'suspended'} /></td><td className="px-4 py-4 text-xs text-champagne/45">{date(admin.lastLoginAt)}</td></tr>)}</tbody></table></div></div><Card className="border-gold/15 bg-white/[0.035] text-champagne"><CardHeader><CardTitle className="text-lg">Role boundaries</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{Object.entries(WEWED_ADMIN_ROLE_LABELS).map(([role, label]) => <div key={role} className="rounded-xl border border-gold/10 bg-black/10 p-4"><p className="font-semibold">{label}</p><p className="mt-2 text-xs leading-5 text-champagne/45">{role === 'wewed_super_admin' ? 'Full platform control.' : role === 'wewed_operations_admin' ? 'Approvals, lifecycle, members, support and incidents.' : role === 'wewed_billing_admin' ? 'Billing, account read and analytics.' : role === 'wewed_support_admin' ? 'Support operations and limited incident visibility.' : 'Read-only analysis and audit visibility.'}</p></div>)}</CardContent></Card></>
}

function BillingSection({ accounts, payments, summary, working, canManage, onAction }: { accounts: BusinessAccount[]; payments: Payment[]; summary: Summary; working: boolean; canManage: boolean; onAction: ActionHandler }) {
  const billable = accounts.filter((account) => account.type !== 'wewed_internal')
  const [businessAccountId, setBusinessAccountId] = useState(billable[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState('paid')
  const [reference, setReference] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); const ok = await onAction({ action: 'record_payment', businessAccountId, amount: Number(amount), status, provider: 'manual', providerReference: reference }, 'Payment record saved.'); if (ok) { setAmount(''); setReference('') } }
  return <><div><p className="text-xs uppercase tracking-[0.2em] text-gold">Subscriptions and payments</p><h2 className="mt-2 text-3xl font-semibold">Billing operations</h2><p className="mt-2 text-sm text-champagne/55">Track payment exposure and subscription state. Stripe can attach to these records later.</p></div><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Paid revenue" value={money(summary.paidRevenueCents)} detail="All recorded paid transactions" icon={CircleDollarSign} /><MetricCard label="Pending exposure" value={money(summary.pendingRevenueCents)} detail="Pending or due transactions" icon={CreditCard} emphasis={summary.pendingRevenueCents ? 'warning' : 'normal'} /><MetricCard label="Active subscriptions" value={summary.activeSubscriptions} detail="Active and trialing accounts" icon={Building2} /></div>{canManage && <Card className="border-gold/20 bg-white/[0.045] text-champagne"><CardHeader><CardTitle className="text-lg">Record payment</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><select value={businessAccountId} onChange={(event) => setBusinessAccountId(event.target.value)} required className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">{billable.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><Input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount (USD)" required className="border-gold/20 bg-black/15" /><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="paid">Paid</option><option value="pending">Pending</option><option value="due">Due</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference" className="border-gold/20 bg-black/15" /><div className="flex justify-end md:col-span-2 xl:col-span-4"><Button type="submit" disabled={working || !businessAccountId || !amount} className="bg-gold text-espresso hover:bg-gold-light">{working ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}Save payment</Button></div></form></CardContent></Card>}<RecordList title="Recent payment records" empty="No payment records are visible." rows={payments.map((payment) => ({ id: payment.id, title: payment.businessAccountName, detail: `${payment.providerReference || payment.provider} · ${date(payment.createdAt)}`, trailing: <div className="flex items-center gap-3"><p className="font-semibold">{money(payment.amountCents, payment.currency)}</p><Status value={payment.status} /></div> }))} /></>
}

function SupportSection({ accounts, cases, working, canManage, onAction }: { accounts: BusinessAccount[]; cases: SupportCase[]; working: boolean; canManage: boolean; onAction: ActionHandler }) {
  const [businessAccountId, setBusinessAccountId] = useState(''); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [priority, setPriority] = useState('normal')
  async function submit(event: FormEvent) { event.preventDefault(); const ok = await onAction({ action: 'create_support_case', businessAccountId: businessAccountId || null, title, description, priority, category: 'support' }, 'Support case created.'); if (ok) { setTitle(''); setDescription(''); setPriority('normal') } }
  return <><div><p className="text-xs uppercase tracking-[0.2em] text-gold">Client assistance</p><h2 className="mt-2 text-3xl font-semibold">Support desk</h2><p className="mt-2 text-sm text-champagne/55">Track access issues, operational problems and account follow-up.</p></div>{canManage && <Card className="border-gold/20 bg-white/[0.045] text-champagne"><CardHeader><CardTitle className="text-lg">Create support case</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><select value={businessAccountId} onChange={(event) => setBusinessAccountId(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Platform / unassigned</option>{accounts.filter((account) => account.type !== 'wewed_internal').map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Case title" required className="border-gold/20 bg-black/15 md:col-span-2" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What happened and what needs to be done?" className="min-h-24 rounded-md border border-gold/20 bg-black/15 px-3 py-2 text-sm md:col-span-2" /><div className="flex justify-end md:col-span-2"><Button type="submit" disabled={working || !title.trim()} className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Create case</Button></div></form></CardContent></Card>}<div className="space-y-3">{cases.length ? cases.map((item) => <Card key={item.id} className="border-gold/15 bg-white/[0.035] text-champagne"><CardContent className="p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><Status value={item.priority} /><Status value={item.status} /></div><p className="mt-2 text-sm text-champagne/55">{item.description || 'No description provided.'}</p><p className="mt-2 text-xs text-champagne/35">{item.businessAccountName || 'Platform'} · {date(item.createdAt)}</p></div>{canManage && <select value={item.status} disabled={working} onChange={(event) => void onAction({ action: 'update_support_case', id: item.id, status: event.target.value }, 'Support case updated.')} className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-sm"><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>}</div></CardContent></Card>) : <Empty text="No support cases are visible." />}</div></>
}

function OperationsSection({ incidents, working, canManage, onAction }: { incidents: Incident[]; working: boolean; canManage: boolean; onAction: ActionHandler }) {
  const [title, setTitle] = useState(''); const [summary, setSummary] = useState(''); const [severity, setSeverity] = useState('minor')
  async function submit(event: FormEvent) { event.preventDefault(); const ok = await onAction({ action: 'create_incident', title, summary, severity }, 'Incident created.'); if (ok) { setTitle(''); setSummary(''); setSeverity('minor') } }
  return <><div><p className="text-xs uppercase tracking-[0.2em] text-gold">Platform operations</p><h2 className="mt-2 text-3xl font-semibold">Incidents and system activity</h2><p className="mt-2 text-sm text-champagne/55">Record service incidents and resolution progress without external monitoring tools.</p></div>{canManage && <Card className="border-gold/20 bg-white/[0.045] text-champagne"><CardHeader><CardTitle className="text-lg">Record incident</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Incident title" required className="border-gold/20 bg-black/15" /><select value={severity} onChange={(event) => setSeverity(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select><textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Impact, scope and current response" className="min-h-24 rounded-md border border-gold/20 bg-black/15 px-3 py-2 text-sm md:col-span-2" /><div className="flex justify-end md:col-span-2"><Button type="submit" disabled={working || !title.trim()} className="bg-gold text-espresso hover:bg-gold-light"><AlertTriangle className="size-4" />Create incident</Button></div></form></CardContent></Card>}<div className="space-y-3">{incidents.length ? incidents.map((incident) => <Card key={incident.id} className="border-gold/15 bg-white/[0.035] text-champagne"><CardContent className="p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{incident.title}</h3><Status value={incident.severity} /><Status value={incident.status} /></div><p className="mt-2 text-sm text-champagne/55">{incident.summary || 'No incident summary.'}</p><p className="mt-2 text-xs text-champagne/35">Started {date(incident.startedAt)}</p></div>{canManage && <select value={incident.status} disabled={working} onChange={(event) => void onAction({ action: 'update_incident', id: incident.id, status: event.target.value }, 'Incident updated.')} className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-sm"><option value="investigating">Investigating</option><option value="identified">Identified</option><option value="monitoring">Monitoring</option><option value="resolved">Resolved</option></select>}</div></CardContent></Card>) : <Empty text="No incidents are visible." />}</div></>
}

function AuditSection({ rows }: { rows: AuditRow[] }) {
  const [query, setQuery] = useState('')
  const filtered = rows.filter((row) => !query.trim() || `${row.action} ${row.businessAccountName || ''} ${row.actorEmail || ''} ${JSON.stringify(row.details)}`.toLowerCase().includes(query.toLowerCase()))
  return <><div><p className="text-xs uppercase tracking-[0.2em] text-gold">Accountability</p><h2 className="mt-2 text-3xl font-semibold">Audit log</h2><p className="mt-2 text-sm text-champagne/55">Structured history for lifecycle decisions, roles, billing, support and incident changes.</p></div><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search action, account, administrator or detail" className="border-gold/20 bg-white/[0.035] pl-10" /></div><div className="overflow-hidden rounded-2xl border border-gold/15 bg-white/[0.025]"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-gold/15 bg-black/15 text-[10px] uppercase tracking-[0.16em] text-champagne/45"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Account / resource</th><th className="px-4 py-3">Administrator</th><th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-gold/10">{filtered.map((row) => <tr key={row.id}><td className="px-4 py-4 text-xs text-champagne/40">{date(row.createdAt)}</td><td className="px-4 py-4 font-medium">{row.action.replaceAll('_', ' ')}</td><td className="px-4 py-4 text-champagne/65">{row.businessAccountName || row.resourceType}</td><td className="px-4 py-4 text-champagne/55">{row.actorEmail || 'System'}</td><td className="max-w-[420px] px-4 py-4 font-mono text-[11px] text-champagne/45">{JSON.stringify(row.details)}</td></tr>)}</tbody></table></div>{filtered.length === 0 && <p className="p-10 text-center text-sm text-champagne/45">No audit events match the search.</p>}</div></>
}

function RecordList({ title, empty, rows }: { title: string; empty: string; rows: Array<{ id: string; title: string; detail: string; trailing: React.ReactNode }> }) {
  return <Card className="border-gold/15 bg-white/[0.035] text-champagne"><CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader><CardContent className="space-y-3">{rows.length ? rows.map((row) => <div key={row.id} className="flex flex-col justify-between gap-3 rounded-xl border border-gold/10 bg-black/10 p-4 sm:flex-row sm:items-center"><div><p className="font-medium">{row.title}</p><p className="mt-1 text-xs text-champagne/40">{row.detail}</p></div>{row.trailing}</div>) : <Empty text={empty} />}</CardContent></Card>
}
