'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Membership = {
  id: string
  userId: string
  email: string
  name: string | null
  role: string
  status: string
  invitedByEmail: string | null
  acceptedAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}

type PlannerRelationship = {
  alignment:
    | 'aligned'
    | 'engagement_without_matching_workspace_membership'
    | 'workspace_membership_without_engagement'
    | 'none'
  activeWorkspaceMemberships: Membership[]
  engagement: {
    id: string
    plannerUserId: string | null
    plannerEmail: string | null
    plannerName: string | null
    membershipId: string | null
    status: string
    authorityBundle: string | null
    updatedAt: string
  } | null
}

type WeddingIdentity = {
  id: string
  title: string | null
  slug: string | null
  date: string | null
  memberships: Membership[]
  pendingInvitations: Membership[]
  activeOwners: Membership[]
  plannerRelationship: PlannerRelationship
}

type AccountIdentity = {
  id: string
  name: string
  slug: string
  status: string
  onboardingStatus: string
  owner: {
    userId: string | null
    email: string | null
    name: string | null
  }
  weddings: WeddingIdentity[]
}

type Payload = {
  success: boolean
  error?: string
  accounts?: AccountIdentity[]
}

function label(value: string) {
  return value.replaceAll('_', ' ')
}

function date(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function Badge({ value, tone = 'neutral' }: { value: string; tone?: 'neutral' | 'good' | 'warning' }) {
  const classes = tone === 'good'
    ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
    : tone === 'warning'
      ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
      : 'border-gold/20 bg-gold/[0.06] text-gold-light'

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${classes}`}>{label(value)}</span>
}

function PlannerDiagnostic({ relationship }: { relationship: PlannerRelationship }) {
  const aligned = relationship.alignment === 'aligned'
  const empty = relationship.alignment === 'none'

  return (
    <div className="rounded-xl border border-gold/10 bg-black/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {aligned ? <CheckCircle2 className="size-4 text-emerald-200" /> : empty ? <UsersRound className="size-4 text-champagne/45" /> : <AlertTriangle className="size-4 text-amber-200" />}
          <p className="text-sm font-medium">Planner relationship</p>
        </div>
        <Badge value={relationship.alignment} tone={aligned ? 'good' : empty ? 'neutral' : 'warning'} />
      </div>
      <div className="mt-3 grid gap-3 text-xs text-champagne/55 sm:grid-cols-2">
        <div>
          <p className="uppercase tracking-[0.12em] text-champagne/35">Workspace access</p>
          {relationship.activeWorkspaceMemberships.length ? relationship.activeWorkspaceMemberships.map((membership) => (
            <p key={membership.id} className="mt-1 break-all text-champagne/75">{membership.name || membership.email} · {membership.email}</p>
          )) : <p className="mt-1">No active planner membership</p>}
        </div>
        <div>
          <p className="uppercase tracking-[0.12em] text-champagne/35">Customer-facing engagement</p>
          {relationship.engagement ? <p className="mt-1 break-all text-champagne/75">{relationship.engagement.plannerName || relationship.engagement.plannerEmail || 'Planner not assigned'} · {label(relationship.engagement.status)}</p> : <p className="mt-1">No current PlannerEngagement</p>}
        </div>
      </div>
    </div>
  )
}

function WeddingReview({ wedding }: { wedding: WeddingIdentity }) {
  return (
    <div className="rounded-xl border border-gold/15 bg-white/[0.025] p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{wedding.title || wedding.slug || wedding.id}</p>
          <p className="mt-1 text-xs text-champagne/40">{wedding.slug || wedding.id}{wedding.date ? ` · ${date(wedding.date)}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge value={`${wedding.activeOwners.length} active owner${wedding.activeOwners.length === 1 ? '' : 's'}`} tone={wedding.activeOwners.length ? 'good' : 'warning'} />
          <Badge value={`${wedding.pendingInvitations.length} pending`} tone={wedding.pendingInvitations.length ? 'warning' : 'neutral'} />
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-gold/10 bg-black/10 p-3">
          <div className="flex items-center gap-2"><UserRoundCheck className="size-4 text-gold" /><p className="text-sm font-medium">Active wedding owners</p></div>
          <div className="mt-2 space-y-2">
            {wedding.activeOwners.length ? wedding.activeOwners.map((membership) => (
              <div key={membership.id} className="text-xs"><p className="text-champagne/80">{membership.name || membership.email}</p><p className="break-all text-champagne/45">{membership.email}</p></div>
            )) : <p className="text-xs text-amber-100/80">No active owner membership is recorded.</p>}
          </div>
        </div>
        <div className="rounded-xl border border-gold/10 bg-black/10 p-3">
          <div className="flex items-center gap-2"><UserRoundPlus className="size-4 text-gold" /><p className="text-sm font-medium">Pending wedding invitations</p></div>
          <div className="mt-2 space-y-2">
            {wedding.pendingInvitations.length ? wedding.pendingInvitations.map((membership) => (
              <div key={membership.id} className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="break-all text-champagne/80">{membership.email}</p><Badge value={membership.role} tone="warning" /></div>
                <p className="mt-1 text-champagne/40">Invited {date(membership.createdAt)}{membership.invitedByEmail ? ` by ${membership.invitedByEmail}` : ''}</p>
              </div>
            )) : <p className="text-xs text-champagne/45">No pending wedding invitations.</p>}
          </div>
        </div>
      </div>
      <div className="mt-3"><PlannerDiagnostic relationship={wedding.plannerRelationship} /></div>
    </div>
  )
}

