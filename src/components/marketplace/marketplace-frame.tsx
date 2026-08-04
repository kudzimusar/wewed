'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { ArrowLeft, HeartHandshake, Home, LayoutDashboard, Search } from 'lucide-react'

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

  return (
    <main className="min-h-screen bg-ivory text-espresso">
      <header className="border-b border-gold/20 bg-espresso text-champagne">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href={backHref} aria-label="Back" className="rounded-full border border-gold/30 p-2 text-gold hover:bg-gold/10"><ArrowLeft className="size-4" /></Link>
              <div className="min-w-0"><p className="wewed-monogram text-[10px] tracking-[0.22em] text-gold">WEWED MARKETPLACE</p><h1 className="truncate wewed-heading text-2xl sm:text-3xl">{title}</h1></div>
            </div>
            <div className="flex items-center gap-3">{actions}<HeartHandshake className="hidden size-7 text-gold sm:block" /></div>
          </div>
          <nav className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 text-xs" aria-label="Marketplace navigation">
            <Link href="/" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/20 px-3 py-2 text-champagne/70 hover:bg-gold/10 hover:text-gold"><Home className="size-3.5" />Wewed home</Link>
            <Link href="/planners" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/20 px-3 py-2 text-champagne/70 hover:bg-gold/10 hover:text-gold"><Search className="size-3.5" />Planner directory</Link>
            <Link href={roleHome.href} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/20 px-3 py-2 text-champagne/70 hover:bg-gold/10 hover:text-gold"><LayoutDashboard className="size-3.5" />{roleHome.label}</Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><p className="mb-8 max-w-3xl text-sm leading-6 text-espresso/65 sm:text-base">{description}</p>{children}</section>
    </main>
  )
}

export function StatusPill({ value }: { value: string }) {
  return <span className="inline-flex rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-espresso">{value.replaceAll('_', ' ')}</span>
}
