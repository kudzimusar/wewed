'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlannerClientProfile } from '@/components/wedding/planner-client-profile'
import { PlannerCollaborationHub } from '@/components/wedding/planner-collaboration-hub'
import { PlannerEventCommand } from '@/components/wedding/planner-event-command'
import { PlannerInvitationTools } from '@/components/wedding/planner-invitation-tools'
import { PlannerOperations } from '@/components/wedding/planner-operations'
import { PlannerReleaseCenter } from '@/components/wedding/planner-release-center'
import { PlannerWorkspace } from '@/components/wedding/planner-workspace-stage7'
import { WeddingContextControls } from '@/components/wedding/wedding-context-controls'
import { logoutAdmin } from '@/lib/admin-auth'
import { capturePlannerFormBaselines } from '@/lib/planner-draft-guard'

interface PlannerPortalProps {
  onExit: () => void
}

interface ActiveWedding {
  id: string
  slug: string
  title: string
  date: string
  venue: string
  venueCity: string
  venueCountry: string
  membershipRole: 'admin' | 'owner' | 'planner' | 'coordinator' | 'viewer'
  permissions: string[]
}

interface PlannerSession {
  authorized?: boolean
  user?: {
    email: string
    displayName: string | null
    role: string
  }
  activeWedding?: ActiveWedding
}

function dateLabel(value?: string): string {
  if (!value) return 'Wedding date not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function roleLabel(value?: string): string {
  if (!value) return 'Team member'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function PlannerToolTriggers() {
  return (
    <div
      data-planner-tool-triggers
      className="grid gap-2 sm:grid-cols-2 xl:flex xl:min-w-max xl:items-center"
    >
      <a
        href="#planner-workspace"
        aria-current="page"
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-gold/35 bg-gold/12 px-3 font-sans text-xs font-medium text-gold transition-colors hover:bg-gold/18 xl:justify-start"
      >
        <LayoutDashboard className="size-3.5" />
        Planning workspace
      </a>
      <PlannerCollaborationHub />
      <PlannerClientProfile />
      <PlannerOperations />
      <PlannerInvitationTools />
      <PlannerEventCommand />
      <PlannerReleaseCenter />
    </div>
  )
}

function PlannerExperienceNavigation() {
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <section
      data-planner-experience-nav
      className="shrink-0 border-b border-gold/15 bg-espresso/95 px-3 py-2.5 sm:px-5"
    >
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center justify-between gap-3">
          <div className="shrink-0">
            <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-gold/70">
              Daily planner path
            </p>
            <p className="mt-0.5 font-sans text-[11px] text-champagne/45">
              Plan → coordinate → update → operate → execute → close
            </p>
          </div>
          <button
            type="button"
            data-planner-tools-disclosure
            aria-expanded={toolsOpen}
            aria-controls="planner-experience-tools"
            onClick={() => setToolsOpen((open) => !open)}
            className="inline-flex min-h-10 items-center rounded-lg border border-gold/20 bg-gold/[0.05] px-3 font-sans text-xs text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 xl:hidden"
          >
            {toolsOpen ? 'Close tools' : 'Planner tools'}
          </button>
        </div>

        <nav
          id="planner-experience-tools"
          aria-label="Planner experience navigation"
          className={`${toolsOpen ? 'block' : 'hidden'} max-h-[42dvh] min-w-0 overflow-y-auto pb-1 xl:block xl:max-h-none xl:overflow-x-auto xl:overflow-y-visible xl:pb-0`}
        >
          <PlannerToolTriggers />
        </nav>
      </div>

      <style jsx global>{`
        [data-planner-tool-triggers] > button {
          position: static !important;
          inset: auto !important;
          z-index: auto !important;
          width: auto !important;
          min-height: 2.25rem !important;
          flex-shrink: 0 !important;
          box-shadow: none !important;
        }

        [data-planner-tool-triggers] > button span {
          display: inline !important;
        }

        @media (max-width: 1279px) {
          [data-planner-tool-triggers] > button,
          [data-planner-tool-triggers] > a {
            width: 100% !important;
            justify-content: flex-start !important;
          }
        }
      `}</style>
    </section>
  )
}

