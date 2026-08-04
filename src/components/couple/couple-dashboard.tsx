'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarHeart,
  CheckCircle2,
  Clock3,
  CreditCard,
  Heart,
  KeyRound,
  Loader2,
  MapPin,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

interface SessionPayload {
  authorized?: boolean
  activeWedding?: { slug: string; title: string; date: string; venue: string }
  user?: { displayName?: string | null }
}

const links = [
  ['Find a planner', 'Search, save, enquire, appoint and control delegated authority.', '/couple/planners', Search, 'bg-plum/10 text-plum'],
  ['Guests & invitations', 'Design wedding cards, create QR links and manage private guest access.', '/couple/invitations', UsersRound, 'bg-clay/10 text-clay'],
  ['Privacy & access', 'Choose public, invitation-only or private visibility for the active wedding.', '/couple/privacy', KeyRound, 'bg-sage/10 text-sage'],
  ['Planning workspace', 'Open tasks, budget, vendors, guests, timeline and seating.', '/planner', Settings2, 'bg-gold/15 text-gold-muted'],
  ['Subscription & Canon', 'Review billing, plan status and long-term preservation controls.', '/billing', CreditCard, 'bg-espresso/10 text-espresso'],
] as const

export function CoupleDashboard() {
  return (
    <DashboardAuthGate
      allowedRoles={['couple']}
      wrongRoleMessage="Sign in with the couple account that owns this wedding."
      title="Couple dashboard"
      description="Manage your wedding, guests, privacy and planner relationship."
      onClose={() => { window.location.href = '/' }}
    >
      <CoupleDashboardContent />
    </DashboardAuthGate>
  )
}

