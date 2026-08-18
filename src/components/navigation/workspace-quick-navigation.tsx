'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  LayoutDashboard,
  Loader2,
  LogOut,
  Repeat2,
  UserRound,
} from 'lucide-react'
import { PlannerAdaptiveNavigation } from '@/components/navigation/planner-adaptive-navigation'
import {
  type AccountRole,
  usePublicAccountSession,
} from '@/components/public/public-account-actions'

const PRIVATE_WORKSPACE_PREFIXES = [
  '/admin',
  '/couple',
  '/planner',
  '/vendor',
  '/messages',
  '/billing',
] as const

function isPrivateWorkspace(pathname: string) {
  return (
    PRIVATE_WORKSPACE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ||
    pathname === '/vendors/manage' ||
    pathname.startsWith('/vendors/manage/')
  )
}

function plannerUsesEmbeddedAdaptiveNavigation(pathname: string): boolean {
  return (
    pathname === '/planner' ||
    /^\/planner\/(overview|tasks|budget|vendors|guests|timeline|seating|portfolio)(?:\/|$)/.test(pathname)
  )
}

function workspaceFor(role: AccountRole | undefined) {
  if (role === 'admin') return { href: '/admin', label: 'Administration' }
  if (role === 'planner') return { href: '/planner', label: 'Planner workspace' }
  if (role === 'vendor') return { href: '/vendor', label: 'Vendor workspace' }
  if (role === 'provider') return { href: '/vendors/manage', label: 'Provider profile' }
  return { href: '/couple', label: 'Couple workspace' }
}

function PlannerSecondaryAdaptiveNavigation() {
  const session = usePublicAccountSession()

  if (!session?.authorized || !session.user) return null

  return (
    <div
      data-testid="planner-secondary-adaptive-navigation"
      className="fixed left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-[360] rounded-xl bg-espresso/95 p-1 shadow-xl backdrop-blur"
    >
      <PlannerAdaptiveNavigation
        displayName={session.user.displayName}
        email={session.user.email}
        role={session.user.role}
        showPortfolioLink={session.user.role === 'planner'}
      />
    </div>
  )
}

function PrivateWorkspaceQuickNavigation() {
  const session = usePublicAccountSession()
  const [leaving, setLeaving] = useState<'switch' | 'signout' | null>(null)

  if (!session?.authorized || !session.user) return null

  const workspace = workspaceFor(session.user.role)
  const displayName = session.user.displayName?.trim() || session.user.email || 'Wewed account'

  async function endSession(destination: '/sign-in' | '/') {
    setLeaving(destination === '/sign-in' ? 'switch' : 'signout')
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'same-origin',
      })
    } finally {
      window.location.href = destination
    }
  }

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] left-3 z-[360] sm:bottom-4 sm:left-4"
      data-testid="workspace-quick-navigation"
      aria-label="Workspace navigation controls"
    >
      <div className="flex items-center gap-1 rounded-full border border-gold/25 bg-espresso/95 p-1.5 text-champagne shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex size-9 items-center justify-center rounded-full text-champagne/75 transition hover:bg-gold/10 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
          aria-label="Go back"
          title="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => window.history.forward()}
          className="flex size-9 items-center justify-center rounded-full text-champagne/75 transition hover:bg-gold/10 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
          aria-label="Go forward"
          title="Forward"
        >
          <ArrowRight className="size-4" />
        </button>
        <div className="h-5 w-px bg-gold/20" aria-hidden="true" />
        <details className="group relative">
          <summary
            className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-gold text-espresso transition hover:bg-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-champagne [&::-webkit-details-marker]:hidden"
            aria-label="Open account menu"
            title="Account"
          >
            <UserRound className="size-4" />
          </summary>
          <div className="absolute bottom-12 left-0 w-72 rounded-2xl border border-gold/20 bg-espresso p-4 text-champagne shadow-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">Signed in</p>
            <p className="mt-2 truncate font-serif text-xl">{displayName}</p>
            <p className="mt-1 text-xs capitalize text-champagne/55">{session.user.role} account</p>
            <div className="mt-4 grid gap-2">
              <Link
                href={workspace.href}
                className="flex items-center gap-2 rounded-xl bg-gold px-3 py-2.5 text-sm font-semibold text-espresso"
              >
                <LayoutDashboard className="size-4" />
                {workspace.label}
              </Link>
              <button
                type="button"
                onClick={() => void endSession('/sign-in')}
                disabled={leaving !== null}
                className="flex items-center gap-2 rounded-xl border border-gold/20 px-3 py-2.5 text-left text-sm text-champagne/80 hover:bg-gold/10 hover:text-gold disabled:opacity-60"
              >
                {leaving === 'switch' ? <Loader2 className="size-4 animate-spin" /> : <Repeat2 className="size-4" />}
                Switch account
              </button>
              <button
                type="button"
                onClick={() => void endSession('/')}
                disabled={leaving !== null}
                className="flex items-center gap-2 rounded-xl border border-gold/20 px-3 py-2.5 text-left text-sm text-champagne/70 hover:bg-gold/10 hover:text-gold disabled:opacity-60"
              >
                {leaving === 'signout' ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                Sign out
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}

export function WorkspaceQuickNavigation() {
  const pathname = usePathname()

  if (!isPrivateWorkspace(pathname) || plannerUsesEmbeddedAdaptiveNavigation(pathname)) return null
  if (pathname.startsWith('/planner/')) return <PlannerSecondaryAdaptiveNavigation />

  return <PrivateWorkspaceQuickNavigation />
}
