'use client'

import { Music } from 'lucide-react'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import { SiteSection, isSafeHttpUrl, usePublishedCopy } from '@/components/wedding/site/primitives'

/** The couple's chosen songs (Song rows). No sample tracks and no vote counts. */
export function SiteSongbook() {
  const { songs } = useWeddingContext()
  const heading = usePublishedCopy('songbook', 'heading')
  const subtitle = usePublishedCopy('songbook', 'subtitle')
  if (!songs.length) return null
  return (
    <SiteSection id="songbook" eyebrow="Songbook" heading={heading || 'Our Songs'} subtitle={subtitle || undefined}>
      <ol className="mx-auto max-w-3xl divide-y divide-gold/15 rounded-2xl border border-gold/20 bg-champagne/30" data-testid="site-songbook">
        {songs.map((song) => {
          const listen = song.spotifyUrl && isSafeHttpUrl(song.spotifyUrl) ? song.spotifyUrl : song.appleUrl && isSafeHttpUrl(song.appleUrl) ? song.appleUrl : null
          return (
            <li key={song.id} className="flex items-center gap-4 px-5 py-4 sm:px-7">
              <Music className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-lg text-espresso">{song.title}</p>
                <p className="truncate font-sans text-xs text-espresso/55">
                  {[song.artist, song.moment].filter(Boolean).join(' · ')}
                </p>
              </div>
              {listen ? (
                <a
                  href={listen}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center font-sans text-[11px] uppercase tracking-[0.18em] text-espresso/70 underline decoration-gold/40 underline-offset-4 hover:text-gold"
                >
                  Listen<span className="sr-only"> to {song.title} (opens in a new tab)</span>
                </a>
              ) : null}
            </li>
          )
        })}
      </ol>
    </SiteSection>
  )
}