export function PlannerPortal({ onExit }: PlannerPortalProps) {
  const [session, setSession] = useState<PlannerSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadSession = () => {
      void fetch('/api/auth/me', { cache: 'no-store' })
        .then(async (response) => {
          const payload = (await response.json()) as PlannerSession
          if (!cancelled && response.ok && payload.authorized) setSession(payload)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    loadSession()
    window.addEventListener('wewed:client-profile-updated', loadSession)
    window.addEventListener('wewed:wedding-switched', loadSession)
    return () => {
      cancelled = true
      window.removeEventListener('wewed:client-profile-updated', loadSession)
      window.removeEventListener('wewed:wedding-switched', loadSession)
    }
  }, [])

  useEffect(() => {
    const root = document.querySelector('[data-planner-portal]')
    if (!root) return

    const capture = () => capturePlannerFormBaselines(root)
    capture()
    const observer = new MutationObserver(capture)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const wedding = session?.activeWedding
  const location = useMemo(() => {
    if (!wedding) return ''
    return [wedding.venue, wedding.venueCity, wedding.venueCountry]
      .filter(Boolean)
      .join(' · ')
  }, [wedding])

  function handleLogout() {
    logoutAdmin()
    window.setTimeout(() => window.location.reload(), 0)
  }

  return (
    <div
      data-planner-portal
      className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden bg-espresso text-champagne"
    >
      <header className="relative z-[130] flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gold/15 bg-espresso px-3 shadow-lg sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden size-9 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 sm:flex">
            <ShieldCheck className="size-4 text-gold" />
          </div>
          <div className="min-w-0">
            <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.24em] text-gold/75">
              Wewed Planner Workspace
            </p>
            <h1 className="truncate font-serif text-base text-champagne sm:text-lg">
              {loading ? 'Loading assigned wedding…' : wedding?.title || 'Wedding planning workspace'}
            </h1>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 items-center justify-center px-4 lg:flex">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-gold" />
          ) : wedding ? (
            <div className="min-w-0 text-center">
              <p className="flex items-center justify-center gap-1.5 truncate font-sans text-xs text-champagne/70">
                <CalendarDays className="size-3.5 shrink-0 text-gold" />
                {dateLabel(wedding.date)}
              </p>
              <p className="max-w-xl truncate font-sans text-[10px] text-champagne/40">
                {location}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full border border-gold/20 bg-gold/5 px-2.5 py-1 font-sans text-[10px] uppercase tracking-[0.12em] text-gold xl:inline-flex">
            {roleLabel(wedding?.membershipRole || session?.user?.role)}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden border-gold/25 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold md:inline-flex"
          >
            <Link href="/">
              <ExternalLink className="size-3.5" />
              Couple website
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="border-gold/25 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
          <button
            type="button"
            onClick={onExit}
            className="sr-only"
            aria-label="Exit planner"
          >
            Exit planner
          </button>
        </div>
      </header>

      <div className="planner-portal-body relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="planner-portal-context shrink-0">
          <WeddingContextControls />
        </div>

        <PlannerExperienceNavigation key={`tools-${wedding?.id ?? 'no-active-wedding'}`} />

        <main id="planner-workspace" className="min-h-0 flex-1 overflow-hidden" tabIndex={-1}>
          <PlannerWorkspace key={wedding?.id ?? 'no-active-wedding'} />
        </main>
      </div>

      <style jsx global>{`
        html:has([data-planner-portal]),
        body:has([data-planner-portal]) {
          height: 100%;
          overflow: hidden;
          overscroll-behavior: none;
        }

        .planner-portal-body [data-radix-scroll-area-viewport] {
          overscroll-behavior: contain;
        }
      `}</style>
    </div>
  )
}
