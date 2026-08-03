'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CalendarHeart, CreditCard, KeyRound, Loader2, Search, Settings2, UsersRound } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

interface SessionPayload {
  authorized?: boolean
  activeWedding?: { slug: string; title: string; date: string; venue: string }
  user?: { displayName?: string | null }
}

const links = [
  ['Find a planner', 'Search, save, enquire, appoint and control delegated authority.', '/couple/planners', Search],
  ['Guests & invitations', 'Generate guest invitation links and QR codes, copy them and rotate compromised credentials.', '/couple/invitations', UsersRound],
  ['Privacy & access', 'Choose public, invitation-only or private visibility for the active wedding.', '/couple/privacy', KeyRound],
  ['Planning workspace', 'Open the operational wedding workspace for tasks, budget, vendors, guests and timeline.', '/planner', Settings2],
  ['Subscription & Canon', 'Review billing, plan status and long-term preservation controls.', '/billing', CreditCard],
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

  if (!session) {
    return <main className="flex min-h-screen items-center justify-center bg-ivory"><Loader2 className="size-7 animate-spin text-gold-muted" /></main>
  }

  const wedding = session.activeWedding

  return (
    <main className="min-h-screen bg-ivory text-espresso">
      <header className="border-b border-gold/20 bg-espresso px-4 py-8 text-champagne sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Wewed couple workspace</p>
              <h1 className="mt-2 font-serif text-4xl">{wedding?.title || 'Your wedding'}</h1>
              <p className="mt-2 text-sm text-champagne/60">{wedding ? `${new Date(wedding.date).toLocaleDateString()} · ${wedding.venue}` : 'Wedding details are loading.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {wedding && <Link href={`/w/${wedding.slug}`} className="rounded-full border border-gold/30 px-4 py-2 text-xs text-gold hover:bg-gold/10">View wedding site</Link>}
              <Link href="/" className="rounded-full border border-gold/30 px-4 py-2 text-xs text-champagne/70 hover:bg-gold/10">Wewed home</Link>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl border border-gold/20 bg-champagne p-6">
          <div className="flex items-start gap-4"><CalendarHeart className="mt-1 size-6 text-gold-muted" /><div><h2 className="font-serif text-2xl">One source for your wedding</h2><p className="mt-2 text-sm leading-6 text-espresso/60">Use this dashboard to move between the private wedding site, invitations, planning tools, planner marketplace and account controls without manually entering routes.</p></div></div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {links.map(([title, detail, href, Icon]) => (
            <Link key={href} href={href} className="group rounded-3xl border border-gold/20 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">
              <div className="flex size-11 items-center justify-center rounded-full bg-gold/10"><Icon className="size-5 text-gold-muted" /></div>
              <h2 className="mt-5 font-serif text-2xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-espresso/60">{detail}</p>
              <span className="mt-5 inline-block text-sm font-semibold text-gold-muted group-hover:text-espresso">Open</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
