'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  ExternalLink,
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
import { PlannerWorkspace } from '@/components/wedding/planner-workspace'
import { WeddingContextControls } from '@/components/wedding/wedding-context-controls'
import { logoutAdmin } from '@/lib/admin-auth'

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
          <PlannerEventCommand />
          <PlannerClientProfile />
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

      <div className="planner-portal-body relative min-h-0 flex-1 overflow-hidden pt-12">
        <div className="planner-portal-context">
          <WeddingContextControls />
        </div>

        <div className="h-full min-h-0 overflow-hidden">
          <PlannerWorkspace key={wedding?.id ?? 'no-active-wedding'} />
        </div>

        <PlannerInvitationTools />
        <PlannerOperations />
        <PlannerCollaborationHub />
      </div>

      <style jsx global>{`
        html:has([data-planner-portal]),
        body:has([data-planner-portal]) {
          height: 100%;
          overflow: hidden;
          overscroll-behavior: none;
        }

        .planner-portal-context > div:first-child {
          top: 4.5rem !important;
          max-width: calc(100vw - 1rem) !important;
        }

        .planner-portal-body [data-radix-scroll-area-viewport] {
          overscroll-behavior: contain;
        }
      `}</style>
    </div>
  )
}