export function AdminAccountIdentityReview() {
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<AccountIdentity[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/account-identity', { cache: 'no-store' })
      const payload = (await response.json()) as Payload
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load account identity diagnostics.')
      setAccounts(payload.accounts || [])
      setLoaded(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load account identity diagnostics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !loaded && !loading) void load()
  }, [load, loaded, loading, open])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return accounts
    return accounts.filter((account) => [
      account.name,
      account.slug,
      account.owner.name,
      account.owner.email,
      ...account.weddings.flatMap((wedding) => [wedding.title, wedding.slug, ...wedding.memberships.flatMap((membership) => [membership.name, membership.email])]),
    ].some((value) => value?.toLowerCase().includes(normalized)))
  }, [accounts, query])

  const pendingCount = accounts.reduce((total, account) => total + account.weddings.reduce((weddingTotal, wedding) => weddingTotal + wedding.pendingInvitations.length, 0), 0)
  const mismatchCount = accounts.reduce((total, account) => total + account.weddings.filter((wedding) => !['aligned', 'none'].includes(wedding.plannerRelationship.alignment)).length, 0)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-50 min-h-11 rounded-full border border-gold/35 bg-espresso px-4 text-champagne shadow-2xl hover:bg-espresso-light" aria-label="Open account identity review" data-admin-identity-review-trigger="true">
        <ShieldCheck className="size-4 text-gold" /><span className="hidden sm:inline">Account identity</span>
        {loaded && (pendingCount > 0 || mismatchCount > 0) && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-espresso">{pendingCount + mismatchCount}</span>}
      </Button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-sm" role="presentation" data-admin-identity-review="true">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close account identity review" onClick={() => setOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-labelledby="account-identity-title" className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-gold/20 bg-espresso text-champagne shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold"><ShieldCheck className="size-5" /></div>
                <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.2em] text-gold">Read-only account review</p><h2 id="account-identity-title" className="mt-1 text-lg font-semibold">Owner, onboarding, invitation and planner alignment</h2><p className="mt-1 text-xs leading-5 text-champagne/50">Wedding memberships are separate from business-account team memberships. This panel does not change access.</p></div>
              </div>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="min-h-11 min-w-11 shrink-0 border-gold/25 px-3 text-gold hover:bg-gold/10" aria-label="Close account identity review"><X className="size-4" /></Button>
            </header>
            <div className="flex shrink-0 gap-2 border-b border-gold/10 px-4 py-3 sm:px-6">
              <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search account, owner or invite email" className="min-h-11 border-gold/20 bg-black/15 pl-10" /></div>
              <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="min-h-11 min-w-11 border-gold/25 px-3 text-gold hover:bg-gold/10" aria-label="Refresh account identity review">{loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}</Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {error && <p className="rounded-xl border border-red-300/25 bg-red-300/10 px-3 py-2 text-sm text-red-100">{error}</p>}
              {!error && loading && !loaded && <div className="flex min-h-56 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold" /></div>}
              {!error && loaded && <div className="space-y-2">
                {filtered.map((account) => {
                  const accountPendingCount = account.weddings.reduce((total, wedding) => total + wedding.pendingInvitations.length, 0)
                  const accountMismatchCount = account.weddings.filter((wedding) => !['aligned', 'none'].includes(wedding.plannerRelationship.alignment)).length
                  return <details key={account.id} className="group rounded-xl border border-gold/12 bg-black/10" open={filtered.length === 1}>
                    <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
                      <div className="min-w-0"><p className="font-semibold">{account.name}</p><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-champagne/50"><span className="inline-flex items-center gap-1 break-all"><Mail className="size-3" />{account.owner.email || 'No account owner email'}</span><span>· {account.slug}</span></div></div>
                      <div className="flex flex-wrap items-center gap-2"><Badge value={account.status} tone={account.status === 'active' ? 'good' : 'warning'} /><Badge value={`onboarding ${account.onboardingStatus}`} tone={account.onboardingStatus === 'complete' ? 'good' : 'warning'} />{accountPendingCount > 0 && <Badge value={`${accountPendingCount} pending invite${accountPendingCount === 1 ? '' : 's'}`} tone="warning" />}{accountMismatchCount > 0 && <Badge value={`${accountMismatchCount} planner mismatch${accountMismatchCount === 1 ? '' : 'es'}`} tone="warning" />}<ChevronDown className="size-4 text-gold transition group-open:rotate-180" /></div>
                    </summary>
                    <div className="border-t border-gold/10 px-3 py-3 sm:px-4">
                      <div className="mb-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-gold/10 bg-white/[0.025] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-champagne/35">Account owner</p><p className="mt-1 text-sm font-medium">{account.owner.name || 'Name not set'}</p><p className="mt-1 break-all text-xs text-champagne/50">{account.owner.email || 'Email not assigned'}</p></div><div className="rounded-xl border border-gold/10 bg-white/[0.025] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-champagne/35">Lifecycle</p><p className="mt-1 text-sm font-medium">{label(account.status)}</p></div><div className="rounded-xl border border-gold/10 bg-white/[0.025] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-champagne/35">Onboarding</p><p className="mt-1 text-sm font-medium">{label(account.onboardingStatus)}</p></div></div>
                      <div className="space-y-3">{account.weddings.length ? account.weddings.map((wedding) => <WeddingReview key={wedding.id} wedding={wedding} />) : <p className="rounded-xl border border-dashed border-gold/15 p-4 text-sm text-champagne/45">No owned wedding link is recorded for this account.</p>}</div>
                    </div>
                  </details>
                })}
                {filtered.length === 0 && <p className="rounded-xl border border-dashed border-gold/15 p-5 text-center text-sm text-champagne/45">No couple account matches this search.</p>}
              </div>}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
