'use client'

import Link from 'next/link'
import { ArrowUp } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'

export function Footer() {
  const currentYear = new Date().getFullYear()
  const ctx = useWeddingContextSafe()
  const monogram = ctx?.getContent('hero', 'monogram', 'Wewed wedding') || 'Wewed wedding'

  const handleBackToTop = () => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' })
  }

  return (
    <footer className="mt-auto bg-espresso">
      <Separator className="bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:py-12">
        <p className="wewed-monogram text-base tracking-[0.25em] sm:text-lg">{monogram}</p>
        <p className="mt-3 font-serif text-sm font-light italic text-champagne/50 sm:text-base">wewed — where love lives forever</p>
        <nav className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-3 text-xs text-champagne/55" aria-label="Wedding footer links">
          <Link href="/" className="hover:text-gold">Powered by Wewed</Link>
          <Link href="/planners" className="hover:text-gold">Find a planner</Link>
          <Link href="/guest-access-help" className="hover:text-gold">Guest access help</Link>
          <Link href="/how-it-works" className="hover:text-gold">Privacy model</Link>
        </nav>
        <button onClick={handleBackToTop} className="group mt-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-2 font-sans text-[10px] uppercase tracking-[0.22em] text-gold/80 transition-all hover:border-gold hover:bg-gold/10 hover:text-gold" aria-label="Back to top"><ArrowUp className="h-3 w-3 transition-transform group-hover:-translate-y-0.5" />Back to top</button>
        <p className="mt-6 font-sans text-[10px] tracking-wider text-champagne/25 sm:text-xs">&copy; {currentYear === 2026 ? '2026' : `2026–${currentYear}`} Wewed. All rights reserved.</p>
      </div>
    </footer>
  )
}
