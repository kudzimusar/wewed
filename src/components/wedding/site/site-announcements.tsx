'use client'

import { Megaphone } from 'lucide-react'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import { shortWeddingDate } from '@/lib/wedding-site/format'

/**
 * Published announcements — the same WeddingAnnouncement projection native Wedding Day reads.
 * With none published nothing renders.
 */
export function SiteAnnouncements() {
  const { announcements } = useWeddingContext()
  if (!announcements.length) return null
  return (
    <section id="announcements" aria-labelledby="announcements-heading" className="bg-ivory px-5 pt-14 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 id="announcements-heading" className="sr-only">Announcements</h2>
        <ul className="space-y-4" data-testid="site-announcements">
          {announcements.map((item) => (
            <li key={item.id} className="flex gap-4 rounded-2xl border border-gold/30 bg-champagne/50 p-5 sm:p-6">
              <Megaphone className="mt-1 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
              <div>
                <p className="wewed-heading text-lg font-light text-espresso">{item.title}</p>
                <p className="mt-2 whitespace-pre-line font-sans text-sm leading-6 text-espresso/70">{item.body}</p>
                {item.publishedAt ? (
                  <p className="mt-3 font-sans text-[11px] uppercase tracking-[0.22em] text-espresso/45">
                    <time dateTime={item.publishedAt}>{shortWeddingDate(item.publishedAt)}</time>
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
