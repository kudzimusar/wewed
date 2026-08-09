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
  MessageCircle,
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
  ['Messages', 'Talk with your planner, wedding team and Wewed support without losing the conversation outside the platform.', '/messages', MessageCircle, 'bg-gold/15 text-gold-muted'],
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
    <main className="min-h-screen bg-ivory text-espresso" data-couple-dashboard="true">
      <header className="relative isolate overflow-hidden bg-espresso px-4 py-7 text-champagne sm:px-6 sm:py-10 lg:py-16">
        <img src="https://images.pexels.com/photos/13857890/pexels-photo-13857890.jpeg?cs=srgb&dl=pexels-bwalya-marcel-ngosa-2381292-13857890.jpg&fm=jpg" alt="" className="absolute inset-0 size-full object-cover object-center opacity-35" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(26,20,16,0.98),rgba(26,20,16,0.84)_55%,rgba(26,20,16,0.5))]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-8">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold sm:text-xs sm:tracking-[0.22em]"><Heart className="size-3.5 fill-gold" />Wewed couple command centre</p>
              <h1 className="mt-3 font-serif text-4xl leading-tight sm:mt-4 sm:text-5xl lg:text-6xl">{wedding?.title || 'Your wedding'}</h1>
              <div className="mt-3 flex flex-col gap-2 text-sm text-champagne/68 sm:mt-4 sm:flex-row sm:flex-wrap sm:gap-x-5">
                {wedding && <><span className="flex items-center gap-2"><CalendarHeart className="size-4 shrink-0 text-gold" />{new Date(wedding.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span><span className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-gold" />{wedding.venue}</span></>}
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-champagne/65 sm:mt-6 sm:leading-7">One beautiful place to move between your private wedding site, guest experience, professional support and planning tools—without losing control of your privacy.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {wedding && <Link href={`/w/${wedding.slug}`} className="inline-flex min-h-11 items-center rounded-full bg-gold px-5 py-2.5 text-xs font-semibold text-espresso shadow-lg hover:bg-gold-light">View wedding site</Link>}
              <Link href="/messages" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/30 bg-black/20 px-5 py-2.5 text-xs text-champagne/75 backdrop-blur hover:border-gold hover:text-gold"><MessageCircle className="size-4" />Messages</Link>
              <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-gold/30 bg-black/20 px-5 py-2.5 text-xs text-champagne/75 backdrop-blur hover:border-gold hover:text-gold">Wewed home</Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-4 lg:mt-10 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-black/25 p-3 backdrop-blur sm:rounded-3xl sm:p-5"><Clock3 className="size-4 text-gold sm:size-5" /><p className="mt-2 text-2xl font-semibold sm:mt-4 sm:text-3xl">{countdown ?? '—'}</p><p className="mt-1 text-[11px] leading-4 text-champagne/55 sm:text-xs">days until the celebration</p></div>
            <div className="rounded-2xl border border-white/15 bg-black/25 p-3 backdrop-blur sm:rounded-3xl sm:p-5"><ShieldCheck className="size-4 text-gold sm:size-5" /><p className="mt-2 text-sm font-semibold sm:mt-4 sm:text-lg">Invitation protected</p><p className="mt-1 text-[11px] leading-4 text-champagne/55 sm:text-xs">private access remains under your control</p></div>
            <div className="rounded-2xl border border-white/15 bg-black/25 p-3 backdrop-blur sm:rounded-3xl sm:p-5"><UsersRound className="size-4 text-gold sm:size-5" /><p className="mt-2 text-sm font-semibold sm:mt-4 sm:text-lg">Guest-ready tools</p><p className="mt-1 text-[11px] leading-4 text-champagne/55 sm:text-xs">cards, QR links and RSVP in one flow</p></div>
            <div className="rounded-2xl border border-white/15 bg-black/25 p-3 backdrop-blur sm:rounded-3xl sm:p-5"><Sparkles className="size-4 text-gold sm:size-5" /><p className="mt-2 text-sm font-semibold sm:mt-4 sm:text-lg">Canon preservation</p><p className="mt-1 text-[11px] leading-4 text-champagne/55 sm:text-xs">prepare the story that lasts beyond the day</p></div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem] xl:gap-8">
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-muted sm:text-xs">Your next actions</p><h2 className="mt-1 font-serif text-3xl sm:mt-2 sm:text-4xl">Keep the whole wedding moving.</h2></div><p className="max-w-md text-sm leading-6 text-espresso/55">Each card opens a real, permission-aware part of Wewed. No hidden routes and no mixed public/private data.</p></div>
            <div className="mt-4 grid gap-3 sm:mt-7 sm:gap-5 md:grid-cols-2">
              {links.map(([title, detail, href, Icon, tone], index) => (
                <Link key={href} href={href} className={`group relative overflow-hidden rounded-2xl border border-gold/20 bg-white p-4 transition hover:-translate-y-1 hover:border-gold/45 hover:shadow-xl sm:rounded-3xl sm:p-6 ${index === 0 ? 'md:col-span-2 md:grid md:grid-cols-[1fr_16rem] md:items-center md:gap-8' : ''}`}>
                  <div><div className={`flex size-10 items-center justify-center rounded-xl sm:size-12 sm:rounded-2xl ${tone}`}><Icon className="size-5" /></div><h3 className="mt-3 font-serif text-2xl sm:mt-5 sm:text-3xl">{title}</h3><p className="mt-2 max-w-xl text-sm leading-5 text-espresso/58 sm:mt-3 sm:leading-6">{detail}</p><span className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-muted group-hover:text-espresso sm:mt-5">Open <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span></div>
                  {index === 0 && <div className="mt-6 hidden h-40 overflow-hidden rounded-2xl bg-espresso md:block"><img src="https://images.pexels.com/photos/7688336/pexels-photo-7688336.jpeg?auto=compress&cs=tinysrgb&w=900" alt="Wedding planner reviewing a celebration plan" className="size-full object-cover opacity-85 transition duration-700 group-hover:scale-105" /></div>}
                </Link>
              ))}
            </div>
          </div>

          <aside className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:gap-5">
            <section className="rounded-2xl border border-gold/20 bg-champagne p-4 sm:rounded-3xl sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-muted sm:text-xs">Journey overview</p><h2 className="mt-1 font-serif text-2xl sm:mt-2 sm:text-3xl">From planning to forever.</h2><div className="mt-4 space-y-3 sm:mt-6 sm:space-y-5">{[
              ['Foundation', 'Wedding details and private space created', true],
              ['Professional support', 'Discover or appoint a planner', false],
              ['Guest experience', 'Design cards and send invitations', false],
              ['Wedding day', 'Coordinate the final timeline and access', false],
              ['Canon', 'Preserve the finished wedding story', false],
            ].map(([title, detail, complete], index) => <div key={String(title)} className="relative flex gap-3"><span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-sage text-white' : 'border border-gold/30 bg-white text-gold-muted'}`}>{complete ? <CheckCircle2 className="size-4" /> : index + 1}</span>{index < 4 && <span className="absolute left-4 top-8 h-6 w-px bg-gold/20 sm:h-8" />}<div><p className="text-sm font-semibold">{String(title)}</p><p className="mt-0.5 text-xs leading-5 text-espresso/50 sm:mt-1">{String(detail)}</p></div></div>)}</div></section>
            <section className="overflow-hidden rounded-2xl bg-espresso text-champagne sm:rounded-3xl"><img src="https://images.pexels.com/photos/17315405/pexels-photo-17315405.jpeg?auto=compress&cs=tinysrgb&w=900" alt="Elegant wedding table with flowers and candles" className="h-32 w-full object-cover opacity-80 sm:h-40" /><div className="p-4 sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold sm:text-xs">Wedding inspiration</p><h2 className="mt-1 font-serif text-2xl sm:mt-2 sm:text-3xl">Make every detail feel like you.</h2><p className="mt-2 text-xs leading-5 text-champagne/55 sm:mt-3">Use your private site and planning tools to turn ideas into a coherent guest experience.</p></div></section>
          </aside>
        </div>
      </section>
    </main>
  )
}