function CoupleDashboardContent() {
  const [session, setSession] = useState<SessionPayload | null>(null)

  useEffect(() => {
    void fetch('/api/auth/me', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => setSession(payload))
  }, [])

  const wedding = session?.activeWedding
  const countdown = useMemo(() => {
    if (!wedding) return null
    const days = Math.ceil((new Date(wedding.date).getTime() - Date.now()) / 86_400_000)
    return Math.max(days, 0)
  }, [wedding])

  if (!session) {
    return <main className="flex min-h-screen items-center justify-center bg-ivory"><Loader2 className="size-7 animate-spin text-gold-muted" /></main>
  }

  return (
    <main className="min-h-screen bg-ivory text-espresso">
      <header className="relative isolate overflow-hidden bg-espresso px-4 py-12 text-champagne sm:px-6 lg:py-16">
        <img src="https://images.pexels.com/photos/13857890/pexels-photo-13857890.jpeg?cs=srgb&dl=pexels-bwalya-marcel-ngosa-2381292-13857890.jpg&fm=jpg" alt="" className="absolute inset-0 size-full object-cover object-center opacity-35" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(26,20,16,0.98),rgba(26,20,16,0.84)_55%,rgba(26,20,16,0.5))]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold"><Heart className="size-3.5 fill-gold" />Wewed couple command centre</p>
              <h1 className="mt-4 font-serif text-5xl leading-tight sm:text-6xl">{wedding?.title || 'Your wedding'}</h1>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-champagne/68">
                {wedding && <><span className="flex items-center gap-2"><CalendarHeart className="size-4 text-gold" />{new Date(wedding.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span><span className="flex items-center gap-2"><MapPin className="size-4 text-gold" />{wedding.venue}</span></>}
              </div>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-champagne/65">One beautiful place to move between your private wedding site, guest experience, professional support and planning tools—without losing control of your privacy.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {wedding && <Link href={`/w/${wedding.slug}`} className="rounded-full bg-gold px-5 py-2.5 text-xs font-semibold text-espresso shadow-lg hover:bg-gold-light">View wedding site</Link>}
              <Link href="/" className="rounded-full border border-gold/30 bg-black/20 px-5 py-2.5 text-xs text-champagne/75 backdrop-blur hover:border-gold hover:text-gold">Wewed home</Link>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-white/15 bg-black/25 p-5 backdrop-blur"><Clock3 className="size-5 text-gold" /><p className="mt-4 text-3xl font-semibold">{countdown ?? '—'}</p><p className="mt-1 text-xs text-champagne/55">days until the celebration</p></div>
            <div className="rounded-3xl border border-white/15 bg-black/25 p-5 backdrop-blur"><ShieldCheck className="size-5 text-gold" /><p className="mt-4 text-lg font-semibold">Invitation protected</p><p className="mt-1 text-xs text-champagne/55">private access remains under your control</p></div>
            <div className="rounded-3xl border border-white/15 bg-black/25 p-5 backdrop-blur"><UsersRound className="size-5 text-gold" /><p className="mt-4 text-lg font-semibold">Guest-ready tools</p><p className="mt-1 text-xs text-champagne/55">cards, QR links and RSVP in one flow</p></div>
            <div className="rounded-3xl border border-white/15 bg-black/25 p-5 backdrop-blur"><Sparkles className="size-5 text-gold" /><p className="mt-4 text-lg font-semibold">Canon preservation</p><p className="mt-1 text-xs text-champagne/55">prepare the story that lasts beyond the day</p></div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Your next actions</p><h2 className="mt-2 font-serif text-4xl">Keep the whole wedding moving.</h2></div><p className="max-w-md text-sm leading-6 text-espresso/55">Each card opens a real, permission-aware part of Wewed. No hidden routes and no mixed public/private data.</p></div>
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              {links.map(([title, detail, href, Icon, tone], index) => (
                <Link key={href} href={href} className={`group relative overflow-hidden rounded-3xl border border-gold/20 bg-white p-6 transition hover:-translate-y-1 hover:border-gold/45 hover:shadow-xl ${index === 0 ? 'md:col-span-2 md:grid md:grid-cols-[1fr_16rem] md:items-center md:gap-8' : ''}`}>
                  <div><div className={`flex size-12 items-center justify-center rounded-2xl ${tone}`}><Icon className="size-5" /></div><h3 className="mt-5 font-serif text-3xl">{title}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-espresso/58">{detail}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted group-hover:text-espresso">Open <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span></div>
                  {index === 0 && <div className="mt-6 hidden h-40 overflow-hidden rounded-2xl bg-espresso md:block"><img src="https://images.pexels.com/photos/7688336/pexels-photo-7688336.jpeg?auto=compress&cs=tinysrgb&w=900" alt="Wedding planner reviewing a celebration plan" className="size-full object-cover opacity-85 transition duration-700 group-hover:scale-105" /></div>}
                </Link>
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-gold/20 bg-champagne p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Journey overview</p><h2 className="mt-2 font-serif text-3xl">From planning to forever.</h2><div className="mt-6 space-y-5">{[
              ['Foundation', 'Wedding details and private space created', true],
              ['Professional support', 'Discover or appoint a planner', false],
              ['Guest experience', 'Design cards and send invitations', false],
              ['Wedding day', 'Coordinate the final timeline and access', false],
              ['Canon', 'Preserve the finished wedding story', false],
            ].map(([title, detail, complete], index) => <div key={String(title)} className="relative flex gap-3"><span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-sage text-white' : 'border border-gold/30 bg-white text-gold-muted'}`}>{complete ? <CheckCircle2 className="size-4" /> : index + 1}</span>{index < 4 && <span className="absolute left-4 top-8 h-8 w-px bg-gold/20" />}<div><p className="text-sm font-semibold">{String(title)}</p><p className="mt-1 text-xs leading-5 text-espresso/50">{String(detail)}</p></div></div>)}</div></section>
            <section className="overflow-hidden rounded-3xl bg-espresso text-champagne"><img src="https://images.pexels.com/photos/17315405/pexels-photo-17315405.jpeg?auto=compress&cs=tinysrgb&w=900" alt="Elegant wedding table with flowers and candles" className="h-40 w-full object-cover opacity-80" /><div className="p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Wedding inspiration</p><h2 className="mt-2 font-serif text-3xl">Make every detail feel like you.</h2><p className="mt-3 text-xs leading-5 text-champagne/55">Use your private site and planning tools to turn ideas into a coherent guest experience.</p></div></section>
          </aside>
        </div>
      </section>
    </main>
  )
}
