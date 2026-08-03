import Link from 'next/link'
import type { ReactNode } from 'react'
import { HeartHandshake } from 'lucide-react'

const PUBLIC_LINKS = [
  ['Find a planner', '/planners'],
  ['For planners', '/for-planners'],
  ['How it works', '/how-it-works'],
  ['Pricing', '/pricing'],
] as const

export function PublicPlatformShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory text-espresso">
      <header className="sticky top-0 z-50 border-b border-gold/20 bg-espresso/95 text-champagne shadow-lg backdrop-blur">
        <nav className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8" aria-label="Wewed public navigation">
          <Link href="/" className="flex items-center gap-2 font-serif text-2xl text-gold">
            <HeartHandshake className="size-5" /> wewed
          </Link>
          <div className="order-3 flex w-full items-center gap-2 overflow-x-auto pb-1 text-xs sm:order-2 sm:w-auto sm:pb-0">
            {PUBLIC_LINKS.map(([label, href]) => (
              <Link key={href} href={href} className="shrink-0 rounded-full px-3 py-2 text-champagne/75 transition hover:bg-gold/10 hover:text-gold">
                {label}
              </Link>
            ))}
          </div>
          <Link href="/sign-in" className="order-2 rounded-full border border-gold/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gold transition hover:bg-gold hover:text-espresso sm:order-3">
            Sign in
          </Link>
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="border-t border-gold/20 bg-espresso text-champagne">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
          <div>
            <p className="font-serif text-2xl text-gold">wewed</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-champagne/55">Private wedding spaces, professional planning and lasting wedding memories—connected without mixing permissions.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-champagne/65">
            {PUBLIC_LINKS.map(([label, href]) => <Link key={href} href={href} className="hover:text-gold">{label}</Link>)}
          </div>
          <div className="flex flex-col gap-2 text-sm text-champagne/65">
            <Link href="/sign-in" className="hover:text-gold">Sign in</Link>
            <Link href="/guest-access-help" className="hover:text-gold">Guest access help</Link>
            <Link href="/register" className="hover:text-gold">Create a Wewed account</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
