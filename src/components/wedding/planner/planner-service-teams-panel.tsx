'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, Plus, RefreshCw, RotateCcw, Send, ShieldCheck, UsersRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface EngagementOption {
  id: string
  serviceCategory: string
  vendorName: string
}

interface ServiceMember {
  id: string
  guestId: string
  name: string
  email: string | null
  phone: string | null
  participantType: string
  company: string
  serviceCategory: string
  function: string
  isLeader: boolean
  submitted: boolean
  approved: boolean
  confirmed: boolean
  appActive: boolean
  nativePlatforms: string[]
  passState: string
  passReady: boolean
  arrived: boolean
  missing: boolean
}

interface ServiceTeam {
  id: string
  name: string
  company: string
  serviceCategory: string
  allowedCrew: number
  rosterStatus: string
  serviceEngagementId: string
  leader: { id: string; email: string; name: string | null } | null
  registered: number
  submitted: number
  approved: number
  confirmed: number
  appActive: number
  passReady: number
  arrived: number
  missing: number
  members: ServiceMember[]
}

interface Payload {
  engagements: EngagementOption[]
  teams: ServiceTeam[]
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = await response.json()
  if (!response.ok || !payload.success) throw new Error(payload.error || 'Request failed.')
  return payload.data as T
}

function metric(label: string, value: number | string) {
  return <div className="rounded-xl border border-gold/10 bg-espresso/45 p-3 text-center"><p className="font-serif text-xl">{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-champagne/45">{label}</p></div>
}

export function PlannerServiceTeamsPanel() {
  const [payload, setPayload] = useState<Payload>({ engagements: [], teams: [] })
  const [busy, setBusy] = useState<string | null>('load')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy('load')
    try {
      setPayload(await json<Payload>('/api/planner/service-teams'))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load service teams.')
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setBusy('create')
    try {
      await json('/api/planner/service-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceEngagementId: String(form.get('engagementId') || ''),
          name: String(form.get('name') || ''),
          allowedCrew: Number(form.get('allowedCrew') || 1),
          leaderEmail: String(form.get('leaderEmail') || ''),
        }),
      })
      formElement.reset()
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create service team.')
    } finally {
      setBusy(null)
    }
  }

  async function addMember(teamId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setBusy(`member-${teamId}`)
    try {
      await json(`/api/planner/service-teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') || ''),
          email: String(form.get('email') || ''),
          phone: String(form.get('phone') || ''),
          function: String(form.get('function') || ''),
          isLeader: form.get('isLeader') === 'on',
        }),
      })
      formElement.reset()
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add crew member.')
    } finally {
      setBusy(null)
    }
  }

  async function action(teamId: string, name: 'submit' | 'approve' | 'reopen') {
    setBusy(`${name}-${teamId}`)
    try {
      await json(`/api/planner/service-teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: name }),
      })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update roster.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section data-testid="planner-service-teams" className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70">Event-day service attendance</p>
          <h3 className="mt-1 font-serif text-xl">Service provider teams</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-champagne/50">
            Every crew member is a named canonical Guest with their own RSVP, native activation, WW2 Wedding Pass and Gate arrival record.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={busy !== null} className="border-gold/25 bg-transparent">
          <RefreshCw className={`size-4 ${busy === 'load' ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-clay/30 bg-clay/10 p-3 text-xs text-clay-light">{error}</p>}

      <form onSubmit={createTeam} className="mt-4 grid gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3 md:grid-cols-4">
        <div><Label>Service engagement</Label><select name="engagementId" required className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Choose engagement</option>{payload.engagements.map((row) => <option key={row.id} value={row.id}>{row.vendorName} · {row.serviceCategory}</option>)}</select></div>
        <div><Label>Team name</Label><Input name="name" placeholder="Photography crew" className="mt-1 border-gold/20 bg-espresso/70" /></div>
        <div><Label>Allowed crew</Label><Input name="allowedCrew" type="number" min={1} max={500} defaultValue={1} className="mt-1 border-gold/20 bg-espresso/70" /></div>
        <div><Label>Leader account email</Label><Input name="leaderEmail" type="email" placeholder="leader@example.com" className="mt-1 border-gold/20 bg-espresso/70" /></div>
        <div className="md:col-span-4 flex justify-end"><Button disabled={busy !== null} className="bg-gold text-espresso"><Plus className="size-4" />Create service team</Button></div>
      </form>

      <div className="mt-4 space-y-4">
        {payload.teams.length === 0 && <p className="rounded-xl border border-dashed border-gold/15 p-6 text-center text-xs text-champagne/50">No service teams registered yet.</p>}
        {payload.teams.map((team) => (
          <article key={team.id} className="rounded-2xl border border-gold/12 bg-espresso/35 p-4" data-testid={`service-team-${team.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h4 className="font-serif text-lg">{team.name}</h4><Badge variant="outline">{team.rosterStatus}</Badge></div>
                <p className="mt-1 text-xs text-champagne/55">{team.company} · {team.serviceCategory}</p>
                <p className="mt-1 text-[11px] text-champagne/45">Leader: {team.leader?.name || team.leader?.email || 'Not assigned'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {team.rosterStatus === 'draft' && <Button size="sm" variant="outline" onClick={() => void action(team.id, 'submit')} disabled={busy !== null}><Send className="size-4" />Submit</Button>}
                {team.rosterStatus === 'submitted' && <Button size="sm" onClick={() => void action(team.id, 'approve')} disabled={busy !== null} className="bg-gold text-espresso"><ShieldCheck className="size-4" />Approve</Button>}
                {team.rosterStatus === 'approved' && <Button size="sm" variant="outline" onClick={() => void action(team.id, 'reopen')} disabled={busy !== null}><RotateCcw className="size-4" />Reopen</Button>}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
              {metric('Allowed crew', team.allowedCrew)}
              {metric('Registered', team.registered)}
              {metric('Submitted', team.submitted)}
              {metric('Approved', team.approved)}
              {metric('Confirmed', team.confirmed)}
              {metric('App active', team.appActive)}
              {metric('Pass ready', team.passReady)}
              {metric('Arrived / missing', `${team.arrived} / ${team.missing}`)}
            </div>

            <form onSubmit={(event) => void addMember(team.id, event)} className="mt-3 grid gap-2 rounded-xl border border-gold/10 p-3 md:grid-cols-5">
              <Input name="name" required placeholder="Crew member name" className="border-gold/20 bg-espresso/70" />
              <Input name="email" type="email" placeholder="Email" className="border-gold/20 bg-espresso/70" />
              <Input name="phone" placeholder="Phone" className="border-gold/20 bg-espresso/70" />
              <Input name="function" required placeholder="Function e.g. Lead photographer" className="border-gold/20 bg-espresso/70" />
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="isLeader" />Team leader</label>
              <div className="md:col-span-5 flex justify-end"><Button size="sm" disabled={busy !== null}><Plus className="size-4" />Register named crew</Button></div>
            </form>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="text-[9px] uppercase tracking-wider text-champagne/40"><tr><th className="py-2">Person</th><th>Function</th><th>Approved</th><th>Confirmed</th><th>App</th><th>Wedding Pass</th><th>Arrival</th></tr></thead>
                <tbody>{team.members.map((member) => <tr key={member.id} className="border-t border-gold/10"><td className="py-2"><strong>{member.name}</strong><span className="ml-2 text-champagne/40">{member.isLeader ? 'Leader' : ''}</span><div className="text-[10px] text-champagne/40">{member.email || member.phone || 'No contact'}</div></td><td>{member.function}</td><td>{member.approved ? 'Yes' : 'No'}</td><td>{member.confirmed ? 'Yes' : 'Awaiting'}</td><td>{member.appActive ? member.nativePlatforms.join(' + ') : 'No'}</td><td>{member.passState.replaceAll('_', ' ')}</td><td>{member.arrived ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3" />Arrived</span> : member.confirmed ? 'Missing' : '—'}</td></tr>)}</tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
