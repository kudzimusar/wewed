'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Bell,
  ChevronLeft,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Palette,
  Repeat2,
  SlidersHorizontal,
  UserRound,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/wedding/theme-toggle'

interface SettingsSession {
  authorized?: boolean
  user?: {
    email?: string
    displayName?: string | null
    role?: string
  }
  activeWedding?: {
    title?: string
    membershipRole?: string
  } | null
}

function settingsCardClass() {
  return 'rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6'
}

export default function SettingsPage() {
  const [session, setSession] = useState<SettingsSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [leaving, setLeaving] = useState<'switch' | 'signout' | null>(null)

  useEffect(() => {
    let active = true
    void fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as SettingsSession | null
        if (active) setSession(response.ok ? payload : null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function endSession(destination: '/sign-in' | '/') {
    setLeaving(destination === '/sign-in' ? 'switch' : 'signout')
    try {
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin' })
    } finally {
      window.location.href = destination
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        <Loader2 className="size-6 animate-spin text-gold" aria-label="Loading settings" />
      </main>
    )
  }

  if (!session?.authorized || !session.user) {
    return (
      <main className="min-h-dvh bg-background px-4 py-12 text-foreground">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
          <LockKeyhole className="mx-auto size-7 text-gold" />
          <h1 className="mt-4 font-serif text-3xl">Settings are private</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your Wewed account and workspace preferences.</p>
          <Button asChild className="mt-5 bg-gold text-espresso hover:bg-gold-light"><Link href="/sign-in">Sign in</Link></Button>
        </div>
      </main>
    )
  }

  const displayName = session.user.displayName?.trim() || session.user.email || 'Wewed account'
  const role = session.activeWedding?.membershipRole || session.user.role || 'member'
  const workspaceHref = session.user.role === 'admin' ? '/admin' : session.user.role === 'vendor' ? '/vendor' : session.user.role === 'couple' ? '/couple' : '/planner'

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button asChild variant="outline" size="icon" aria-label="Back to workspace"><Link href={workspaceHref}><ChevronLeft className="size-4" /></Link></Button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Wewed</p>
            <h1 className="font-serif text-2xl">Settings</h1>
          </div>
          <Button asChild variant="outline" className="hidden sm:inline-flex"><Link href={workspaceHref}><LayoutDashboard className="size-4" />Workspace</Link></Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-16 sm:px-6 sm:py-8">
        <section className={settingsCardClass()}>
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold"><UserRound className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl">Profile & account</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your Wewed identity and account access.</p>
              <div className="mt-4 rounded-xl border border-border/70 bg-background p-4">
                <p className="font-medium">{displayName}</p>
                {session.user.email && <p className="mt-1 text-sm text-muted-foreground">{session.user.email}</p>}
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-gold">{role} access</p>
              </div>
            </div>
          </div>
        </section>

        <section className={settingsCardClass()}>
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold"><Palette className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl">Appearance & accessibility</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose the global Wewed theme. Planner operational worksheets retain their governed high-contrast dark surface for readability.</p>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background p-4">
                <div><p className="font-medium">Theme</p><p className="text-xs text-muted-foreground">System, light or dark</p></div>
                <ThemeToggle />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Text size, density and reduced-motion controls belong here when Wewed has durable preference contracts for them. This page does not pretend unsupported preferences are already saved.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className={settingsCardClass()}>
            <div className="flex items-start gap-3"><SlidersHorizontal className="mt-1 size-5 shrink-0 text-gold" /><div><h2 className="font-serif text-xl">Planner preferences</h2><p className="mt-1 text-sm text-muted-foreground">Worksheet defaults, print choices and workspace density will live here as durable preference support is introduced.</p><Button asChild variant="outline" size="sm" className="mt-4"><Link href="/planner">Open Planner</Link></Button></div></div>
          </div>

          <div className={settingsCardClass()}>
            <div className="flex items-start gap-3"><Users className="mt-1 size-5 shrink-0 text-gold" /><div><h2 className="font-serif text-xl">Project & team</h2><p className="mt-1 text-sm text-muted-foreground">Wedding switching, Team and secure QR invitations remain project-scoped and permission-controlled inside the active workspace.</p>{session.activeWedding?.title && <p className="mt-3 text-xs text-gold">Current: {session.activeWedding.title}</p>}</div></div>
          </div>

          <div className={settingsCardClass()}>
            <div className="flex items-start gap-3">
              <Bell className="mt-1 size-5 shrink-0 text-gold" />
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-xl">Notifications & communication</h2>
                <p className="mt-1 text-sm text-muted-foreground">Open your Wewed attention center or configure the delivery channels that are actually available for your account. In-app notifications remain the canonical record.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/notifications"><Bell className="size-4" />Open notifications</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/settings/notifications"><SlidersHorizontal className="size-4" />Notification settings</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className={settingsCardClass()}>
            <div className="flex items-start gap-3"><LockKeyhole className="mt-1 size-5 shrink-0 text-gold" /><div><h2 className="font-serif text-xl">Privacy & security</h2><p className="mt-1 text-sm text-muted-foreground">Project membership and platform administration stay separate. Settings never elevates wedding/project access into platform-wide Wewed administrator authority.</p></div></div>
          </div>
        </section>

        <section className={settingsCardClass()}>
          <h2 className="font-serif text-xl">Account actions</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={leaving !== null} onClick={() => void endSession('/sign-in')}>
              {leaving === 'switch' ? <Loader2 className="size-4 animate-spin" /> : <Repeat2 className="size-4" />}Switch account
            </Button>
            <Button type="button" variant="ghost" disabled={leaving !== null} onClick={() => void endSession('/')}>
              {leaving === 'signout' ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}Sign out
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
