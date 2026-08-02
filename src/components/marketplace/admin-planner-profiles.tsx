'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { MarketplaceFrame, StatusPill } from '@/components/marketplace/marketplace-frame'
import { list, marketplaceFetch } from '@/components/marketplace/marketplace-types'

export function AdminPlannerProfiles() {
  return <DashboardAuthGate allowedRoles={['admin']} wrongRoleMessage="This review area is restricted to Wewed platform administrators." title="Planner profile review" description="Review public marketplace profiles without entering any wedding workspace." onClose={() => { window.location.href = '/admin' }}><AdminPlannerProfileContent /></DashboardAuthGate>
}

function AdminPlannerProfileContent() {
  const [profiles, setProfiles] = useState<Array<Record<string, unknown>>>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { const payload = await marketplaceFetch<{ profiles: Array<Record<string, unknown>> }>('/api/admin/planner-profiles'); setProfiles(payload.profiles) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load planner profiles.') }
  }, [])
  useEffect(() => { void load() }, [load])

  async function review(profileId: string, status: string) {
    setBusy(`${profileId}-${status}`); setError(null); setNotice(null)
    try {
      await marketplaceFetch('/api/admin/planner-profiles', { method: 'PATCH', body: JSON.stringify({ profileId, status, reviewNotes: notes[profileId] }) })
      setNotice(`Profile marked ${status.replaceAll('_', ' ')}.`); await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Review failed.') } finally { setBusy(null) }
  }

  return <MarketplaceFrame title="Planner profile governance" description="Publish only approved professional information. Profile review never grants the administrator wedding access and never changes Stripe or subscription state." backHref="/admin" actions={<Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="size-4" /> Refresh</Button>}>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mb-6 rounded-lg border p-3 text-sm ${error ? 'border-clay/30 bg-clay/10' : 'border-sage/30 bg-sage/10'}`}>{error || notice}</p>}
    <div className="space-y-5">{profiles.length === 0 && <p className="rounded-2xl border border-dashed border-gold/30 p-12 text-center">No planner profiles require review.</p>}{profiles.map((profile) => {
      const id = String(profile.id)
      return <Card key={id} className="border-gold/20 bg-champagne"><CardContent className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.14em] text-gold-muted">{String(profile.businessName ?? 'Planning business')}</p><h2 className="wewed-heading mt-1 text-2xl">{String(profile.displayName)}</h2><p className="mt-1 text-sm text-espresso/60">{String(profile.headline ?? '')}</p></div><StatusPill value={String(profile.status)} /></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]"><div><p className="whitespace-pre-wrap text-sm leading-6 text-espresso/70">{String(profile.bio ?? 'No biography supplied.')}</p><div className="mt-4 flex flex-wrap gap-2">{list(profile.services).map((value) => <span key={value} className="rounded-full bg-white/70 px-3 py-1 text-xs">{value}</span>)}</div><p className="mt-4 text-xs text-espresso/55">Areas: {list(profile.serviceAreas).join(', ') || 'Not supplied'} · Plan: {String(profile.subscriptionPlan ?? 'free')}</p></div><div><Textarea value={notes[id] ?? String(profile.reviewNotes ?? '')} onChange={(event) => setNotes((current) => ({ ...current, [id]: event.target.value }))} placeholder="Review notes shared with the planner" className="min-h-24 bg-white" /><div className="mt-3 flex flex-wrap gap-2">{String(profile.status) === 'submitted' && <><Button disabled={busy !== null} onClick={() => void review(id, 'published')} className="bg-espresso text-champagne"><ShieldCheck className="size-4" /> Publish</Button><Button disabled={busy !== null} variant="outline" onClick={() => void review(id, 'changes_requested')}>Request changes</Button><Button disabled={busy !== null} variant="ghost" onClick={() => void review(id, 'rejected')}>Reject</Button></>}{String(profile.status) === 'published' && <Button disabled={busy !== null} variant="destructive" onClick={() => void review(id, 'suspended')}>Suspend profile</Button>}</div></div></div>
      </CardContent></Card>
    })}</div>
  </MarketplaceFrame>
}
