'use client'

import Link from 'next/link'
import {
  CalendarDays,
  ExternalLink,
  Heart,
  Loader2,
  LockKeyhole,
  MapPin,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvitationRsvpDialog } from '@/components/wedding/invitation-rsvp-dialog'
import { RsvpSection } from '@/components/wedding/rsvp-section'
import { ShareSection } from '@/components/wedding/share-section'
import { ThemeApplier } from '@/components/wedding/theme-applier'
import { WeddingPlatformNav } from '@/components/wedding/wedding-platform-nav'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function DataBackedWeddingExperience() {
  const {
    wedding,
    content,
    loading,
    error,
    slug,
  } = useWeddingContext()

  if (loading && !wedding) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ivory text-espresso">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-gold-muted" />
          <p className="mt-4 text-sm text-espresso/60">Opening this wedding…</p>
        </div>
      </main>
    )
  }

  if (!wedding || error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ivory px-6 text-espresso">
        <div className="max-w-lg rounded-3xl border border-clay/25 bg-white p-8 text-center shadow-lg">
          <LockKeyhole className="mx-auto size-9 text-clay" />
          <h1 className="mt-4 font-serif text-3xl">Wedding unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-espresso/60">
            {error || 'This wedding could not be loaded.'}
          </p>
          <Button asChild className="mt-6 bg-gold text-espresso hover:bg-gold-light">
            <Link href="/">Return to Wewed</Link>
          </Button>
        </div>
      </main>
    )
  }

  const names = `${wedding.couple.partner1} & ${wedding.couple.partner2}`
  const place = [wedding.venue, wedding.venueCity, wedding.venueCountry]
    .filter(Boolean)
    .join(', ')
  const storyTitle = content.story?.title?.trim() || ''
  const storyBody =
    content.story?.body?.trim() ||
    content.story?.introduction?.trim() ||
    content.about?.body?.trim() ||
    ''
  const welcome =
    content.hero?.welcome?.trim() ||
    content.hero?.subtitle?.trim() ||
    wedding.tagline ||
    'We are delighted to celebrate this day with the people we love.'

  return (
    <div
      className="min-h-screen bg-ivory text-espresso"
      style={{
        '--wedding-primary': wedding.theme.primaryColor,
        '--wedding-accent': wedding.theme.accentColor,
      } as React.CSSProperties}
      data-testid="data-backed-wedding-experience"
    >
      <ThemeApplier />
      <header className="relative isolate overflow-hidden bg-espresso text-champagne">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-70"
          style={{
            background: `radial-gradient(circle at 15% 20%, ${wedding.theme.primaryColor}55, transparent 34%), radial-gradient(circle at 85% 80%, ${wedding.theme.accentColor}44, transparent 36%)`,
          }}
        />
        <nav className="relative z-10 border-b border-champagne/10 px-4 py-4 sm:px-6" aria-label="Wedding navigation">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <Link href={`/w/${encodeURIComponent(slug)}`} className="font-serif text-xl text-champagne">
              {wedding.monogram || names}
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <a href="#details" className="rounded-full px-3 py-2 text-champagne/70 hover:bg-champagne/10 hover:text-champagne">Details</a>
              <a href="#rsvp" className="rounded-full px-3 py-2 text-champagne/70 hover:bg-champagne/10 hover:text-champagne">RSVP</a>
              <Link href="/" className="inline-flex items-center gap-1 rounded-full border border-gold/30 px-3 py-2 text-gold hover:bg-gold/10">
                Wewed <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>
        </nav>
        <WeddingPlatformNav slug={slug} />
        <div className="relative mx-auto flex min-h-[38rem] max-w-6xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">Private wedding invitation</p>
          <p className="mt-7 font-serif text-2xl text-gold">{names}</p>
          <h1 className="mt-4 max-w-5xl font-serif text-5xl leading-[0.95] sm:text-7xl lg:text-8xl">
            {wedding.title}
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-champagne/70 sm:text-lg">{welcome}</p>
          <div className="mt-10 flex flex-col items-center gap-3 text-sm text-champagne/80 sm:flex-row sm:gap-6">
            <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-gold" />{formatDate(wedding.date)}</span>
            <span className="hidden size-1 rounded-full bg-gold sm:block" />
            <span className="inline-flex items-center gap-2"><MapPin className="size-4 text-gold" />{place}</span>
          </div>
        </div>
      </header>

      <main>
        <section id="details" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-6 lg:grid-cols-3">
            <article className="rounded-3xl border border-gold/20 bg-white p-7 shadow-sm">
              <CalendarDays className="size-7 text-gold-muted" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Wedding date</p>
              <h2 className="mt-2 font-serif text-3xl">{formatDate(wedding.date)}</h2>
            </article>
            <article className="rounded-3xl border border-gold/20 bg-white p-7 shadow-sm">
              <MapPin className="size-7 text-gold-muted" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Venue</p>
              <h2 className="mt-2 font-serif text-3xl">{wedding.venue}</h2>
              <p className="mt-2 text-sm text-espresso/60">{[wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ')}</p>
              {wedding.venueMapUrl && (
                <Button asChild variant="outline" className="mt-5">
                  <a href={wedding.venueMapUrl} target="_blank" rel="noreferrer"><MapPin className="size-4" />Directions</a>
                </Button>
              )}
            </article>
            <article className="rounded-3xl border border-gold/20 bg-white p-7 shadow-sm">
              <Users className="size-7 text-gold-muted" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Your hosts</p>
              <h2 className="mt-2 font-serif text-3xl">{names}</h2>
              <p className="mt-2 text-sm text-espresso/60">Wedding details are loaded only from this wedding&apos;s record.</p>
            </article>
          </div>
        </section>

        {(storyTitle || storyBody) && (
          <section className="border-y border-gold/15 bg-white py-16 sm:py-24">
            <div className="mx-auto max-w-3xl px-5 text-center">
              <Heart className="mx-auto size-8 text-gold-muted" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Our story</p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl">{storyTitle || names}</h2>
              {storyBody && <p className="mt-6 whitespace-pre-line text-base leading-8 text-espresso/65">{storyBody}</p>}
            </div>
          </section>
        )}

        <div id="rsvp">
          <RsvpSection />
        </div>
        <ShareSection />
      </main>

      <footer className="border-t border-gold/20 bg-espresso px-5 py-10 text-champagne">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div><p className="font-serif text-2xl">{names}</p><p className="mt-1 text-xs text-champagne/50">{formatDate(wedding.date)} · {wedding.venue}</p></div>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-champagne/60"><Link href="/">Powered by Wewed</Link><Link href="/planners">Find a planner</Link><Link href="/guest-access-help">Guest access help</Link></div>
        </div>
      </footer>
      <InvitationRsvpDialog />
    </div>
  )
}
