'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Loader2, UserPlus, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { hasUnsavedPlannerForms } from '@/lib/planner-draft-guard'

interface WeddingSummary {
  id: string
  slug: string
  title: string
  date: string
  venue: string
  venueCity: string
  venueCountry: string
  coupleId: string
  membershipRole: 'admin' | 'owner' | 'planner' | 'coordinator' | 'viewer'
  membershipStatus: 'active' | 'invited'
  permissions: string[]
}

interface SessionPayload {
  success?: boolean
  authorized?: boolean
  activeWedding?: WeddingSummary
  weddings?: WeddingSummary[]
  error?: string
}

interface WeddingMember {
  id: string
  userId: string
  weddingId: string
  role: 'owner' | 'planner' | 'coordinator' | 'viewer'
  status: 'invited' | 'active' | 'revoked'
  permissions: string[] | null
  email: string
  name: string | null
  isActive: boolean
  acceptedAt: string | null
  revokedAt: string | null
}

const TEAM_ROLES: Array<{ value: WeddingMember['role']; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'planner', label: 'Planner' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'viewer', label: 'Viewer' },
]

function weddingDateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date)
}

function plannerRoot(): ParentNode | null {
  return document.querySelector('[data-planner-portal]')
}

export function WeddingContextControls() {
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [members, setMembers] = useState<WeddingMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState({
    email: '',
    name: '',
    role: 'planner' as WeddingMember['role'],
  })
  const [inviting, setInviting] = useState(false)

  const loadSession = useCallback(async () => {
    setLoadingSession(true)
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' })
      const payload = (await response.json()) as SessionPayload
      if (!response.ok || !payload.authorized || !payload.activeWedding) {
        setSession(null)
        return
      }
      setSession(payload)
    } catch {
      setSession(null)
    } finally {
      setLoadingSession(false)
    }
  }, [])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    const protectBrowserNavigation = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedPlannerForms(plannerRoot())) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectBrowserNavigation)
    return () => window.removeEventListener('beforeunload', protectBrowserNavigation)
  }, [])

  const activeWedding = session?.activeWedding
  const weddings = session?.weddings ?? []
  const canManageTeam = useMemo(
    () => activeWedding?.permissions.includes('*') === true,
    [activeWedding],
  )

  const loadMembers = useCallback(async () => {
    if (!canManageTeam) return
    setLoadingMembers(true)
    setError(null)
    try {
      const response = await fetch('/api/weddings/members', { cache: 'no-store' })
      const payload = (await response.json()) as {
        success?: boolean
        data?: WeddingMember[]
        error?: string
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load the wedding team.')
      }
      setMembers(payload.data ?? [])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load the wedding team.',
      )
    } finally {
      setLoadingMembers(false)
    }
  }, [canManageTeam])

  useEffect(() => {
    if (teamOpen) void loadMembers()
  }, [teamOpen, loadMembers])

  async function switchWedding(weddingId: string) {
    if (!weddingId || weddingId === activeWedding?.id) return

    if (
      hasUnsavedPlannerForms(plannerRoot()) &&
      !window.confirm(
        'You have unsaved planner changes. Discard them and switch weddings?',
      )
    ) {
      return
    }

    setSwitching(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/wedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId }),
        cache: 'no-store',
      })
      const payload = (await response.json()) as {
        success?: boolean
        activeWedding?: WeddingSummary
        error?: string
      }
      if (!response.ok || !payload.success || !payload.activeWedding) {
        throw new Error(payload.error || 'Unable to switch weddings.')
      }

      setSession((current) =>
        current ? { ...current, activeWedding: payload.activeWedding } : current,
      )
      setTeamOpen(false)
      setMembers([])
      window.dispatchEvent(
        new CustomEvent('wewed:wedding-switched', {
          detail: { weddingId: payload.activeWedding.id },
        }),
      )
    } catch (switchError) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : 'Unable to switch weddings.',
      )
    } finally {
      setSwitching(false)
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInviting(true)
    setError(null)
    try {
      const response = await fetch('/api/weddings/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invite),
        cache: 'no-store',
      })
      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to invite this team member.')
      }

      setInvite({ email: '', name: '', role: 'planner' })
      await loadMembers()
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : 'Unable to invite this team member.',
      )
    } finally {
      setInviting(false)
    }
  }

  async function updateMember(
    membershipId: string,
    update: { role?: WeddingMember['role']; status?: WeddingMember['status'] },
  ) {
    setSavingMemberId(membershipId)
    setError(null)
    try {
      const response = await fetch('/api/weddings/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId, ...update }),
        cache: 'no-store',
      })
      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to update this team member.')
      }
      await loadMembers()
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update this team member.',
      )
    } finally {
      setSavingMemberId(null)
    }
  }

  async function revokeMember(membershipId: string) {
    setSavingMemberId(membershipId)
    setError(null)
    try {
      const response = await fetch('/api/weddings/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId }),
        cache: 'no-store',
      })
      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to revoke this team member.')
      }
      await loadMembers()
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : 'Unable to revoke this team member.',
      )
    } finally {
      setSavingMemberId(null)
    }
  }

  if (loadingSession || !activeWedding) return null

  return (
    <>
      <div data-planner-wedding-context className="flex min-h-11 w-full items-center justify-center gap-2 border-b border-gold/15 bg-espresso/95 px-3 py-2 shadow-sm backdrop-blur-md sm:px-5">
        <CalendarDays className="hidden size-4 shrink-0 text-gold sm:block" />
        <div className="min-w-0">
          <label htmlFor="active-wedding" className="sr-only">
            Active wedding
          </label>
          <select
            id="active-wedding"
            value={activeWedding.id}
            disabled={switching || weddings.length < 2}
            onChange={(event) => void switchWedding(event.target.value)}
            className="w-[min(68vw,20rem)] truncate rounded-md border border-gold/20 bg-espresso px-2 py-1 font-sans text-xs text-champagne outline-none focus:border-gold disabled:cursor-default sm:max-w-72"
          >
            {weddings.map((wedding) => (
              <option key={wedding.id} value={wedding.id}>
                {wedding.title} · {weddingDateLabel(wedding.date)}
              </option>
            ))}
          </select>
        </div>
        {switching && <Loader2 className="size-3.5 animate-spin text-gold" />}
        {canManageTeam && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setTeamOpen(true)}
            className="h-7 gap-1 border-gold/25 bg-transparent px-2 font-sans text-[11px] text-champagne hover:bg-gold/10 hover:text-gold"
          >
            <Users className="size-3.5" />
            <span className="hidden md:inline">Team</span>
          </Button>
        )}
      </div>

      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[88vh] w-[94vw] max-w-3xl overflow-y-auto border-gold/25 bg-espresso p-0 text-champagne"
        >
          <DialogTitle className="sr-only">Wedding team</DialogTitle>
          <DialogDescription className="sr-only">
            Invite, assign, and revoke access for this wedding.
          </DialogDescription>

          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gold/15 bg-espresso/95 px-5 py-4 backdrop-blur-md">
            <div>
              <p className="wewed-monogram text-[10px] tracking-[0.25em] text-gold/75">
                {activeWedding.title}
              </p>
              <h2 className="wewed-heading mt-1 text-2xl text-champagne">Wedding Team</h2>
              <p className="mt-1 font-sans text-xs text-champagne/55">
                Invite planners and coordinators, then adjust or revoke access here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTeamOpen(false)}
              aria-label="Close team manager"
              className="inline-flex size-9 items-center justify-center rounded-full border border-gold/20 text-champagne/65 hover:bg-gold/10 hover:text-gold"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-6 p-5">
            <form
              onSubmit={inviteMember}
              className="rounded-xl border border-gold/15 bg-gold/[0.04] p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <UserPlus className="size-4 text-gold" />
                <h3 className="font-sans text-sm font-medium text-champagne">Invite a team member</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_9rem_auto]">
                <Input
                  type="email"
                  required
                  value={invite.email}
                  onChange={(event) =>
                    setInvite((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="planner@example.com"
                  className="border-gold/25 bg-espresso/60 text-champagne placeholder:text-champagne/30"
                />
                <Input
                  value={invite.name}
                  onChange={(event) =>
                    setInvite((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Name (optional)"
                  className="border-gold/25 bg-espresso/60 text-champagne placeholder:text-champagne/30"
                />
                <select
                  value={invite.role}
                  onChange={(event) =>
                    setInvite((current) => ({
                      ...current,
                      role: event.target.value as WeddingMember['role'],
                    }))
                  }
                  className="rounded-md border border-gold/25 bg-espresso/60 px-3 py-2 font-sans text-sm text-champagne outline-none focus:border-gold"
                >
                  {TEAM_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  disabled={inviting || !invite.email.trim()}
                  className="bg-gold text-espresso hover:bg-gold-light"
                >
                  {inviting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  Invite
                </Button>
              </div>
            </form>

            {error && (
              <p className="rounded-md border border-clay/35 bg-clay/10 px-3 py-2 font-sans text-xs text-clay-light">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-xs uppercase tracking-[0.18em] text-gold-muted">
                  Current access
                </h3>
                <span className="font-sans text-xs text-champagne/40">
                  {members.filter((member) => member.status !== 'revoked').length} active or invited
                </span>
              </div>

              {loadingMembers ? (
                <div className="flex items-center justify-center gap-2 py-10 font-sans text-sm text-champagne/55">
                  <Loader2 className="size-4 animate-spin text-gold" />
                  Loading team…
                </div>
              ) : (
                members.map((member) => {
                  const saving = savingMemberId === member.id
                  return (
                    <div
                      key={member.id}
                      className="grid gap-3 rounded-lg border border-gold/12 bg-champagne/[0.025] p-3 md:grid-cols-[1fr_9rem_7rem_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-sans text-sm text-champagne">
                          {member.name || member.email}
                        </p>
                        <p className="truncate font-sans text-xs text-champagne/45">
                          {member.email}
                        </p>
                      </div>
                      <select
                        value={member.role}
                        disabled={saving || member.status === 'revoked'}
                        onChange={(event) =>
                          void updateMember(member.id, {
                            role: event.target.value as WeddingMember['role'],
                          })
                        }
                        className="rounded-md border border-gold/20 bg-espresso px-2 py-1.5 font-sans text-xs text-champagne outline-none focus:border-gold disabled:opacity-50"
                      >
                        {TEAM_ROLES.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <span className="inline-flex w-fit items-center rounded-full border border-gold/20 px-2 py-1 font-sans text-[10px] uppercase tracking-[0.12em] text-gold-muted">
                        {member.status}
                      </span>
                      <div className="flex justify-end gap-2">
                        {saving && <Loader2 className="size-4 animate-spin self-center text-gold" />}
                        {member.status === 'revoked' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => void updateMember(member.id, { status: 'invited' })}
                            className="h-8 border-gold/25 bg-transparent text-xs text-champagne hover:bg-gold/10"
                          >
                            Reinvite
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => void revokeMember(member.id)}
                            className="h-8 border-clay/35 bg-transparent text-xs text-clay-light hover:bg-clay/10"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
