'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { BriefcaseBusiness, CheckCircle2, Eye, EyeOff, Loader2, Lock, LogOut, Mail, Save } from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
  ['venue', 'Venue'],
  ['photography', 'Photography'],
  ['florals', 'Florals'],
  ['catering', 'Catering'],
  ['entertainment', 'Entertainment'],
  ['decor-rentals', 'Décor & rentals'],
  ['beauty', 'Beauty'],
  ['transport', 'Transport'],
  ['stationery', 'Stationery'],
  ['other', 'Other wedding service'],
] as const
const SERVICE_AREAS = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Victoria Falls', 'Nationwide', 'Regional / destination']
const SERVICES = ['Venue hire', 'Photography', 'Videography', 'Florals', 'Catering', 'Entertainment', 'Décor', 'Rentals', 'Beauty', 'Transport', 'Stationery', 'Accommodation', 'Other']

type ProviderProfile = {
  displayName: string
  headline: string
  description: string
  category: string
  serviceAreas: string[]
  services: string[]
  website: string
  phone: string
  imageUrl: string
  visibility: 'draft' | 'published'
}
type ProviderPayload = {
  success?: boolean
  error?: string
  business?: { id: string; name: string; slug: string; type: 'venue' | 'vendor' }
  profile?: ProviderProfile
}
type State = 'checking' | 'signed-out' | 'ready' | 'unavailable'

function withCurrent(options: readonly string[], current: string[]): string[] {
  return Array.from(new Set([...options, ...current])).filter(Boolean)
}

