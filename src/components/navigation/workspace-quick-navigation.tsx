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
  Menu,
  Repeat2,
  Settings,
  UserRound,
} from 'lucide-react'
import { PlannerAdaptiveNavigation } from '@/components/navigation/planner-adaptive-navigation'
import { NotificationBell } from '@/components/notifications/notification-bell'
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
  '/notifications',
  '/calendar',
  '/today',
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
      className="fixed left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-[360]"
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

  const compactControl =
    'inline-flex size-10 items-center justify-center rounded-full border border-gold/20 bg-ivory/95 text-espresso/70 shadow-sm backdrop-blur transition hover:border-gold/45 hover:bg-champagne/45 hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60'

  return (
    <nav
      data-testid="workspace-quick-navigation"
      aria-label="Workspace navigation controls"
      className="pointer-events-none fixed inset-x-0 top-0 z-[360] h-0"
    >
      <div className="pointer-events-auto absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-1.5">
        <details className="group relative">
          <summary
            className={`${compactControl} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
            aria-label="Open Wewed menu"
            title="Menu"
          >
            <Menu className="size-[18px]" />
          </summary>

          <div className="absolute left-0 top-12 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-gold/20 bg-espresso text-champagne shadow-2xl">
            <div className="border-b border-gold/15 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">Signed in</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <UserRound className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg leading-tight">{displayName}</p>
                  <p className="mt-0.5 text-[11px] capitalize text-champagne/50">{session.user.role} account</p>
                </div>
              </div>
            </div>

            <div className="grid gap-1 p-2">
              <Link
                href={workspace.href}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-champagne/80 hover:bg-gold/10 hover:text-gold"
              >
                <LayoutDashboard className="size-4" />
                {workspace.label}
              </Link>
              <NotificationBell
                showLabel
                className="min-h-11 justify-start rounded-xl px-3 text-champagne/80 hover:bg-gold/10 hover:text-gold"
              />
              <Link
                href="/settings"
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-champagne/80 hover:bg-gold/10 hover:text-gold"
              >
                <Settings className="size-4" />
                Settings
              </Link>
            </div>

            <div className="grid gap-1 border-t border-gold/15 p-2">
              <button
                type="button"
                onClick={() => void endSession('/sign-in')}
                disabled={leaving !== null}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm text-champagne/75 hover:bg-gold/10 hover:text-gold disabled:opacity-60"
              >
                {leaving === 'switch' ? <Loader2 className="size-4 animate-spin" /> : <Repeat2 className="size-4" />}
                Switch account
              </button>
              <button
                type="button"
                onClick={() => void endSession('/')}
                disabled={leaving !== null}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm text-champagne/65 hover:bg-gold/10 hover:text-gold disabled:opacity-60"
              >
                {leaving === 'signout' ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                Sign out
              </button>
            </div>
          </div>
        </details>

        <button
          type="button"
          onClick={() => window.history.back()}
          className={compactControl}
          aria-label="Go back"
          title="Back"
        >
          <ArrowLeft className="size-[18px]" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => window.history.forward()}
        className={`pointer-events-auto absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] ${compactControl}`}
        aria-label="Go forward"
        title="Forward"
      >
        <ArrowRight className="size-[18px]" />
      </button>
    </nav>
  )
}

export function WorkspaceQuickNavigation() {
  const pathname = usePathname()

  if (!isPrivateWorkspace(pathname) || plannerUsesEmbeddedAdaptiveNavigation(pathname)) return null
  if (pathname.startsWith('/planner/')) return <PlannerSecondaryAdaptiveNavigation />

  return <PrivateWorkspaceQuickNavigation />
}
