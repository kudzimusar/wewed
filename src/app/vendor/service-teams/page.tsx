'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2, Plus, RefreshCw, Send, UsersRound } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Member {
  id: string
  name: string
  email: string | null
  phone: string | null
  function: string
  isLeader: boolean
  approved: boolean
  confirmed: boolean
  appActive: boolean
  nativePlatforms: string[]
  passState: string
  arrived: boolean
  missing: boolean
}

interface Team {
  id: string
  name: string
  company: string
  serviceCategory: string
  allowedCrew: number
  rosterStatus: string
  registered: number
  submitted: number
  approved: number
  confirmed: number
  appActive: number
  passReady: number
  arrived: number
  missing: number
  members: Member[]
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = await response.json()
  if (!response.ok || !payload.success) throw new Error(payload.error || 'Request failed.')
  return payload.data as T
}

export default function VendorServiceTeamsPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>([])
  const [busy, setBusy] = useState<string | null>('load')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy('load')
    try {
      setTeams(await request<Team[]>('/api/vendor/service-teams'))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your service roster.')
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function addMember(teamId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(`add-${teamId}`)
    try {
      await request(`/api/vendor/service-teams/${teamId}/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') || ''),
          email: String(form.get('email') || ''),
          phone: String(form.get('phone') || ''),
          function: String(form.get('function') || ''),
        }),
      })
      event.currentTarget.reset()
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add crew member.')
    } finally {
      setBusy(null)
    }
  }

  async function submit(teamId: string) {
    setBusy(`submit-${teamId}`)
    try {
      await request(`/api/vendor/service-teams/${teamId}/roster`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit roster.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <DashboardAuthGate
      allowedRoles={['vendor']}
      wrongRoleMessage="Only an approved Vendor account can manage a service-team roster."
      title="Service Team Roster"
      description="Manage only the wedding service teams where you are the designated leader."
      onClose={() => router.push('/vendor')}
    >
      <main className="min-h-dvh bg-ivory px-4 py-8 text-espresso sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link href="/vendor" className="inline-flex items-center gap-1 text-xs font-semibold text-gold-muted"><ArrowLeft className="size-4" />Vendor workspace</Link>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Named venue attendance</p>
              <h1 className="mt-2 font-serif text-4xl">Service team roster</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-espresso/60">
                Register each person who will enter the venue. Each approved person receives their own Guest identity, confirmation and Wedding Pass; plus-ones and children are not part of professional attendance.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={busy !== null}><RefreshCw className={`size-4 ${busy === 'load' ? 'animate-spin' : ''}`} />Refresh</Button>
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl border border-clay/30 bg-clay/10 p-3 text-sm">{error}</p>}

          <div className="mt-6 space-y-5">
            {busy === 'load' && teams.length === 0 && <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>}
            {!busy && teams.length === 0 && <div className="rounded-2xl border border-dashed border-gold/25 bg-white p-8 text-center"><UsersRound className="mx-auto size-8 text-gold-muted" /><p className="mt-3 font-serif text-xl">No leader rosters assigned</p><p className="mt-2 text-sm text-espresso/55">A Planner must designate your Wewed account as the leader of a service team before it appears here.</p></div>}
            {teams.map((team) => (
              <section key={team.id} className="rounded-3xl border border-gold/20 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><h2 className="font-serif text-2xl">{team.name}</h2><Badge variant="outline">{team.rosterStatus}</Badge></div><p className="mt-1 text-sm text-espresso/55">{team.company} · {team.serviceCategory}</p></div>
                  {team.rosterStatus === 'draft' && <Button type="button" onClick={() => void submit(team.id)} disabled={busy !== null} className="bg-espresso text-champagne"><Send className="size-4" />Submit roster</Button>}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                  {[
                    ['Allowed', team.allowedCrew], ['Registered', team.registered], ['Submitted', team.submitted], ['Approved', team.approved],
                    ['Confirmed', team.confirmed], ['App active', team.appActive], ['Pass ready', team.passReady], ['Arrived / missing', `${team.arrived} / ${team.missing}`],
                  ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-champagne/25 p-3 text-center"><p className="font-serif text-xl">{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-espresso/45">{label}</p></div>)}
                </div>

                {team.rosterStatus !== 'approved' && (
                  <form onSubmit={(event) => void addMember(team.id, event)} className="mt-4 grid gap-2 rounded-xl border border-gold/15 bg-ivory p-3 md:grid-cols-4">
                    <Input name="name" required placeholder="Crew member name" />
                    <Input name="email" type="email" placeholder="Email" />
                    <Input name="phone" placeholder="Phone" />
                    <Input name="function" required placeholder="Function / role" />
                    <div className="md:col-span-4 flex justify-end"><Button disabled={busy !== null}><Plus className="size-4" />Add named crew member</Button></div>
                  </form>
                )}

                <div className="mt-4 space-y-2">
                  {team.members.map((member) => (
                    <div key={member.id} className="grid gap-2 rounded-xl border border-gold/10 p-3 text-sm md:grid-cols-[minmax(0,1fr)_1fr_auto] md:items-center">
                      <div><strong>{member.name}</strong>{member.isLeader && <span className="ml-2 text-xs text-gold-muted">Team leader</span>}<p className="mt-1 text-xs text-espresso/45">{member.email || member.phone || 'No contact'}</p></div>
                      <div className="text-xs text-espresso/60">{member.function} · {member.confirmed ? 'Confirmed' : 'Awaiting RSVP'} · {member.appActive ? `App: ${member.nativePlatforms.join(' + ')}` : 'No app activation'} · Pass: {member.passState.replaceAll('_', ' ')}</div>
                      <div className="text-xs font-semibold">{member.arrived ? <span className="inline-flex items-center gap-1 text-sage"><CheckCircle2 className="size-4" />Arrived</span> : member.missing ? 'Missing' : 'Not due'}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </DashboardAuthGate>
  )
}
