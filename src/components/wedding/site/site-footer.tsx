'use client'

import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import { coupleDisplayNames, longWeddingDate } from '@/lib/wedding-site/format'

export function SiteFooter() {
  const { wedding } = useWeddingContext()
  if (!wedding) return null
  return (
    <footer className="bg-espresso px-5 py-14 text-center text-champagne/70 sm:px-8">
      {wedding.monogram ? (
        <p className="wewed-monogram text-sm tracking-[0.5em] text-gold" aria-hidden="true">
          {wedding.monogram}
        </p>
      ) : null}
      <p className="wewed-heading mt-4 text-2xl font-light text-champagne">{coupleDisplayNames(wedding)}</p>
      <p className="mt-2 font-sans text-xs uppercase tracking-[0.24em]">
        <time dateTime={wedding.date}>{longWeddingDate(wedding.date)}</time>
      </p>
      <p className="mt-8 font-sans text-[10px] uppercase tracking-[0.24em] text-champagne/40">
        <a href="/guest-access-help" className="inline-flex min-h-11 items-center hover:text-gold">Guest help</a>
      </p>
    </footer>
  )
}
