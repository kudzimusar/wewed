'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { ArrowLeft, HeartHandshake, Home, LayoutDashboard, Search, Sparkles } from 'lucide-react'

export function MarketplaceFrame({
  title,
  description,
  children,
  backHref = '/',
  actions,
}: {
  title: string
  description: string
  children: ReactNode
  backHref?: string
  actions?: ReactNode
}) {
  const pathname = usePathname()
  const roleHome = pathname.startsWith('/planner/')
    ? { href: '/planner', label: 'Planner workspace' }
    : pathname.startsWith('/admin/')
      ? { href: '/admin', label: 'Admin console' }
      : { href: '/couple', label: 'Couple dashboard' }

  const eyebrow = pathname.startsWith('/planner/')
    ? 'Planner business centre'
    : pathname.startsWith('/admin/')
      ? 'Marketplace governance'
      : pathname.startsWith('/couple/')
        ? 'Couple planner journey'
        : 'Public planner marketplace'

  return (
    <main data-marketplace-frame data-marketplace-path={pathname} className="min-h-screen bg-ivory text-espresso">
      <header className="relative isolate overflow-hidden border-b border-gold/20 bg-espresso text-champagne">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(191,155,95,0.2),transparent_28%),linear-gradient(100deg,rgba(26,20,16,0.99),rgba(26,20,16,0.9)_58%,rgba(26,20,16,0.7))]" />
        <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <Link href={backHref} aria-label="Back" className="mt-1 rounded-full border border-gold/30 bg-black/20 p-2.5 text-gold backdrop-blur hover:bg-gold hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"><ArrowLeft className="size-4" /></Link>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold"><Sparkles className="size-3" />{eyebrow}</p>
                <h1 className="mt-2 font-serif text-3xl sm:text-5xl">{title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-champagne/75">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">{actions}<span className="hidden size-12 items-center justify-center rounded-full border border-gold/25 bg-gold/10 sm:flex"><HeartHandshake className="size-6 text-gold" /></span></div>
          </div>
          <nav className="mt-7 flex items-center gap-2 overflow-x-auto pb-1 text-xs" aria-label="Marketplace navigation">
            <Link href="/" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/20 bg-black/15 px-3 py-2 text-champagne/80 backdrop-blur hover:bg-gold/10 hover:text-gold"><Home className="size-3.5" />Wewed home</Link>
            <Link href="/planners" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/20 bg-black/15 px-3 py-2 text-champagne/80 backdrop-blur hover:bg-gold/10 hover:text-gold"><Search className="size-3.5" />Planner directory</Link>
            <Link href={roleHome.href} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/20 bg-black/15 px-3 py-2 text-champagne/80 backdrop-blur hover:bg-gold/10 hover:text-gold"><LayoutDashboard className="size-3.5" />{roleHome.label}</Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</section>

      <style jsx global>{`
        [data-marketplace-frame] {
          --wewed-sage-dark: #4c4a2f;
        }
        [data-marketplace-frame] [data-slot='card'].bg-champagne {
          color: var(--color-espresso);
        }
        [data-marketplace-frame] .text-sage-dark {
          color: var(--wewed-sage-dark) !important;
        }
        [data-marketplace-path='/planner/marketplace'] article:has([data-marketplace-status='accepted_interest']) {
          border-color: rgb(92 122 93 / 0.42) !important;
          background: rgb(92 122 93 / 0.09) !important;
        }
        [data-marketplace-path='/planner/marketplace'] article:has([data-marketplace-status='declined']) {
          opacity: 0.78;
        }
        [data-marketplace-path='/planner/marketplace'] article:has([data-marketplace-status='accepted_interest']) > .mt-4.space-y-3,
        [data-marketplace-path='/planner/marketplace'] article:has([data-marketplace-status='declined']) > .mt-4.space-y-3,
        [data-marketplace-path='/planner/marketplace'] article:has([data-marketplace-status='appointed']) > .mt-4.space-y-3,
        [data-marketplace-path='/planner/marketplace'] article:has([data-marketplace-status='withdrawn']) > .mt-4.space-y-3,
        [data-marketplace-path='/planner/marketplace'] article:has([data-marketplace-status='closed']) > .mt-4.space-y-3 {
          display: none !important;
        }
      `}</style>
    </main>
  )
}

export function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const label = normalized === 'accepted_interest'
    ? 'Interest accepted'
    : normalized === 'responded'
      ? 'Response sent'
      : normalized.replaceAll('_', ' ')
  const classes = normalized === 'accepted_interest' || normalized === 'accepted' || normalized === 'authorized'
    ? 'border-sage/50 bg-sage/15 text-sage-dark'
    : normalized === 'declined' || normalized === 'withdrawn' || normalized === 'closed'
      ? 'border-clay/30 bg-clay/10 text-clay'
      : 'border-gold/30 bg-gold/10 text-espresso'

  return <span data-marketplace-status={normalized} role="status" aria-label={`Status: ${label}`} className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${classes}`}>{label}</span>
}
