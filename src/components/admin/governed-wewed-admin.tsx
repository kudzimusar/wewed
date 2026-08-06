'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { logoutAdmin } from '@/lib/admin-auth'
import {
  CUSTOMER_PARTNER_ACCOUNT_TYPES,
  canTransitionAccount,
  isAccountLifecycleStatus,
  type AccountLifecycleStatus,
} from '@/lib/wewed-admin-policy'
import { WewedAdminConsole } from '@/components/admin/wewed-admin-console'

type Scope = {
  administratorUserId: string
  scopeType: string
  scopeValue: string
}

type GovernanceAccount = {
  id: string
  name: string
  slug: string
  type: string
  status: string
  ownerUserId: string | null
  ownerEmail: string | null
  ownerName: string | null
  onboardingStatus: string
  subscriptionPlan: string
  subscriptionStatus: string
  memberCount: number
  activeMemberCount: number
  weddingCount: number
  linkedEntityCount: number
  lastActivityAt: string
  createdAt: string
  updatedAt: string
  riskFlags: string[]
}

type PlatformAdministrator = {
  userId: string
  legacyMembershipId: string | null
  email: string
  name: string | null
  userActive: boolean
  lastLoginAt: string | null
  role: string
  membershipStatus: string
  statusReason: string | null
  invitationStatus: string | null
  invitedAt: string | null
  activatedAt: string | null
  suspendedAt: string | null
  revokedAt: string | null
  effectiveStatus: string
  version: number
  updatedAt: string
  scopes: Scope[]
}

type GovernancePayload = {
  success: true
  admin: {
    userId: string
    email: string
    role: string
    roleLabel: string
    permissions: string[]
    accountScope: {
      global: boolean
      accountTypes: string[]
      businessAccountIds: string[]
    }
    registrySource: string
    isSuperAdmin: boolean
  }
  accountTypeCounts: Record<string, number>
  accounts: GovernanceAccount[]
  administrators: PlatformAdministrator[]
  roles: string[]
  roleLabels: Record<string, string>
  permissionMatrix: Record<string, string[]>
  accountLifecycleStatuses: string[]
}

type Section = 'accounts' | 'administrators' | 'permissions' | 'operations'
type AccountCategory = 'external' | 'couple' | 'planning_company' | 'venue' | 'vendor' | 'client' | 'wewed_internal'

const categoryLabels: Record<AccountCategory, string> = {
  external: 'Customer & partner',
  couple: 'Couples',
  planning_company: 'Planners',
  venue: 'Venues',
  vendor: 'Vendors',
  client: 'Other clients',
  wewed_internal: 'Wewed internal',
}

const typeLabels: Record<string, string> = {
  wewed_internal: 'Wewed internal',
  planning_company: 'Planning company',
  couple: 'Couple / client',
  venue: 'Venue',
  vendor: 'Vendor',
  client: 'Business client',
}

const lifecycleLabels: Record<string, string> = {
  pending_review: 'Pending review',
  active: 'Active',
  rejected: 'Rejected',
  suspended: 'Suspended',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
  archived: 'Archived',
  invited: 'Invited',
  revoked: 'Revoked',
}

const riskLabels: Record<string, string> = {
  missing_owner: 'Missing owner',
  no_active_members: 'No active members',
  incomplete_onboarding: 'Onboarding incomplete',
  restricted_access: 'Access restricted',
  billing_attention: 'Billing attention',
  inactive_60_days: 'Inactive 60+ days',
}

