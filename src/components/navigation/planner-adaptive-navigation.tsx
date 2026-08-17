'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  ClipboardList,
  ExternalLink,
  House,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Repeat2,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface PlannerAdaptiveNavigationProps {
  displayName?: string | null
  email?: string | null
  role?: string | null
  weddingTitle?: string | null
  weddingSlug?: string | null
  showPortfolioLink?: boolean
}

const GLOBAL_ITEMS = [
  ['/planner', 'Workspace', LayoutDashboard],
  ['/planner/wedding-brief', 'Brief', ClipboardList],
  ['/messages', 'Messages', MessageCircle],
  ['/planner/ai-workspace', 'AI', Sparkles],
  ['/planner/marketplace', 'Business', BriefcaseBusiness],
  ['/', 'Wewed', House],
] as const

function itemIsActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  if (href === '/planner') {
    return (
      pathname === '/planner' ||
      (pathname.startsWith('/planner/') &&
        !pathname.startsWith('/planner/marketplace') &&
        !pathname.startsWith('/planner/ai-workspace') &&
        !pathname.startsWith('/planner/wedding-brief') &&
        !pathname.startsWith('/planner/portfolio'))
    )
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PlannerAdaptiveNavigation({
  displayName,
  email,
  role,
  weddingTitle,
  weddingSlug,
  showPortfolioLink = false,
}: PlannerAdaptiveNavigationProps) {
  const pathname = usePathname()
  const [leaving, setLeaving] = useState<'switch' | 'signout' | null>(null)

  const accountLabel = displayName?.trim() || email || 'Wewed account'
  const roleLabel = role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}` : 'Team member'

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
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          data-testid="planner-adaptive-menu-trigger"
          aria-label="Open Wewed menu"
          className="size-10 shrink-0 border-gold/25 bg-gold/[0.07] text-gold hover:bg-gold/12 hover:text-gold"
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        data-planner-adaptive-navigation
        className="border-gold/25 bg-espresso p-0 text-champagne"
      >
        <SheetHeader className="border-b border-gold/15 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/75">
            Wewed workspace
          </p>
          <SheetTitle className="font-serif text-2xl font-normal text-champagne">
            {weddingTitle || 'Planner'}
          </SheetTitle>
          <SheetDescription className="text-champagne/50">
            Move around Wewed without covering your planning workspace.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section aria-label="History controls">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/60">Navigate</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
                className="min-h-11 justify-start border-gold/20 bg-transparent text-champagne/75 hover:bg-gold/10 hover:text-gold"
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.forward()}
                className="min-h-11 justify-start border-gold/20 bg-transparent text-champagne/75 hover:bg-gold/10 hover:text-gold"
              >
                <ArrowRight className="size-4" />
                Forward
              </Button>
            </div>
          </section>

          <nav className="mt-6" aria-label="Wewed workspace navigation">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/60">Wewed</p>
            <div className="mt-2 grid gap-1">
              {GLOBAL_ITEMS.map(([href, label, Icon]) => {
                const active = itemIsActive(pathname, href)
                return (
                  <SheetClose asChild key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                        active
                          ? 'bg-gold text-espresso'
                          : 'text-champagne/75 hover:bg-gold/10 hover:text-gold'
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      {label}
                    </Link>
                  </SheetClose>
                )
              })}
            </div>
          </nav>

          <section className="mt-6" aria-label="Project navigation">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/60">Project</p>
            <div className="mt-2 grid gap-1">
              {showPortfolioLink && (
                <SheetClose asChild>
                  <Link href="/planner/portfolio" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-champagne/75 hover:bg-gold/10 hover:text-gold">
                    <LayoutDashboard className="size-4" />
                    All weddings
                  </Link>
                </SheetClose>
              )}
              {weddingSlug && (
                <SheetClose asChild>
                  <Link href={`/w/${weddingSlug}`} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-champagne/75 hover:bg-gold/10 hover:text-gold">
                    <ExternalLink className="size-4" />
                    Wedding site
                  </Link>
                </SheetClose>
              )}
              <SheetClose asChild>
                <Link href="/settings" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-champagne/75 hover:bg-gold/10 hover:text-gold">
                  <Settings className="size-4" />
                  Settings
                </Link>
              </SheetClose>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4" aria-label="Current account">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                <Users className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-serif text-lg text-champagne">{accountLabel}</p>
                {email && displayName && <p className="truncate text-xs text-champagne/45">{email}</p>}
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-gold/65">{roleLabel}</p>
              </div>
            </div>
          </section>
        </div>

        <SheetFooter className="border-gold/15 bg-espresso">
          <Button
            type="button"
            variant="outline"
            disabled={leaving !== null}
            onClick={() => void endSession('/sign-in')}
            className="min-h-11 justify-start border-gold/20 bg-transparent text-champagne/75 hover:bg-gold/10 hover:text-gold"
          >
            {leaving === 'switch' ? <Loader2 className="size-4 animate-spin" /> : <Repeat2 className="size-4" />}
            Switch account
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={leaving !== null}
            onClick={() => void endSession('/')}
            className="min-h-11 justify-start text-champagne/60 hover:bg-gold/10 hover:text-gold"
          >
            {leaving === 'signout' ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            Sign out
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
