import Link from 'next/link'
import { Children, isValidElement, type ReactNode } from 'react'
import { HeartHandshake, Menu, Sparkles } from 'lucide-react'
import { PublicAccountActions } from '@/components/public/public-account-actions'

const PUBLIC_LINKS = [
  ['Find a planner', '/planners'],
  ['For couples', '/#couples'],
  ['For planners', '/for-planners'],
  ['Vendors & venues', '/vendors'],
  ['How it works', '/how-it-works'],
  ['Pricing', '/pricing'],
] as const

export function PublicPlatformShell({ children }: { children: ReactNode }) {
  const isHomepage = Children.toArray(children).some((child) => {
    if (!isValidElement<{ 'data-testid'?: string }>(child)) return false
    return child.props['data-testid'] === 'africa-ready-hero'
  })

  return (
    <div className="min-h-screen bg-ivory text-espresso" data-release="wedding-first-v2">
      <header className="sticky top-0 z-50 border-b border-gold/20 bg-espresso/95 text-champagne shadow-xl backdrop-blur-xl">
        <nav className="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8" aria-label="Wewed public navigation">
          <Link href="/" className="group flex items-center gap-2 font-serif text-2xl text-gold" aria-label="Wewed home">
            <span className="flex size-9 items-center justify-center rounded-full border border-gold/25 bg-gold/10"><HeartHandshake className="size-4" /></span>
            <span>wewed</span>
          </Link>
          <div className="hidden items-center gap-1 text-xs lg:flex">
            {PUBLIC_LINKS.map(([label, href]) => <Link key={href} href={href} className="rounded-full px-3 py-2 text-champagne/75 transition hover:bg-gold/10 hover:text-gold">{label}</Link>)}
          </div>
          <div className="flex items-center gap-2">
            <PublicAccountActions />
            <details className="relative lg:hidden">
              <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-gold/30 text-gold [&::-webkit-details-marker]:hidden" aria-label="Open public navigation"><Menu className="size-4" /></summary>
              <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-gold/20 bg-espresso p-3 shadow-2xl">
                {PUBLIC_LINKS.map(([label, href]) => <Link key={href} href={href} className="block rounded-xl px-3 py-2.5 text-sm text-champagne/80 hover:bg-gold/10 hover:text-gold">{label}</Link>)}
                <Link href="/register" className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gold px-3 py-2.5 text-sm font-semibold text-espresso"><Sparkles className="size-4" />Get started</Link>
              </div>
            </details>
          </div>
        </nav>
      </header>
      <main id="main-content">{children}</main>
      {isHomepage && (
        <section className="relative overflow-hidden border-t border-gold/15 bg-[linear-gradient(120deg,#fffaf4,#f8eee6,#fff7ef)] px-4 py-20 text-center sm:px-6" aria-labelledby="homepage-closing-cta">
          <div className="absolute left-1/2 top-0 size-72 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto max-w-3xl">
            <Sparkles className="mx-auto size-7 text-gold-muted" aria-hidden="true" />
            <h2 id="homepage-closing-cta" className="mt-5 font-serif text-4xl leading-tight sm:text-6xl">Ready to start your forever?</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-espresso/60 sm:text-base">Discover a trusted planner, create your private wedding space or find the professionals who will help bring your celebration to life.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/planners" className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-espresso shadow-lg transition hover:-translate-y-0.5 hover:bg-gold-light">Find your planner</Link>
              <Link href="/register?accountType=couple" className="rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-champagne shadow-lg transition hover:-translate-y-0.5">Get started as a couple</Link>
            </div>
          </div>
        </section>
      )}
      <footer className="border-t border-gold/20 bg-espresso text-champagne">
        <div className="mx-auto grid max-w-[90rem] gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8">
          <div><p className="flex items-center gap-2 font-serif text-3xl text-gold"><HeartHandshake className="size-5" />wewed</p><p className="mt-3 max-w-sm text-sm leading-6 text-champagne/60">Private wedding planning, professional support and memorable guest experiences in one connected platform.</p><p className="mt-5 text-xs text-champagne/45">Made for weddings. Built to bring people together.</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Explore</p><div className="mt-4 flex flex-col gap-2 text-sm text-champagne/70">{PUBLIC_LINKS.slice(0, 3).map(([label, href]) => <Link key={href} href={href} className="hover:text-gold">{label}</Link>)}</div></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Discover</p><div className="mt-4 flex flex-col gap-2 text-sm text-champagne/70">{PUBLIC_LINKS.slice(3).map(([label, href]) => <Link key={href} href={href} className="hover:text-gold">{label}</Link>)}</div></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Access</p><div className="mt-4 flex flex-col gap-2 text-sm text-champagne/70"><Link href="/sign-in" className="hover:text-gold">Sign in</Link><Link href="/guest-access-help" className="hover:text-gold">Guest access help</Link><Link href="/register" className="hover:text-gold">Create a Wewed account</Link><Link href="/vendors/manage" className="hover:text-gold">Manage provider profile</Link></div></div>
        </div>
        <div className="border-t border-gold/10 px-4 py-5 text-center text-xs text-champagne/40">© {new Date().getFullYear()} Wewed. Privacy-led wedding technology.</div>
      </footer>
    </div>
  )
}
