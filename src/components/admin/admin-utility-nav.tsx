'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Building2,
  FileCheck2,
  LayoutDashboard,
  Layers3,
  Menu,
  MessageCircle,
  NotebookPen,
  Scale,
  ShieldCheck,
  UserRoundCheck,
  UserRoundSearch,
  X,
} from 'lucide-react'

export function AdminUtilityNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  if (pathname.startsWith('/admin/accept-invite')) return null

  const desktopItems = [
    ['/admin', 'Console', Building2, pathname === '/admin'],
    [
      '/messages',
      'Messages',
      MessageCircle,
      pathname.startsWith('/messages'),
    ],
    [
      '/admin/notebook',
      'Notebook',
      NotebookPen,
      pathname.startsWith('/admin/notebook'),
    ],
    [
      '/admin/service-engagements',
      'Service records',
      FileCheck2,
      pathname.startsWith('/admin/service-engagements'),
    ],
    [
      '/admin/transaction-governance',
      'Transactions',
      Scale,
      pathname.startsWith('/admin/transaction-governance'),
    ],
    [
      '/admin/client-operations',
      'Client systems',
      Layers3,
      pathname.startsWith('/admin/client-operations'),
    ],
    [
      '/admin/onboarding',
      'Onboarding',
      UserRoundCheck,
      pathname.startsWith('/admin/onboarding'),
    ],
    [
      '/admin/roles',
      'Roles',
      ShieldCheck,
      pathname.startsWith('/admin/roles'),
    ],
    [
      '/admin/planner-profiles',
      'Planner profiles',
      UserRoundSearch,
      pathname.startsWith('/admin/planner-profiles'),
    ],
  ] as const

  const mobileItems = [
    ['/admin', 'Home', LayoutDashboard, pathname === '/admin'],
    [
      '/admin/client-operations',
      'Systems',
      Layers3,
      pathname.startsWith('/admin/client-operations'),
    ],
    [
      '/admin/onboarding',
      'Onboard',
      UserRoundCheck,
      pathname.startsWith('/admin/onboarding'),
    ],
    [
      '/admin/roles',
      'Roles',
      ShieldCheck,
      pathname.startsWith('/admin/roles'),
    ],
  ] as const

  return (
    <>
      <nav
        className="fixed bottom-4 left-1/2 z-50 hidden max-w-[96vw] -translate-x-1/2 items-center gap-1 rounded-full border border-gold/25 bg-espresso/95 p-1.5 shadow-2xl backdrop-blur md:flex"
        aria-label="Wewed administrator navigation"
      >
        {desktopItems.map(([href, label, Icon, active]) => (
          <a
            key={href}
            href={href}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${
              active
                ? 'bg-gold text-espresso'
                : 'text-gold hover:bg-gold/10'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </a>
        ))}
      </nav>

      <nav
        className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 grid grid-cols-5 gap-1 rounded-2xl border border-gold/25 bg-espresso/95 p-1.5 shadow-2xl backdrop-blur md:hidden"
        aria-label="Wewed administrator mobile navigation"
      >
        {mobileItems.map(([href, label, Icon, active]) => (
          <a
            key={href}
            href={href}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[9px] font-semibold ${
              active
                ? 'bg-gold text-espresso'
                : 'text-gold hover:bg-gold/10'
            }`}
          >
            <Icon className="size-4" />
            <span className="truncate">{label}</span>
          </a>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-controls="admin-mobile-more-sheet"
          className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[9px] font-semibold text-gold hover:bg-gold/10"
        >
          <Menu className="size-4" />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm md:hidden" role="presentation">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setMoreOpen(false)} aria-label="Close Admin menu" />
          <section id="admin-mobile-more-sheet" role="dialog" aria-modal="true" aria-label="More Admin navigation" className="absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] rounded-2xl border border-gold/25 bg-espresso p-3 text-champagne shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-gold/12 pb-3">
              <div><p className="text-[9px] uppercase tracking-[0.18em] text-gold">Admin navigation</p><p className="mt-1 text-sm font-semibold">More tools</p></div>
              <button type="button" onClick={() => setMoreOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gold/20 text-gold" aria-label="Close Admin menu"><X className="size-4" /></button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href="/messages" className="flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne"><MessageCircle className="size-4 text-gold" />Messages</a>
              <a href="/admin/notebook" className="flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne"><NotebookPen className="size-4 text-gold" />Notebook</a>
              <a href="/admin/service-engagements" className="flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne"><FileCheck2 className="size-4 text-gold" />Service records</a>
              <a href="/admin/transaction-governance" className="flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne"><Scale className="size-4 text-gold" />Transactions</a>
              <a href="/admin/planner-profiles" className="flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne"><UserRoundSearch className="size-4 text-gold" />Planner profiles</a>
              <a href="/admin/client-operations" className="flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne"><Layers3 className="size-4 text-gold" />Client systems</a>
              <a href="/admin/onboarding" className="flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne"><UserRoundCheck className="size-4 text-gold" />Onboarding</a>
              <a href="/admin/roles" className="flex min-h-14 items-center gap-2 rounded-xl border border-gold/12 bg-white/[0.025] px-3 text-xs font-semibold text-champagne"><ShieldCheck className="size-4 text-gold" />Roles & access</a>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
