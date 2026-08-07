'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock3,
  Layers3,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ACCOUNT_TYPES = [
  ['couple', 'Couples'],
  ['planning_company', 'Planners'],
  ['vendor', 'Vendors'],
  ['venue', 'Venues'],
  ['client', 'Clients'],
  ['wewed_internal', 'Wewed'],
] as const

const EMPLOYMENT_TYPES = ['employee', 'contractor', 'advisor'] as const
const EMPLOYMENT_STATUSES = ['active', 'leave', 'suspended', 'left'] as const

type Account = {
  id: string
  name: string
  slug: string
  type: string
  status: string
  onboardingStatus: string
  subscriptionStatus: string
  ownerEmail: string | null
  ownerName: string | null
  subtypeKey: string | null
  subtypeName: string | null
  segment: string | null
  classificationSource: string | null
  memberCount: number
  weddingCount: number
  departmentCount: number
  billingOfferCode: string | null
  billingOfferName: string | null
  billingProfileStatus: string | null
  providerCategories: string[]
  lastActivityAt: string
}

type QueueItem = {
  id: string
  businessAccountId: string | null
  accountName: string | null
  resourceType: string
  resourceId: string
  category: string
  priority: string
  status: string
  title: string
  summary: string
  assignedToUserId: string | null
  assignedToEmail: string | null
  departmentKey: string | null
  source: string
  dueAt: string | null
  createdAt: string
  projected: boolean
}

type Staff = {
  userId: string
  email: string
  name: string | null
  membershipRole: string
  membershipStatus: string
  departmentKey: string | null
  departmentName: string | null
  jobTitle: string | null
  employmentType: string | null
  employmentStatus: string | null
  managerUserId: string | null
  managerName: string | null
  platformRole: string | null
  platformStatus: string | null
  lastLoginAt: string | null
}

type Subtype = {
  subtypeKey: string
  accountType: string
  name: string
  description: string
  sortOrder: number
}

type Department = {
  departmentKey: string
  name: string
  description: string
  sortOrder: number
}

type Offer = {
  offerCode: string
  accountType: string
  name: string
  billingModel: string
  currency: string
  monthlyCents: number | null
  annualCents: number | null
  selfService: boolean
  status: string
  departmentKeys: unknown
  entitlements: unknown
}

type SavedView = {
  id: string
  name: string
  screen: string
  filters: Record<string, unknown>
  sort: Record<string, unknown>
  columns: string[]
  isDefault: boolean
  updatedAt: string
}

type Payload = {
  success: true
  admin: {
    userId: string
    email: string
    role: string
    isSuperAdmin: boolean
    canManageOperations: boolean
    canReadBilling: boolean
    accountScope: {
      global: boolean
      accountTypes: string[]
      businessAccountIds: string[]
    }
  }
  metrics: {
    totalScopedAccounts: number
    pendingReview: number
    onboardingAttention: number
    providerClaims: number
    providerVerification: number
    billingAttention: number
    highPrioritySupport: number
    plannerRelationshipMismatches: number
    missingProvisioning: number
  }
  accountTypeCounts: Record<string, number>
  accounts: Account[]
  queue: QueueItem[]
  internalStaff: Staff[]
  subtypes: Subtype[]
  departments: Department[]
  offers: Offer[]
  savedViews: SavedView[]
}

type Panel = 'overview' | 'accounts' | 'people' | 'commercial'

function human(value: string | null | undefined) {
  if (!value) return 'Not assigned'
  return value.replaceAll('_', ' ').replaceAll('-', ' ')
}

function shortDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function money(cents: number | null, currency: string) {
  if (cents === null) return 'Contract'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function tone(value: string) {
  if (['active', 'complete', 'free', 'verified', 'approved'].includes(value)) {
    return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
  }
  if (['pending_review', 'pending', 'invited', 'in_progress', 'trialing'].includes(value)) {
    return 'border-gold/30 bg-gold/10 text-gold-light'
  }
  if (['critical', 'blocked', 'suspended', 'revoked', 'past_due', 'unpaid', 'rejected'].includes(value)) {
    return 'border-rose-300/30 bg-rose-300/10 text-rose-100'
  }
  return 'border-champagne/15 bg-white/[0.035] text-champagne/65'
}

function Pill({ value, label }: { value: string; label?: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${tone(value)}`}>
      {label || human(value)}
    </span>
  )
}

function Metric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 sm:p-4 ${attention && value > 0 ? 'border-amber-300/25 bg-amber-300/[0.06]' : 'border-gold/12 bg-white/[0.025]'}`}>
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-champagne/45">{label}</p>
      <p className="mt-1 text-xl font-semibold sm:text-2xl">{value}</p>
    </div>
  )
}

function AccountDrawer({
  account,
  subtypes,
  canManage,
  onClose,
  onSaved,
}: {
  account: Account
  subtypes: Subtype[]
  canManage: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const available = subtypes.filter((item) => item.accountType === account.type)
  const [subtypeKey, setSubtypeKey] = useState(account.subtypeKey || '')
  const [segment, setSegment] = useState(account.segment || '')
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveClassification() {
    setWorking(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/command-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_account_classification',
          accountId: account.id,
          subtypeKey: subtypeKey || null,
          segment: segment.trim() || null,
          reason: reason.trim(),
        }),
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save classification.')
      await onSaved()
      setReason('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save classification.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/65 backdrop-blur-sm" role="presentation">
      <button className="absolute inset-0 cursor-default" aria-label="Close account overview" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-gold/20 bg-espresso text-champagne shadow-2xl" role="dialog" aria-modal="true" aria-label={`${account.name} account overview`}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.18em] text-gold">Account 360</p>
            <h3 className="mt-1 truncate text-xl font-semibold">{account.name}</h3>
            <p className="mt-1 truncate text-xs text-champagne/40">{account.slug}</p>
          </div>
          <Button variant="outline" onClick={onClose} className="min-h-11 min-w-11 shrink-0 border-gold/20 px-3 text-gold"><X className="size-4" /></Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-gold/10 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-champagne/35">Population</p><p className="mt-1 text-sm font-medium">{account.type === 'wewed_internal' ? 'Internal' : 'External'}</p></div>
            <div className="rounded-xl border border-gold/10 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-champagne/35">Account type</p><p className="mt-1 text-sm font-medium">{human(account.type)}</p></div>
            <div className="rounded-xl border border-gold/10 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-champagne/35">Subtype</p><p className="mt-1 text-sm font-medium">{account.subtypeName || 'Not assigned'}</p></div>
            <div className="rounded-xl border border-gold/10 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-champagne/35">Lifecycle</p><div className="mt-1"><Pill value={account.status} /></div></div>
          </div>

          <section className="mt-4 rounded-xl border border-gold/12 bg-white/[0.025] p-3 sm:p-4">
            <h4 className="text-sm font-semibold">Overview & people</h4>
            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <div><p className="text-champagne/35">Owner</p><p className="mt-1 break-all text-champagne/75">{account.ownerName || 'No owner name'} · {account.ownerEmail || 'No owner email'}</p></div>
              <div><p className="text-champagne/35">Team / weddings</p><p className="mt-1 text-champagne/75">{account.memberCount} business members · {account.weddingCount} wedding links</p></div>
              <div><p className="text-champagne/35">Onboarding</p><p className="mt-1 text-champagne/75">{human(account.onboardingStatus)}</p></div>
              <div><p className="text-champagne/35">Last activity</p><p className="mt-1 text-champagne/75">{shortDate(account.lastActivityAt)}</p></div>
            </div>
          </section>

          <section className="mt-3 rounded-xl border border-gold/12 bg-white/[0.025] p-3 sm:p-4">
            <h4 className="text-sm font-semibold">Services & systems</h4>
            <p className="mt-2 text-xs text-champagne/55">{account.departmentCount} enabled client departments in the Wewed systems/data/resource loop.</p>
            {!!account.providerCategories?.length && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {account.providerCategories.map((category) => <Pill key={category} value={category} />)}
              </div>
            )}
            <a href="/admin/client-operations" className="mt-3 inline-flex text-xs font-semibold text-gold hover:text-gold-light">Open client systems →</a>
          </section>

          <section className="mt-3 rounded-xl border border-gold/12 bg-white/[0.025] p-3 sm:p-4">
            <h4 className="text-sm font-semibold">Commercial</h4>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-champagne/55">
              <span>{account.billingOfferName || 'No billing offer'}</span>
              <Pill value={account.billingProfileStatus || account.subscriptionStatus} />
            </div>
          </section>

          <section className="mt-3 rounded-xl border border-gold/12 bg-white/[0.025] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">Classification</h4><Pill value={account.classificationSource || 'system'} /></div>
            {!canManage ? (
              <p className="mt-2 text-xs text-champagne/45">Your role can review classification but cannot change it.</p>
            ) : (
              <div className="mt-3 space-y-3">
                <label className="block text-[10px] text-champagne/50">Primary subtype
                  <select value={subtypeKey} onChange={(event) => setSubtypeKey(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-gold/20 bg-black/20 px-3 text-sm text-champagne">
                    <option value="">Not assigned</option>
                    {available.map((item) => <option key={item.subtypeKey} value={item.subtypeKey}>{item.name}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] text-champagne/50">Operational segment
                  <Input value={segment} onChange={(event) => setSegment(event.target.value)} placeholder="Optional controlled operational segment" className="mt-1 min-h-11 border-gold/20 bg-black/20" />
                </label>
                <label className="block text-[10px] text-champagne/50">Reason required
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is the classification changing?" className="mt-1 min-h-20 w-full rounded-md border border-gold/20 bg-black/20 px-3 py-2 text-sm text-champagne" />
                </label>
                {error && <p className="text-xs text-rose-100">{error}</p>}
                <Button onClick={() => void saveClassification()} disabled={working || reason.trim().length < 5} className="w-full bg-gold text-espresso hover:bg-gold-light sm:w-auto">
                  {working ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save classification
                </Button>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}

function StaffEditor({ staff, departments, onSaved }: { staff: Staff; departments: Department[]; onSaved: () => Promise<void> }) {
  const [departmentKey, setDepartmentKey] = useState(staff.departmentKey || '')
  const [jobTitle, setJobTitle] = useState(staff.jobTitle || '')
  const [employmentType, setEmploymentType] = useState(staff.employmentType || 'employee')
  const [employmentStatus, setEmploymentStatus] = useState(staff.employmentStatus || (staff.membershipStatus === 'active' ? 'active' : 'left'))
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setWorking(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/command-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_staff_profile',
          userId: staff.userId,
          departmentKey: departmentKey || null,
          jobTitle: jobTitle.trim() || null,
          employmentType,
          employmentStatus,
          managerUserId: staff.managerUserId,
          reason: reason.trim(),
        }),
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save staff profile.')
      setReason('')
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save staff profile.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <details className="rounded-xl border border-gold/12 bg-black/10">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{staff.name || staff.email}</p><p className="truncate text-[10px] text-champagne/40">{staff.departmentName || 'Department not assigned'} · {staff.jobTitle || 'Job title not assigned'}</p></div>
        <ChevronDown className="size-4 shrink-0 text-gold" />
      </summary>
      <div className="space-y-3 border-t border-gold/10 p-3">
        <div className="flex flex-wrap gap-1.5"><Pill value={staff.membershipStatus} label={`Workforce membership: ${human(staff.membershipStatus)}`} />{staff.platformRole ? <Pill value={staff.platformStatus || 'active'} label={`Platform admin: ${human(staff.platformRole)}`} /> : <Pill value="none" label="No platform admin access" />}</div>
        <select value={departmentKey} onChange={(event) => setDepartmentKey(event.target.value)} className="h-11 w-full rounded-md border border-gold/20 bg-espresso px-3 text-xs text-champagne"><option value="">Department not assigned</option>{departments.map((department) => <option key={department.departmentKey} value={department.departmentKey}>{department.name}</option>)}</select>
        <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Job title" className="min-h-11 border-gold/20 bg-espresso text-xs" />
        <div className="grid grid-cols-2 gap-2"><select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)} className="h-11 rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne">{EMPLOYMENT_TYPES.map((value) => <option key={value}>{value}</option>)}</select><select value={employmentStatus} onChange={(event) => setEmploymentStatus(event.target.value)} className="h-11 rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne">{EMPLOYMENT_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></div>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for workforce metadata change" className="min-h-16 w-full rounded-md border border-gold/20 bg-espresso px-3 py-2 text-xs text-champagne" />
        {error && <p className="text-xs text-rose-100">{error}</p>}
        <Button onClick={() => void save()} disabled={working || reason.trim().length < 5} className="min-h-11 bg-gold text-espresso hover:bg-gold-light">{working ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save workforce profile</Button>
      </div>
    </details>
  )
}

export function AdminCommandCentre() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('overview')
  const [query, setQuery] = useState('')
  const [accountType, setAccountType] = useState('all')
  const [subtype, setSubtype] = useState('all')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [viewName, setViewName] = useState('')
  const [savingView, setSavingView] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/command-center', { cache: 'no-store' })
      const payload = (await response.json()) as Payload & { error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load Admin command centre.')
      setData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Admin command centre.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const selectedAccount = data?.accounts.find((account) => account.id === selectedAccountId) || null
  const availableSubtypes = useMemo(() => data?.subtypes.filter((item) => accountType === 'all' || item.accountType === accountType) || [], [accountType, data])
  const filteredAccounts = useMemo(() => {
    if (!data) return []
    const normalized = query.trim().toLowerCase()
    return data.accounts.filter((account) => {
      if (accountType !== 'all' && account.type !== accountType) return false
      if (subtype !== 'all' && account.subtypeKey !== subtype) return false
      if (!normalized) return true
      return [account.name, account.slug, account.ownerEmail, account.ownerName, account.subtypeName, account.segment, ...account.providerCategories]
        .some((value) => value?.toLowerCase().includes(normalized))
    })
  }, [accountType, data, query, subtype])

  async function saveView() {
    if (!viewName.trim()) return
    setSavingView(true)
    try {
      const response = await fetch('/api/admin/command-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_view',
          name: viewName.trim(),
          screen: 'accounts',
          filters: { query, accountType, subtype },
          sort: {},
          columns: ['account','type','subtype','lifecycle','owner','billing'],
          isDefault: false,
        }),
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to save view.')
      setViewName('')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save view.')
    } finally {
      setSavingView(false)
    }
  }

  function applyView(view: SavedView) {
    const filters = view.filters || {}
    setQuery(typeof filters.query === 'string' ? filters.query : '')
    setAccountType(typeof filters.accountType === 'string' ? filters.accountType : 'all')
    setSubtype(typeof filters.subtype === 'string' ? filters.subtype : 'all')
    setPanel('accounts')
  }

  if (loading && !data) {
    return <section className="mx-auto flex min-h-36 max-w-[1500px] items-center justify-center px-4 text-gold sm:px-8"><Loader2 className="size-7 animate-spin" /></section>
  }

  if (!data) {
    return <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-8"><div className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error || 'Admin command centre is unavailable.'}</div></section>
  }

  const metricEntries = [
    ['Pending review', data.metrics.pendingReview, true],
    ['Onboarding', data.metrics.onboardingAttention, true],
    ['Provider claims', data.metrics.providerClaims, true],
    ['Verification', data.metrics.providerVerification, true],
    ['Billing attention', data.metrics.billingAttention, true],
    ['High-priority support', data.metrics.highPrioritySupport, true],
    ['Planner mismatches', data.metrics.plannerRelationshipMismatches, true],
    ['Provisioning gaps', data.metrics.missingProvisioning, true],
  ] as const

  return (
    <section className="admin-command-centre border-b border-gold/12 bg-espresso text-champagne" data-admin-command-centre="true">
      <div className="mx-auto max-w-[1500px] space-y-4 px-3 py-4 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-gold">Operational command centre</p>
            <h2 className="mt-1 text-xl font-semibold sm:text-2xl">Accounts, people, work, and commercial health</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-champagne/45">External customers and partners, Wewed workforce, and platform administrators remain separate populations. Every account result is server-scope filtered.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-11 min-w-11 shrink-0 border-gold/20 px-3 text-gold"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /><span className="hidden md:inline">Refresh</span></Button>
        </div>

        {error && <div className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-xs text-rose-100">{error}</div>}

        <nav className="grid grid-cols-4 gap-1 rounded-xl border border-gold/12 bg-black/15 p-1" aria-label="Command centre sections">
          {([
            ['overview', 'Home', Layers3],
            ['accounts', 'Accounts', Building2],
            ['people', 'People', UsersRound],
            ['commercial', 'Commercial', BadgeDollarSign],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setPanel(id)} className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold sm:flex-row sm:gap-2 sm:text-xs ${panel === id ? 'bg-gold text-espresso' : 'text-champagne/55 hover:bg-white/[0.04] hover:text-champagne'}`}><Icon className="size-4" /><span className="truncate">{label}</span></button>
          ))}
        </nav>

        {panel === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
              {metricEntries.map(([label, value, attention]) => <Metric key={label} label={label} value={value} attention={attention} />)}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-[9px] uppercase tracking-[0.18em] text-gold">Population map</p><h3 className="mt-0.5 text-sm font-semibold">Accounts by category</h3></div><span className="text-[10px] text-champagne/35">{data.metrics.totalScopedAccounts} scoped</span></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {ACCOUNT_TYPES.map(([type, label]) => (
                  <button key={type} type="button" onClick={() => { setAccountType(type); setSubtype('all'); setPanel('accounts') }} className="min-h-[72px] rounded-xl border border-gold/12 bg-white/[0.025] p-3 text-left hover:border-gold/35"><p className="text-[9px] uppercase tracking-[0.13em] text-champagne/40">{type === 'wewed_internal' ? 'Internal' : 'External'}</p><div className="mt-1 flex items-end justify-between gap-2"><p className="truncate text-xs font-semibold sm:text-sm">{label}</p><span className="text-xl font-semibold">{data.accountTypeCounts[type] || 0}</span></div></button>
                ))}
              </div>
            </div>

            <div id="admin-work-queue" className="rounded-xl border border-gold/12 bg-white/[0.025] p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] uppercase tracking-[0.18em] text-gold">My work queue</p><h3 className="mt-0.5 text-sm font-semibold">Highest-priority operational work</h3></div><span className="rounded-full border border-gold/15 px-2 py-1 text-[9px] text-champagne/45">{data.queue.length} items</span></div>
              {data.queue.length ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {data.queue.slice(0, 9).map((item) => (
                    <div key={item.id} className="rounded-lg border border-gold/10 bg-black/10 p-3">
                      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{item.title}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-champagne/45">{item.summary}</p></div><Pill value={item.priority} /></div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-champagne/35"><span className="truncate">{item.departmentKey ? human(item.departmentKey) : human(item.category)}</span><span className="shrink-0">{shortDate(item.createdAt)}</span></div>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 rounded-lg border border-dashed border-gold/15 p-4 text-center text-xs text-champagne/40">No scoped operational work is waiting.</p>}
            </div>
          </>
        )}

        {panel === 'accounts' && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
              <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/30" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search account, owner, service, subtype" className="min-h-11 border-gold/18 bg-black/15 pl-10 text-sm" /></div>
              <select value={accountType} onChange={(event) => { setAccountType(event.target.value); setSubtype('all') }} className="h-11 rounded-md border border-gold/18 bg-black/15 px-3 text-xs text-champagne"><option value="all">All account types</option>{ACCOUNT_TYPES.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select>
              <select value={subtype} onChange={(event) => setSubtype(event.target.value)} className="h-11 rounded-md border border-gold/18 bg-black/15 px-3 text-xs text-champagne"><option value="all">All subtypes</option>{availableSubtypes.map((item) => <option key={`${item.accountType}:${item.subtypeKey}`} value={item.subtypeKey}>{item.name}</option>)}</select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {data.savedViews.filter((view) => view.screen === 'accounts').map((view) => <button key={view.id} type="button" onClick={() => applyView(view)} className="rounded-full border border-gold/15 px-3 py-1.5 text-[10px] text-champagne/55 hover:border-gold/35 hover:text-champagne">{view.name}</button>)}
              <div className="flex min-w-[220px] flex-1 gap-2 sm:max-w-sm"><Input value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Save this view as…" className="min-h-10 border-gold/15 bg-black/10 text-xs" /><Button variant="outline" onClick={() => void saveView()} disabled={savingView || !viewName.trim()} className="min-h-10 shrink-0 border-gold/20 px-3 text-gold">{savingView ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}</Button></div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAccounts.slice(0, 120).map((account) => (
                <button key={account.id} type="button" onClick={() => setSelectedAccountId(account.id)} className="min-w-0 rounded-xl border border-gold/12 bg-white/[0.025] p-3 text-left hover:border-gold/35">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{account.name}</p><p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.12em] text-gold">{human(account.type)} · {account.subtypeName || 'Subtype not assigned'}</p></div><Pill value={account.status} /></div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-champagne/45"><span className="truncate">Owner: {account.ownerName || account.ownerEmail || 'Unassigned'}</span><span>Team: {account.memberCount}</span><span>Systems: {account.departmentCount}</span><span className="truncate">Billing: {account.billingOfferName || 'Missing'}</span></div>
                </button>
              ))}
            </div>
            {!filteredAccounts.length && <p className="rounded-xl border border-dashed border-gold/15 p-6 text-center text-xs text-champagne/40">No accounts match the current scoped filters.</p>}
          </div>
        )}

        {panel === 'people' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Wewed workforce records" value={data.internalStaff.length} />
              <Metric label="Platform admins" value={data.internalStaff.filter((staff) => staff.platformRole).length} />
              <Metric label="Department unassigned" value={data.internalStaff.filter((staff) => !staff.departmentKey).length} attention />
            </div>
            {!data.admin.isSuperAdmin ? (
              <div className="rounded-xl border border-gold/12 bg-white/[0.025] p-4 text-xs leading-5 text-champagne/50"><ShieldCheck className="mr-2 inline size-4 text-gold" />People & Organisation is restricted to Super Admin. Workforce metadata is deliberately separate from platform administrator authority.</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {data.internalStaff.map((staff) => <StaffEditor key={staff.userId} staff={staff} departments={data.departments} onSaved={load} />)}
              </div>
            )}
          </div>
        )}

        {panel === 'commercial' && (
          <div className="space-y-3">
            {!data.admin.canReadBilling ? <div className="rounded-xl border border-gold/12 p-4 text-xs text-champagne/50">Your role can see account lifecycle health but does not have the billing permission required to read the pricing catalog.</div> : (
              <>
                <div className="flex items-center gap-2 text-xs text-champagne/45"><BadgeDollarSign className="size-4 text-gold" />Pricing remains segmented by account type; contract offers are not presented as blanket self-service prices.</div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {data.offers.map((offer) => (
                    <div key={offer.offerCode} className="rounded-xl border border-gold/12 bg-white/[0.025] p-3">
                      <div className="flex items-start justify-between gap-2"><div><p className="text-[9px] uppercase tracking-[0.14em] text-gold">{human(offer.accountType)}</p><h3 className="mt-1 text-sm font-semibold">{offer.name}</h3></div><Pill value={offer.billingModel} /></div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg border border-gold/8 bg-black/10 p-2"><p className="text-[9px] text-champagne/35">Monthly</p><p className="mt-1 font-medium">{money(offer.monthlyCents, offer.currency)}</p></div><div className="rounded-lg border border-gold/8 bg-black/10 p-2"><p className="text-[9px] text-champagne/35">Annual</p><p className="mt-1 font-medium">{money(offer.annualCents, offer.currency)}</p></div></div>
                      <p className="mt-2 text-[10px] text-champagne/40">{offer.selfService ? 'Self-service eligible' : 'Controlled / contract activation'}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {selectedAccount && <AccountDrawer account={selectedAccount} subtypes={data.subtypes} canManage={data.admin.canManageOperations} onClose={() => setSelectedAccountId(null)} onSaved={load} />}
    </section>
  )
}