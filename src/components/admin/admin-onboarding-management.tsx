'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, RefreshCw, UserRoundCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Account = {
  id: string
  name: string
  type: string
  status: string
  onboardingStatus: string
  subscriptionPlan: string
  ownerEmail: string
  ownerName: string | null
  memberRole: string
  memberStatus: string
  applicantName: string | null
  applicantEmail: string
  requestedRole: string
  requestedPlan: string
}

type Wedding = {
  id: string
  title: string
  date: string
  venue: string
  coupleId: string
}

type Payload = {
  success: boolean
  error?: string
  accounts: Account[]
  weddings: Wedding[]
}

const typeLabels: Record<string, string> = {
  couple: 'Couple / wedding client',
  planning_company: 'Planning company',
  venue: 'Venue',
  vendor: 'Vendor',
  client: 'Other business client',
}

export function AdminOnboardingManagement() {
  const [data, setData] = useState<Payload | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/onboarding', { cache: 'no-store' })
      const payload = (await response.json()) as Payload
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load onboarding.')
      setData(payload)
      setSelectedId((current) => current && payload.accounts.some((item) => item.id === current)
        ? current
        : payload.accounts[0]?.id || '')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load onboarding.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const account = useMemo(
    () => data?.accounts.find((item) => item.id === selectedId) ?? null,
    [data, selectedId],
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!account) return

    const form = new FormData(event.currentTarget)
    const body: Record<string, unknown> = {
      action: 'complete_onboarding',
      accountId: account.id,
    }

    if (account.type === 'couple') {
      body.partner1 = form.get('partner1')
      body.partner2 = form.get('partner2')
      body.weddingTitle = form.get('weddingTitle')
      body.weddingDate = form.get('weddingDate')
      body.venue = form.get('venue')
      body.venueCity = form.get('venueCity')
      body.venueCountry = form.get('venueCountry')
    } else if (account.type === 'planning_company') {
      body.weddingId = form.get('weddingId')
    }

    setWorking(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/admin/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { success?: boolean; error?: string; marketplaceReady?: boolean }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Onboarding failed.')
      setNotice(account.type === 'planning_company'
        ? `${account.name} is active. A private planner profile is ready for the planner to complete and submit.`
        : `${account.name} now has a complete, linked workspace identity.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Onboarding failed.')
    } finally {
      setWorking(false)
    }
  }

  if (loading && !data) {
    return <main className="flex min-h-screen items-center justify-center bg-espresso text-champagne"><Loader2 className="size-8 animate-spin text-gold" /></main>
  }

  if (!data) {
    return <main className="flex min-h-screen items-center justify-center bg-espresso p-6 text-champagne"><Card className="max-w-lg border-red-300/25 bg-white/[0.04] text-champagne"><CardContent className="p-8 text-center"><UserRoundCheck className="mx-auto size-10 text-gold" /><h1 className="mt-4 text-2xl font-semibold">Onboarding unavailable</h1><p className="mt-3 text-sm text-champagne/60">{error}</p><Button onClick={() => void load()} className="mt-6 bg-gold text-espresso hover:bg-gold-light">Retry</Button></CardContent></Card></main>
  }

  return (
    <main className="min-h-screen bg-espresso px-5 py-24 text-champagne lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-gold">Controlled activation</p>
            <h1 className="mt-2 text-4xl font-semibold">Internal onboarding</h1>
            <p className="mt-2 max-w-3xl text-sm text-champagne/55">Turn an approved application into the minimum usable account. Planner marketplace activation no longer depends on already having a client wedding.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading || working} className="border-gold/25 text-gold hover:bg-gold/10"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>

        {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-300/25 bg-red-300/10 text-red-100' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'}`}>{error || notice}</div>}

        {data.accounts.length === 0 ? (
          <Card className="border-gold/15 bg-white/[0.035] text-champagne"><CardContent className="p-10 text-center"><CheckCircle2 className="mx-auto size-10 text-gold" /><h2 className="mt-4 text-xl font-semibold">No approved applications await onboarding</h2><p className="mt-2 text-sm text-champagne/50">New public applications first appear in the approval queue.</p></CardContent></Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <Card className="border-gold/15 bg-white/[0.035] text-champagne">
              <CardHeader><CardTitle className="text-lg">Approved applications</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.accounts.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-4 text-left transition ${selectedId === item.id ? 'border-gold/45 bg-gold/10' : 'border-gold/10 bg-black/10 hover:border-gold/25'}`}>
                    <p className="font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-champagne/45">{typeLabels[item.type] || item.type}</p>
                    <p className="mt-2 text-xs text-champagne/35">{item.applicantEmail} · {item.requestedPlan}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {account && (
              <Card className="border-gold/20 bg-white/[0.045] text-champagne">
                <CardHeader>
                  <CardTitle className="text-xl">Provision {account.name}</CardTitle>
                  <p className="text-sm text-champagne/50">Applicant: {account.applicantName || account.ownerName || account.ownerEmail} · requested role {account.requestedRole}</p>
                </CardHeader>
                <CardContent>
                  {!['couple', 'planning_company'].includes(account.type) ? (
                    <div className="rounded-xl border border-gold/25 bg-gold/[0.06] p-5 text-sm leading-6 text-champagne/70">The business record can remain approved, but login activation is intentionally blocked because Wewed does not yet have a supported {typeLabels[account.type] || account.type} portal role. This prevents the account from being mapped into a planner or couple workspace incorrectly.</div>
                  ) : (
                    <form key={account.id} onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                      {account.type === 'couple' ? (
                        <>
                          <Input name="partner1" placeholder="Partner one" required className="border-gold/20 bg-black/15" />
                          <Input name="partner2" placeholder="Partner two" required className="border-gold/20 bg-black/15" />
                          <Input name="weddingTitle" placeholder="Wedding title (optional)" className="border-gold/20 bg-black/15 md:col-span-2" />
                          <Input name="weddingDate" type="date" required className="border-gold/20 bg-black/15" />
                          <Input name="venue" placeholder="Venue" required className="border-gold/20 bg-black/15" />
                          <Input name="venueCity" placeholder="City" required className="border-gold/20 bg-black/15" />
                          <Input name="venueCountry" placeholder="Country" required className="border-gold/20 bg-black/15" />
                        </>
                      ) : (
                        <div className="md:col-span-2">
                          <label className="text-xs text-champagne/50">Existing client wedding <span className="text-champagne/35">optional</span><select name="weddingId" className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm text-champagne"><option value="">No wedding yet — activate planner marketplace only</option>{data.weddings.map((wedding) => <option key={wedding.id} value={wedding.id}>{wedding.title} · {new Date(wedding.date).toLocaleDateString()} · {wedding.venue}</option>)}</select></label>
                          <div className="mt-3 rounded-xl border border-gold/15 bg-black/10 p-4 text-xs leading-5 text-champagne/55">Choose a wedding only when there is already an approved client relationship to attach. Otherwise leave this blank. The planner can complete onboarding, build the professional profile and receive marketplace enquiries without wedding access. Normal appointment authorization can grant wedding access later.</div>
                        </div>
                      )}

                      <div className="rounded-xl border border-gold/15 bg-black/10 p-4 text-xs leading-5 text-champagne/50 md:col-span-2">{account.type === 'planning_company' ? 'This transaction activates the planner identity and business membership, marks onboarding complete, provisions a private draft PlannerProfile, and records an audit event. Wedding membership and business links are created only when an existing client wedding is explicitly selected.' : 'This single transaction creates the wedding, activates the application user and business membership, creates the wedding membership and business links, synchronizes the user profile, and records an audit event. A partial result is rolled back.'}</div>
                      <div className="flex justify-end md:col-span-2"><Button type="submit" disabled={working} className="bg-gold text-espresso hover:bg-gold-light">{working ? <Loader2 className="size-4 animate-spin" /> : <UserRoundCheck className="size-4" />}Complete onboarding</Button></div>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
