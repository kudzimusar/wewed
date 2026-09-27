'use client'

import { CalendarPlus, Download } from 'lucide-react'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import { Prose, Reveal, SiteSection, usePublishedCopy } from '@/components/wedding/site/primitives'
import {
  googleCalendarLink,
  longWeddingDate,
  venueFullLine,
  weddingIcs,
  weddingIcsName,
} from '@/lib/wedding-site/format'

function downloadIcs(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const actionClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-gold/40 px-5 font-sans text-xs uppercase tracking-[0.18em] text-espresso transition-colors hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold'

/**
 * The programme comes only from ProgrammeItem — the same rows the native Wedding Day reads. With
 * no programme published, guests see the confirmed date and venue and an honest note, never an
 * example schedule.
 */
export function SiteTheDay() {
  const { wedding, programmeItems } = useWeddingContext()
  const heading = usePublishedCopy('theday', 'heading')
  const dressCode = usePublishedCopy('theday', 'dressCode')
  const dressCodeNote = usePublishedCopy('theday', 'dressCodeNote')
  const arrival = usePublishedCopy('theday', 'venueDescription')
  if (!wedding) return null

  const calendar = googleCalendarLink(wedding)
  const place = venueFullLine(wedding)

  return (
    <SiteSection id="theday" eyebrow="The Day" heading={heading || 'The Celebration'} tone="champagne">
      <Reveal className="mx-auto mb-14 max-w-2xl text-center">
        <p className="font-serif text-xl text-espresso sm:text-2xl">
          <time dateTime={wedding.date}>{longWeddingDate(wedding.date)}</time>
        </p>
        {place ? <p className="mt-2 font-sans text-sm uppercase tracking-[0.2em] text-espresso/60">{place}</p> : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {calendar ? (
            <a href={calendar} target="_blank" rel="noopener noreferrer" className={actionClass}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Google Calendar
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
          <button type="button" className={actionClass} onClick={() => downloadIcs(weddingIcs(wedding), weddingIcsName(wedding))}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Add to calendar (.ics)
          </button>
        </div>
      </Reveal>

      <div className={`grid gap-10 ${dressCode || arrival ? 'lg:grid-cols-5' : ''}`}>
        <div className={dressCode || arrival ? 'lg:col-span-3' : 'mx-auto w-full max-w-2xl'}>
          <h3 className="mb-6 font-sans text-[11px] font-medium uppercase tracking-[0.28em] text-gold-muted">Programme</h3>
          {programmeItems.length ? (
            <ol className="relative border-l border-gold/30 pl-6" data-testid="site-programme">
              {programmeItems.map((item, index) => (
                <li key={item.id} className="relative pb-8 last:pb-0">
                  <span className="absolute -left-[1.84rem] top-1.5 h-2.5 w-2.5 rounded-full border border-gold bg-ivory" aria-hidden="true" />
                  <Reveal delay={0.04 * (index % 4)}>
                    <p className="font-sans text-xs font-medium tabular-nums uppercase tracking-[0.2em] text-gold-muted">{item.time}</p>
                    <p className="wewed-heading mt-1 text-xl font-light text-espresso">{item.title}</p>
                    {item.location ? <p className="mt-1 font-sans text-xs text-espresso/55">{item.location}</p> : null}
                    {item.description ? <p className="mt-2 font-sans text-sm leading-6 text-espresso/65">{item.description}</p> : null}
                  </Reveal>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-2xl border border-gold/25 bg-ivory/70 p-6 font-sans text-sm leading-6 text-espresso/65" data-testid="site-programme-pending">
              The order of the day hasn’t been published yet.
            </p>
          )}
        </div>

        {dressCode || arrival ? (
          <div className="space-y-6 lg:col-span-2">
            {dressCode ? (
              <Reveal className="rounded-2xl border border-gold/25 bg-ivory/70 p-6">
                <h3 className="font-sans text-[11px] font-medium uppercase tracking-[0.28em] text-gold-muted">Dress code</h3>
                <p className="wewed-heading mt-3 text-xl font-light text-espresso">{dressCode}</p>
                {dressCodeNote ? <Prose text={dressCodeNote} className="mt-3 font-sans text-sm leading-6 text-espresso/65" /> : null}
              </Reveal>
            ) : null}
            {arrival ? (
              <Reveal className="rounded-2xl border border-gold/25 bg-ivory/70 p-6">
                <h3 className="font-sans text-[11px] font-medium uppercase tracking-[0.28em] text-gold-muted">Arrival</h3>
                <Prose text={arrival} className="mt-3 font-sans text-sm leading-6 text-espresso/70" />
              </Reveal>
            ) : null}
          </div>
        ) : null}
      </div>
    </SiteSection>
  )
}