function date(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function statusTone(value: string): string {
  if (['active', 'complete', 'published'].includes(value)) {
    return 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
  }
  if (['invited', 'pending_review', 'in_progress'].includes(value)) {
    return 'border-gold/35 bg-gold/10 text-gold-light'
  }
  if (['suspended', 'rejected', 'blocked', 'revoked', 'cancelled'].includes(value)) {
    return 'border-rose-400/35 bg-rose-400/10 text-rose-200'
  }
  return 'border-champagne/20 bg-white/[0.035] text-champagne/65'
}

function Status({ value, label }: { value: string; label?: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone(value)}`}>
      {label || lifecycleLabels[value] || value.replaceAll('_', ' ')}
    </span>
  )
}

function ScopeSummary({ administrator }: { administrator: PlatformAdministrator }) {
  const global = administrator.scopes.some((scope) => scope.scopeType === 'global')
  if (global) return <span>All platform accounts</span>
  const categories = administrator.scopes
    .filter((scope) => scope.scopeType === 'account_type')
    .map((scope) => typeLabels[scope.scopeValue] || scope.scopeValue)
  const explicit = administrator.scopes.filter((scope) => scope.scopeType === 'business_account').length
  return (
    <span>
      {categories.length ? categories.join(', ') : 'No category scope'}
      {explicit ? ` + ${explicit} explicit account${explicit === 1 ? '' : 's'}` : ''}
    </span>
  )
}

function AccountLifecycleDialog({
  account,
  working,
  onClose,
  onSubmit,
}: {
  account: GovernanceAccount
  working: boolean
  onClose: () => void
  onSubmit: (status: string, reason: string, note: string) => Promise<void>
}) {
  const options = isAccountLifecycleStatus(account.status)
    ? CUSTOMER_PARTNER_ACCOUNT_TYPES && [
        'pending_review',
        'active',
        'rejected',
        'suspended',
        'blocked',
        'cancelled',
        'archived',
      ].filter(
        (status) =>
          isAccountLifecycleStatus(status) &&
          canTransitionAccount(account.status as AccountLifecycleStatus, status),
      )
    : []
  const [status, setStatus] = useState(options[0] || '')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!status || !reason.trim()) return
    await onSubmit(status, reason.trim(), note.trim())
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Account lifecycle action">
      <Card className="w-full max-w-xl border-gold/25 bg-espresso text-champagne shadow-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gold">Audited lifecycle action</p>
              <CardTitle className="mt-2 text-xl">Update {account.name}</CardTitle>
            </div>
            <Button type="button" variant="outline" onClick={onClose} className="border-gold/20 text-gold">
              <X className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-xl border border-gold/15 bg-black/15 p-4 text-sm text-champagne/60">
              Current lifecycle: <strong className="text-champagne">{lifecycleLabels[account.status] || account.status}</strong>. Historical billing, support, membership, and audit data will be retained.
            </div>
            <label className="block text-xs text-champagne/55">
              New lifecycle status
              <select value={status} onChange={(event) => setStatus(event.target.value)} required className="mt-1 h-11 w-full rounded-md border border-gold/20 bg-black/20 px-3 text-sm text-champagne">
                {options.map((value) => <option key={value} value={value}>{lifecycleLabels[value] || value}</option>)}
              </select>
            </label>
            <label className="block text-xs text-champagne/55">
              Reason required
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={5} placeholder="Record the operational or compliance reason." className="mt-1 min-h-24 w-full rounded-md border border-gold/20 bg-black/20 px-3 py-2 text-sm text-champagne" />
            </label>
            <label className="block text-xs text-champagne/55">
              Internal follow-up note
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional next steps, evidence, or owner." className="mt-1 min-h-20 w-full rounded-md border border-gold/20 bg-black/20 px-3 py-2 text-sm text-champagne" />
            </label>
            {!options.length && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">No lifecycle transition is available from this state.</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="border-gold/20 text-gold">Cancel</Button>
              <Button type="submit" disabled={working || !status || !reason.trim()} className="bg-gold text-espresso hover:bg-gold-light">
                {working ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Confirm change
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function AdministratorCard({
  administrator,
  payload,
  working,
  onAction,
}: {
  administrator: PlatformAdministrator
  payload: GovernancePayload
  working: boolean
  onAction: (body: Record<string, unknown>, successMessage: string) => Promise<void>
}) {
  const [role, setRole] = useState(administrator.role)
  const [status, setStatus] = useState(administrator.membershipStatus === 'invited' ? 'suspended' : administrator.membershipStatus)
  const [reason, setReason] = useState('')
  const [accountTypes, setAccountTypes] = useState<string[]>(
    administrator.scopes
      .filter((scope) => scope.scopeType === 'account_type')
      .map((scope) => scope.scopeValue),
  )
  const canManage = payload.admin.isSuperAdmin
  const isSelf = payload.admin.userId === administrator.userId
  const isGlobal = administrator.scopes.some((scope) => scope.scopeType === 'global')

  function toggleAccountType(value: string) {
    setAccountTypes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    )
  }

  return (
    <Card className="border-gold/15 bg-white/[0.03] text-champagne">
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{administrator.name || administrator.email}</h3>
              <Status value={administrator.effectiveStatus} label={`Effective: ${lifecycleLabels[administrator.effectiveStatus] || administrator.effectiveStatus}`} />
              {isSelf && <span className="rounded-full border border-gold/25 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-gold">Your account</span>}
            </div>
            <p className="mt-1 text-sm text-champagne/45">{administrator.email}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gold/10 bg-black/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-champagne/35">Platform role</p>
                <p className="mt-1 text-sm font-medium">{payload.roleLabels[administrator.role] || administrator.role}</p>
              </div>
              <div className="rounded-xl border border-gold/10 bg-black/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-champagne/35">Membership</p>
                <div className="mt-1"><Status value={administrator.membershipStatus} /></div>
              </div>
              <div className="rounded-xl border border-gold/10 bg-black/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-champagne/35">Application identity</p>
                <div className="mt-1"><Status value={administrator.userActive ? 'active' : 'suspended'} label={administrator.userActive ? 'Active' : 'Inactive'} /></div>
              </div>
              <div className="rounded-xl border border-gold/10 bg-black/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-champagne/35">Last login</p>
                <p className="mt-1 text-xs text-champagne/65">{date(administrator.lastLoginAt)}</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-gold/10 bg-black/10 p-3 text-xs leading-5 text-champagne/55">
              <strong className="text-champagne">Account scope:</strong> <ScopeSummary administrator={administrator} />
              {administrator.statusReason && <p className="mt-1"><strong className="text-champagne">Last governance reason:</strong> {administrator.statusReason}</p>}
              {administrator.membershipStatus === 'invited' && <p className="mt-1 text-gold-light">Awaiting secure invitation acceptance. An inactive application identity is expected until acceptance.</p>}
            </div>
          </div>

          {canManage && (
            <div className="w-full space-y-3 rounded-xl border border-gold/15 bg-black/15 p-4 xl:max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Super Admin controls</p>
              <label className="block text-xs text-champagne/50">
                Required reason for any change
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this access change required?" className="mt-1 min-h-20 w-full rounded-md border border-gold/20 bg-espresso px-3 py-2 text-sm text-champagne" />
              </label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <select value={role} onChange={(event) => setRole(event.target.value)} disabled={working} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
                  {payload.roles.map((value) => <option key={value} value={value}>{payload.roleLabels[value] || value}</option>)}
                </select>
                <Button type="button" disabled={working || !reason.trim() || role === administrator.role || (isSelf && administrator.role === 'wewed_super_admin')} onClick={() => void onAction({ action: 'update_platform_admin_role', userId: administrator.userId, role, reason }, `${administrator.email} role updated.`)} className="bg-gold text-espresso hover:bg-gold-light">Apply role</Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <select value={status} onChange={(event) => setStatus(event.target.value)} disabled={working} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
                  <option value="active">Active / reinstate</option>
                  <option value="suspended">Suspended</option>
                  <option value="revoked">Revoked</option>
                </select>
                <Button type="button" disabled={working || !reason.trim() || status === administrator.membershipStatus || isSelf || (administrator.membershipStatus === 'invited' && status === 'active')} onClick={() => void onAction({ action: 'transition_platform_admin', userId: administrator.userId, status, reason }, `${administrator.email} access status updated.`)} className="bg-gold text-espresso hover:bg-gold-light">Apply status</Button>
              </div>
              {!isGlobal && (
                <div className="rounded-lg border border-gold/10 p-3">
                  <p className="text-xs font-medium">Account categories</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {CUSTOMER_PARTNER_ACCOUNT_TYPES.map((value) => (
                      <label key={value} className="flex items-center gap-2 text-xs text-champagne/60">
                        <input type="checkbox" checked={accountTypes.includes(value)} onChange={() => toggleAccountType(value)} className="accent-[#BF9B5F]" />
                        {typeLabels[value] || value}
                      </label>
                    ))}
                  </div>
                  <Button type="button" variant="outline" disabled={working || !reason.trim() || !accountTypes.length} onClick={() => void onAction({ action: 'replace_platform_admin_scopes', userId: administrator.userId, accountTypes, businessAccountIds: administrator.scopes.filter((scope) => scope.scopeType === 'business_account').map((scope) => scope.scopeValue), reason }, `${administrator.email} account scope updated.`)} className="mt-3 w-full border-gold/25 text-gold hover:bg-gold/10">Save scope</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function GovernedWewedAdminConsole() {
  const [data, setData] = useState<GovernancePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('accounts')
  const [category, setCategory] = useState<AccountCategory>('external')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedAccount, setSelectedAccount] = useState<GovernanceAccount | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/governance', { cache: 'no-store' })
      const payload = (await response.json()) as GovernancePayload & { error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load Admin governance.')
      setData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Admin governance.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function action(body: Record<string, unknown>, successMessage: string) {
    setWorking(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/admin/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'The governance action failed.')
      setNotice(successMessage)
      setSelectedAccount(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The governance action failed.')
    } finally {
      setWorking(false)
    }
  }

  const filteredAccounts = useMemo(() => {
    if (!data) return []
    const normalizedQuery = query.trim().toLowerCase()
    return data.accounts.filter((account) => {
      const categoryMatch = category === 'external'
        ? account.type !== 'wewed_internal'
        : account.type === category
      const statusMatch = statusFilter === 'all' || account.status === statusFilter
      const queryMatch = !normalizedQuery || [
        account.name,
        account.slug,
        account.ownerEmail || '',
        account.ownerName || '',
        typeLabels[account.type] || account.type,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
      return categoryMatch && statusMatch && queryMatch
    })
  }, [category, data, query, statusFilter])

  function categoryCount(value: AccountCategory): number {
    if (!data) return 0
    if (value === 'external') return data.accounts.filter((account) => account.type !== 'wewed_internal').length
    return data.accountTypeCounts[value] || 0
  }

  function signOut() {
    logoutAdmin()
    window.location.assign('/')
  }

  if (loading && !data) {
    return <div className="flex min-h-[70vh] items-center justify-center text-gold"><Loader2 className="size-8 animate-spin" /></div>
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center text-champagne">
        <AlertTriangle className="mx-auto size-10 text-rose-300" />
        <h1 className="mt-4 text-2xl font-semibold">Admin governance unavailable</h1>
        <p className="mt-2 text-sm text-champagne/55">{error}</p>
        <Button onClick={() => void load()} className="mt-6 bg-gold text-espresso"><RefreshCw className="size-4" />Retry</Button>
      </div>
    )
  }

  const categories: AccountCategory[] = [
    'external',
    'couple',
    'planning_company',
    'venue',
    'vendor',
    'client',
    ...(data.admin.isSuperAdmin ? ['wewed_internal' as const] : []),
  ]
  const sections: Array<{ id: Section; label: string; icon: typeof Building2; visible: boolean }> = [
    { id: 'accounts', label: 'Business accounts', icon: Building2, visible: true },
    { id: 'administrators', label: 'Platform administrators', icon: UserCog, visible: true },
    { id: 'permissions', label: 'Permission matrix', icon: LockKeyhole, visible: true },
    { id: 'operations', label: 'Full operations', icon: LayoutDashboard, visible: data.admin.permissions.includes('*') || data.admin.permissions.includes('admin.overview.read') },
  ]

  return (
    <div className="min-h-screen bg-espresso text-champagne">
      <header className="sticky top-0 z-40 border-b border-gold/15 bg-espresso/95 px-4 py-4 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold"><ShieldCheck className="size-6" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-gold">Wewed parent company</p>
              <h1 className="text-xl font-semibold">Governance & Business Admin</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right text-xs text-champagne/45">
              <p className="font-medium text-champagne/70">{data.admin.roleLabel}</p>
              <p>{data.admin.email}</p>
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-gold/25 text-gold hover:bg-gold/10"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
            <Button variant="outline" onClick={signOut} className="border-gold/25 text-gold hover:bg-gold/10">Sign out</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-gold/15 bg-white/[0.035] p-3 xl:sticky xl:top-28">
          <nav className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {sections.filter((item) => item.visible).map((item) => {
              const Icon = item.icon
              return (
                <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${section === item.id ? 'bg-gold text-espresso' : 'text-champagne/60 hover:bg-white/[0.05] hover:text-champagne'}`}>
                  <span className="flex items-center gap-3"><Icon className="size-4" />{item.label}</span>
                  <ChevronRight className="size-4" />
                </button>
              )
            })}
          </nav>
          <div className="mt-3 rounded-xl border border-gold/10 bg-black/10 p-4 text-xs leading-5 text-champagne/45">
            <p className="font-semibold uppercase tracking-[0.14em] text-gold">Effective access</p>
            <p className="mt-2">{data.admin.accountScope.global ? 'Global platform scope.' : `Scoped to ${data.admin.accountScope.accountTypes.length} account categories and ${data.admin.accountScope.businessAccountIds.length} explicit accounts.`}</p>
            {!data.admin.isSuperAdmin && <p className="mt-2">Wewed internal records and global traversal are restricted to Super Admin.</p>}
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          {error && <div className="rounded-xl border border-rose-400/35 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</div>}
          {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-400/10 p-4 text-sm text-emerald-100"><CheckCircle2 className="size-4" />{notice}</div>}

          {section === 'accounts' && (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gold">Account registry</p>
                  <h2 className="mt-2 text-3xl font-semibold">Business accounts by category</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-champagne/50">Couples, planners, venues, vendors, clients, and internal platform records are separated into clear operational populations. Only accounts inside your assigned scope are returned by the server.</p>
                </div>
                {data.admin.isSuperAdmin && <Button asChild className="bg-gold text-espresso hover:bg-gold-light"><Link href="/admin/onboarding"><UserPlus className="size-4" />Onboard business</Link></Button>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                {categories.map((value) => (
                  <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-2xl border p-4 text-left transition ${category === value ? 'border-gold/55 bg-gold/12' : 'border-gold/15 bg-white/[0.025] hover:border-gold/35'}`}>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-champagne/40">{categoryLabels[value]}</p>
                    <p className="mt-2 text-2xl font-semibold">{categoryCount(value)}</p>
                  </button>
                ))}
              </div>

              <div className="grid gap-3 rounded-2xl border border-gold/15 bg-white/[0.025] p-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <label className="relative block">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search account, owner, email, or category" className="border-gold/20 bg-black/15 pl-10 text-champagne" />
                </label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">
                  <option value="all">All lifecycle states</option>
                  {data.accountLifecycleStatuses.map((value) => <option key={value} value={value}>{lifecycleLabels[value] || value}</option>)}
                </select>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gold/15 bg-white/[0.025]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-left text-sm">
                    <thead className="border-b border-gold/15 bg-black/15 text-[10px] uppercase tracking-[0.16em] text-champagne/40">
                      <tr><th className="px-4 py-3">Account & category</th><th className="px-4 py-3">Lifecycle</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Weddings / links</th><th className="px-4 py-3">Onboarding</th><th className="px-4 py-3">Risk signals</th><th className="px-4 py-3">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gold/10">
                      {filteredAccounts.map((account) => (
                        <tr key={account.id} className="align-top">
                          <td className="px-4 py-4"><p className="font-semibold">{account.name}</p><p className="mt-1 text-xs text-champagne/40">{account.slug}</p><span className="mt-2 inline-flex rounded-full border border-gold/20 bg-gold/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-gold">{typeLabels[account.type] || account.type}</span></td>
                          <td className="px-4 py-4"><Status value={account.status} /></td>
                          <td className="px-4 py-4"><p>{account.ownerName || 'Not assigned'}</p><p className="mt-1 text-xs text-champagne/40">{account.ownerEmail || 'No owner email'}</p></td>
                          <td className="px-4 py-4"><p className="font-semibold">{account.activeMemberCount} <span className="font-normal text-champagne/35">/ {account.memberCount}</span></p><p className="mt-1 text-xs text-champagne/40">active / total</p></td>
                          <td className="px-4 py-4"><p>{account.weddingCount} weddings</p><p className="mt-1 text-xs text-champagne/40">{account.linkedEntityCount} linked entities</p></td>
                          <td className="px-4 py-4"><Status value={account.onboardingStatus} /></td>
                          <td className="px-4 py-4"><div className="flex max-w-[240px] flex-wrap gap-1.5">{account.riskFlags.length ? account.riskFlags.map((flag) => <span key={flag} className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-100">{riskLabels[flag] || flag}</span>) : <span className="text-xs text-champagne/35">No current signals</span>}</div></td>
                          <td className="px-4 py-4"><Button type="button" variant="outline" onClick={() => setSelectedAccount(account)} disabled={account.type === 'wewed_internal'} className="border-gold/25 text-gold hover:bg-gold/10">Manage lifecycle</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filteredAccounts.length && <div className="p-10 text-center text-sm text-champagne/40">No accounts match this category and filter.</div>}
              </div>
            </>
          )}

          {section === 'administrators' && (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gold">Named platform access</p>
                  <h2 className="mt-2 text-3xl font-semibold">Platform administrators</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-champagne/50">Every administrator has an individual identity, one governed platform role, a lifecycle state, and an explicit account scope. Membership and application identity are shown separately so the effective access state is never ambiguous.</p>
                </div>
                {data.admin.isSuperAdmin && <Button asChild className="bg-gold text-espresso hover:bg-gold-light"><Link href="/admin/roles"><UserPlus className="size-4" />Invite administrator</Link></Button>}
              </div>
              {!data.admin.isSuperAdmin && <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm text-champagne/60"><LockKeyhole className="mr-2 inline size-4 text-gold" />You can review your own effective role and scope. Only a Super Admin can invite administrators or change roles, statuses, and scopes.</div>}
              <div className="space-y-4">
                {data.administrators.map((administrator) => <AdministratorCard key={administrator.userId} administrator={administrator} payload={data} working={working} onAction={action} />)}
              </div>
            </>
          )}

          {section === 'permissions' && (
            <>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold">Least privilege</p>
                <h2 className="mt-2 text-3xl font-semibold">Role permission matrix</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-champagne/50">Role permissions are code-defined ceilings. Database permission arrays can no longer expand a role. Global traversal, administrator management, and scope management remain Super Admin-only.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {data.roles.map((role) => (
                  <Card key={role} className="border-gold/15 bg-white/[0.03] text-champagne">
                    <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="text-lg">{data.roleLabels[role] || role}</CardTitle>{role === 'wewed_super_admin' ? <KeyRound className="size-5 text-gold" /> : <LockKeyhole className="size-5 text-champagne/35" />}</div></CardHeader>
                    <CardContent><div className="flex flex-wrap gap-2">{data.permissionMatrix[role]?.map((permission) => <span key={permission} className={`rounded-full border px-2.5 py-1 text-[10px] ${permission.includes('platform_admins.manage') || permission.includes('scopes.manage') || permission === 'admin.overview.read' ? 'border-gold/30 bg-gold/10 text-gold-light' : 'border-champagne/15 bg-black/10 text-champagne/55'}`}>{permission}</span>)}</div></CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {section === 'operations' && (data.admin.permissions.includes('*') || data.admin.permissions.includes('admin.overview.read')) && (
            <div className="overflow-hidden rounded-2xl border border-gold/20">
              <div className="border-b border-gold/15 bg-gold/5 p-4 text-sm text-champagne/55"><UsersRound className="mr-2 inline size-4 text-gold" />Full cross-account operations are available only to Super Admin. Category and access governance should be performed in the dedicated sections above.</div>
              <WewedAdminConsole />
            </div>
          )}
        </main>
      </div>

      {selectedAccount && <AccountLifecycleDialog account={selectedAccount} working={working} onClose={() => setSelectedAccount(null)} onSubmit={(status, reason, note) => action({ action: 'transition_account', accountId: selectedAccount.id, status, reason, note }, `${selectedAccount.name} lifecycle updated.`)} />}
    </div>
  )
}
