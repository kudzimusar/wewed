'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronDown, LayoutDashboard, Loader2, LogOut, Sparkles, UserRound } from 'lucide-react'

type AccountSession = {
  authorized?: boolean
  user?: {
    displayName?: string | null
    email?: string
    role?: 'admin' | 'couple' | 'planner'
  } | null
}

function workspaceFor(role: AccountSession['user'] extends infer T ? T extends { role?: infer R } ? R : never : never) {
  if (role === 'admin') return { href: '/admin', label: 'Administration' }
  if (role === 'planner') return { href: '/planner', label: 'Planner workspace' }
  return { href: '/couple', label: 'Couple workspace' }
}

export function PublicAccountActions() {
  const [session, setSession] = useState<AccountSession | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => response.json())
      .then((payload: AccountSession) => { if (!cancelled) setSession(payload) })
      .catch(() => { if (!cancelled) setSession({ authorized: false, user: null }) })
    return () => { cancelled = true }
  }, [])

  async function signOut() {
    setSigningOut(true)
    try {
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin' })
    } finally {
      window.location.href = '/'
    }
  }

  if (!session) {
    return <span className="flex h-10 items-center px-3 text-xs text-champagne/55" aria-label="Checking account session"><Loader2 className="size-4 animate-spin" /></span>
  }

  if (!session.authorized || !session.user) {
    return (
      <div className="flex items-center gap-2" data-testid="public-signed-out-actions">
        <div className="hidden text-right md:block"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-champagne/45">No active account</p><Link href="/sign-in" className="text-xs font-semibold text-champagne/85 hover:text-gold">Sign in</Link></div>
        <Link href="/sign-in" className="rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-champagne/85 hover:text-gold md:hidden">Sign in</Link>
        <Link href="/register" className="hidden items-center gap-2 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-espresso sm:inline-flex"><Sparkles className="size-3.5" />Get started</Link>
      </div>
    )
  }

  const workspace = workspaceFor(session.user.role)
  const displayName = session.user.displayName?.trim() || session.user.email || 'Wewed account'

  return (
    <details className="relative" data-testid="public-signed-in-account">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-gold/25 bg-black/20 px-3 py-2 text-xs text-champagne [&::-webkit-details-marker]:hidden">
        <span className="flex size-7 items-center justify-center rounded-full bg-gold text-espresso"><UserRound className="size-3.5" /></span>
        <span className="hidden max-w-32 truncate font-semibold sm:block">{displayName}</span>
        <ChevronDown className="size-3.5 text-gold" />
      </summary>
      <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-gold/20 bg-espresso p-4 text-champagne shadow-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">Signed in</p>
        <p className="mt-2 truncate font-serif text-xl">{displayName}</p>
        <p className="mt-1 text-xs capitalize text-champagne/55">{session.user.role} account</p>
        <div className="mt-4 grid gap-2">
          <Link href={workspace.href} className="flex items-center gap-2 rounded-xl bg-gold px-3 py-2.5 text-sm font-semibold text-espresso"><LayoutDashboard className="size-4" />{workspace.label}</Link>
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className="flex items-center gap-2 rounded-xl border border-gold/20 px-3 py-2.5 text-left text-sm text-champagne/75 hover:bg-gold/10 hover:text-gold disabled:opacity-60">{signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}Sign out</button>
        </div>
      </div>
    </details>
  )
}