export function ProviderProfileManager() {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<State>('checking')
  const [payload, setPayload] = useState<ProviderPayload | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState('checking')
    setError(null)
    try {
      const response = await fetch('/api/providers/profile', { cache: 'no-store', credentials: 'same-origin' })
      const nextPayload = await response.json() as ProviderPayload
      if (response.status === 401) {
        setPayload(null)
        setState('signed-out')
        return
      }
      if (!response.ok || !nextPayload.profile || !nextPayload.business) {
        setPayload(nextPayload)
        setError(nextPayload.error || 'This account does not have an active provider business.')
        setState('unavailable')
        return
      }
      setPayload(nextPayload)
      setState('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the provider profile.')
      setState('unavailable')
    }
  }, [])

  useState(() => { void load() })

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) {
      setError(signInError.message)
      setBusy(false)
      return
    }
    setPassword('')
    await load()
    setBusy(false)
  }

  async function signOut() {
    setBusy(true)
    await Promise.allSettled([
      supabase.auth.signOut(),
      fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin' }),
    ])
    setPayload(null)
    setState('signed-out')
    setBusy(false)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    const form = new FormData(event.currentTarget)
    const body = {
      ...Object.fromEntries(form.entries()),
      serviceAreas: form.getAll('serviceAreas'),
      services: form.getAll('services'),
    }
    try {
      const response = await fetch('/api/providers/profile', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const nextPayload = await response.json() as ProviderPayload
      if (!response.ok) throw new Error(nextPayload.error || 'Unable to save the profile.')
      setNotice(body.visibility === 'published' ? 'Profile saved and published in the provider directory.' : 'Profile saved as a private draft.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicPlatformShell>
      <section className="relative isolate overflow-hidden bg-espresso px-4 py-14 text-champagne sm:px-6 sm:py-18">
        <img src="/media/wewed-couple-planning.svg" alt="" className="absolute inset-0 size-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(26,20,16,0.99),rgba(26,20,16,0.82),rgba(26,20,16,0.68))]" />
        <div className="relative mx-auto max-w-5xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Provider business centre</p><h1 className="mt-4 font-serif text-5xl sm:text-6xl">Manage your public company profile.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-champagne/70">This workspace is only for approved venue and vendor business members. Publishing a company profile never exposes private wedding records.</p></div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {state === 'checking' && <div className="flex min-h-72 items-center justify-center"><Loader2 className="size-8 animate-spin text-gold-muted" /></div>}

        {state === 'signed-out' && (
          <div className="mx-auto max-w-md rounded-3xl border border-gold/20 bg-white p-7 shadow-xl">
            <div className="text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-full bg-espresso text-gold"><Lock className="size-6" /></span><h2 className="mt-4 font-serif text-3xl">Provider sign in</h2><p className="mt-2 text-sm leading-6 text-espresso/58">Use the Supabase identity attached to an approved Wewed venue or vendor account.</p></div>
            <form onSubmit={signIn} className="mt-7 space-y-4">
              <label className="block text-xs font-semibold text-espresso/70">Email<div className="relative mt-1.5"><Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold-muted" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="h-11 w-full rounded-xl border border-gold/25 bg-ivory pl-10 pr-3 text-sm" /></div></label>
              <label className="block text-xs font-semibold text-espresso/70">Password<div className="relative mt-1.5"><Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold-muted" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="h-11 w-full rounded-xl border border-gold/25 bg-ivory pl-10 pr-10 text-sm" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gold-muted">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
              {error && <p role="alert" className="rounded-xl border border-clay/30 bg-clay/10 px-3 py-2 text-sm">{error}</p>}
              <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-espresso disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}Sign in securely</button>
            </form>
            <p className="mt-5 text-center text-xs text-espresso/50">Not approved yet? <Link href="/register?accountType=vendor" className="font-semibold text-gold-muted">Register your business</Link></p>
          </div>
        )}

        {state === 'unavailable' && (
          <div className="rounded-3xl border border-gold/20 bg-champagne p-8 text-center"><BriefcaseBusiness className="mx-auto size-8 text-gold-muted" /><h2 className="mt-4 font-serif text-3xl">Provider workspace unavailable</h2><p role="alert" className="mx-auto mt-3 max-w-xl text-sm leading-6 text-espresso/60">{error}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/register?accountType=vendor" className="rounded-full bg-espresso px-5 py-2.5 text-sm font-semibold text-champagne">Register a provider account</Link><button type="button" onClick={() => void signOut()} className="rounded-full border border-gold/30 px-5 py-2.5 text-sm font-semibold text-gold-muted">Use another account</button></div></div>
        )}

        {state === 'ready' && payload?.profile && payload.business && (
          <div className="grid gap-7 lg:grid-cols-[1fr_18rem]">
            <form key={`${payload.business.id}-${payload.profile.visibility}`} onSubmit={save} className="space-y-5 rounded-3xl border border-gold/20 bg-white p-7 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">{payload.business.type === 'venue' ? 'Venue account' : 'Vendor account'}</p><h2 className="mt-2 font-serif text-3xl">{payload.business.name}</h2></div><button type="button" onClick={() => void signOut()} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-gold/25 px-4 py-2 text-xs font-semibold text-espresso/65"><LogOut className="size-3.5" />Sign out</button></div>
              {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-clay/30 bg-clay/10' : 'border-sage/30 bg-sage/10'}`}>{error || notice}</p>}
              <label className="block text-xs font-semibold text-espresso/70">Public company name<input name="displayName" defaultValue={payload.profile.displayName} required className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm" /></label>
              <label className="block text-xs font-semibold text-espresso/70">Headline<input name="headline" defaultValue={payload.profile.headline} className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm" /></label>
              <label className="block text-xs font-semibold text-espresso/70">Description<textarea name="description" defaultValue={payload.profile.description} className="mt-1.5 min-h-32 w-full rounded-xl border border-gold/25 bg-ivory px-3 py-2 text-sm" /></label>
              <label className="block text-xs font-semibold text-espresso/70">Primary category<select name="category" defaultValue={payload.profile.category} className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm">{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-espresso/70">Service areas<select name="serviceAreas" multiple defaultValue={payload.profile.serviceAreas} className="mt-1.5 min-h-32 w-full rounded-xl border border-gold/25 bg-ivory px-3 py-2 text-sm">{withCurrent(SERVICE_AREAS, payload.profile.serviceAreas).map((option) => <option key={option} value={option}>{option}</option>)}</select><span className="mt-1 block font-normal text-espresso/50">Use Ctrl/Cmd or Shift for multiple selections.</span></label>
                <label className="block text-xs font-semibold text-espresso/70">Services<select name="services" multiple defaultValue={payload.profile.services} className="mt-1.5 min-h-32 w-full rounded-xl border border-gold/25 bg-ivory px-3 py-2 text-sm">{withCurrent(SERVICES, payload.profile.services).map((option) => <option key={option} value={option}>{option}</option>)}</select><span className="mt-1 block font-normal text-espresso/50">Choose the services shown in public search.</span></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold text-espresso/70">Website<input name="website" type="url" defaultValue={payload.profile.website} placeholder="https://" className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm" /></label><label className="block text-xs font-semibold text-espresso/70">Phone<input name="phone" defaultValue={payload.profile.phone} className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm" /></label></div>
              <label className="block text-xs font-semibold text-espresso/70">Public image URL<input name="imageUrl" type="url" defaultValue={payload.profile.imageUrl} placeholder="https://" className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm" /></label>
              <label className="block text-xs font-semibold text-espresso/70">Directory visibility<select name="visibility" defaultValue={payload.profile.visibility} className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm"><option value="draft">Private draft</option><option value="published">Published in directory</option></select></label>
              <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-espresso px-4 py-3 text-sm font-semibold text-champagne disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save company profile</button>
            </form>

            <aside className="space-y-5"><div className="rounded-3xl border border-gold/20 bg-champagne p-6"><CheckCircle2 className="size-6 text-sage" /><h3 className="mt-4 font-serif text-2xl">Approved business</h3><p className="mt-3 text-sm leading-6 text-espresso/58">Only active members of this approved business can edit its public profile.</p></div><div className="rounded-3xl bg-espresso p-6 text-champagne"><h3 className="font-serif text-2xl">Public privacy boundary</h3><p className="mt-3 text-sm leading-6 text-champagne/60">This profile stores company discovery information only. It does not read or publish any wedding’s private vendor list, contract status, payment status or notes.</p><Link href="/vendors" className="mt-5 inline-flex text-sm font-semibold text-gold">View provider directory</Link></div></aside>
          </div>
        )}
      </section>
    </PublicPlatformShell>
  )
}
