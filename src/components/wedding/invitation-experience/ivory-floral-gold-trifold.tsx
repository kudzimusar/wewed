'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { DigitalInvitationCardData } from '@/components/wedding/digital-invitation-card'
import './ivory-floral-gold.css'

export type IvoryInvitationView = 'closed' | 'opening' | 'open' | 'details'
type IvoryFloralGoldCardData = DigitalInvitationCardData & {
  venueAddress?: string | null
  venueMapUrl?: string | null
}
type Props = {
  data: IvoryFloralGoldCardData
  open: boolean
  reducedMotion: boolean
  onOpen: () => void
  previewMode?: boolean
  previewView?: IvoryInvitationView
  freezeOpening?: boolean
}
const ART = '/invitation-art/ivory/'
const REQUIRED_ART = [
  'left-door',
  'right-door',
  'open-surface',
  'details-surface',
] as const

function asDate(value: string | Date | null | undefined) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
function formatDate(value: string | Date) {
  const d = asDate(value)
  return d
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(d)
    : String(value)
}
function names(title: string) {
  return title
    .split(/\s+&\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
}
function buildCalendarFile(data: IvoryFloralGoldCardData) {
  const date = asDate(data.date)
  if (!date || typeof window === 'undefined') return
  const start = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
  const endDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  )
  const end = `${endDate.getUTCFullYear()}${String(endDate.getUTCMonth() + 1).padStart(2, '0')}${String(endDate.getUTCDate()).padStart(2, '0')}`
  const location = [data.venueAddress, data.venue, data.venueCity, data.venueCountry]
    .filter(Boolean)
    .join(', ')
  const safe = (value: string) => value.replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wewed//Wedding Invitation//EN',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${safe(data.title)} Wedding`,
    `LOCATION:${safe(location)}`,
    'DESCRIPTION:Wedding invitation saved from Wewed.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'wewed-wedding.ics'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function Art({
  name,
  className = '',
  priority = false,
}: {
  name: string
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      data-artwork={name}
      src={ART + name + '.webp'}
      alt=""
      fill
      sizes="(max-width: 480px) 100vw, 430px"
      unoptimized
      priority={priority}
      draggable={false}
      className={className}
    />
  )
}
function Region({
  box,
  children,
  className = '',
}: {
  box: number[]
  children: React.ReactNode
  className?: string
}) {
  const [x, y, w, h] = box
  return (
    <div
      className={'ivory-ink ' + className}
      style={{ left: x + '%', top: y + '%', width: w + '%', height: h + '%' }}
    >
      {children}
    </div>
  )
}
export function IvoryFloralGoldTriFold({
  data,
  open,
  reducedMotion,
  onOpen,
  previewMode = false,
  previewView,
  freezeOpening = false,
}: Props) {
  const [view, setView] = useState<IvoryInvitationView>('closed')
  const [replay, setReplay] = useState(0)
  const [artworkReady, setArtworkReady] = useState(false)
  const noteRef = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const pair = names(data.title).map((part) => part.split(/\s+/)[0])
  const weddingDate = asDate(data.date)
  const monogram = data.monogram || pair.map((p) => p[0]).join(' · ')

  useEffect(() => {
    let cancelled = false
    const decodeArtwork = (name: (typeof REQUIRED_ART)[number]) =>
      new Promise<void>((resolve) => {
        const image = new window.Image()
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          resolve()
        }
        image.onload = finish
        image.onerror = finish
        image.src = `${ART}${name}.webp`
        if (typeof image.decode === 'function') {
          void image.decode().then(finish).catch(() => {
            if (image.complete) finish()
          })
        } else if (image.complete) {
          finish()
        }
      })

    void Promise.all(REQUIRED_ART.map(decodeArtwork)).then(() => {
      if (!cancelled) setArtworkReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (previewMode && previewView) {
      setView(previewView)
      return
    }
    if (!open && !replay) {
      setView('closed')
      return
    }
    if (!artworkReady) {
      setView('closed')
      return
    }
    setView(reducedMotion ? 'open' : 'opening')
    if (reducedMotion) return
    const timer = window.setTimeout(() => setView('open'), 1800)
    return () => window.clearTimeout(timer)
  }, [open, reducedMotion, replay, previewMode, previewView, artworkReady])
  useEffect(() => {
    if (view === 'open')
      stageRef.current
        ?.querySelector<HTMLButtonElement>('[data-testid="invitation-details-button"]')
        ?.focus({ preventScroll: true })
    if (view === 'details')
      stageRef.current
        ?.querySelector<HTMLButtonElement>('[data-testid="invitation-cta-rsvp"]')
        ?.focus({ preventScroll: true })
  }, [view])
  const location = [data.venue, data.venueAddress, data.venueCity, data.venueCountry]
    .filter(Boolean)
    .join(', ')
  const mapUrl =
    data.venueMapUrl ||
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location)
  const note = data.tagline || data.message || ''
  const opening = view === 'opening'
  function showDetails() {
    setView('details')
  }
  function hit(
    id: string,
    label: string,
    y: number,
    h: number,
    action?: () => void,
    href?: string,
  ) {
    const props = {
      'data-testid': 'invitation-cta-' + id,
      'aria-label': label,
      className: 'ivory-hit',
      style: {
        left: '11%',
        top: y + '%',
        width: '78%',
        height: h + '%',
      } as CSSProperties,
    }
    return href ? (
      <a {...props} href={href} target="_blank" rel="noopener noreferrer" />
    ) : (
      <button {...props} type="button" onClick={action} />
    )
  }
  return (
    <div
      ref={stageRef}
      data-testid="invitation-trifold"
      data-card-object="physical-stationery"
      data-invitation-view={view}
      data-artwork-engine="approved-pixels"
      data-artwork-ready={artworkReady ? 'true' : 'false'}
      data-frozen={previewMode && freezeOpening ? 'true' : 'false'}
      className="ivory-stage"
    >
      {!artworkReady && (
        <p role="status" className="sr-only">
          Preparing your invitation…
        </p>
      )}
      <div
        className="ivory-object"
        style={{
          opacity: artworkReady ? 1 : 0,
          transition: reducedMotion ? 'none' : 'opacity 180ms ease-out',
        }}
      >
        <div
          data-testid="invitation-panel-centre"
          className="ivory-centre"
          inert={view !== 'open'}
          aria-hidden={view !== 'open'}
        >
          <Art name="open-surface" priority />
          <Region box={[27, 20, 46, 19]} className="ivory-names">
            <span>{pair[0]}</span>
            {pair.length > 1 && (
              <>
                <small>{' & '}</small>
                <span>{pair.slice(1).join(' & ')}</span>
              </>
            )}
          </Region>
          <Region box={[24, 43, 52, 12]} className="ivory-message">
            {data.message || 'Request the pleasure of your company as we celebrate our marriage.'}
          </Region>
          <Region box={[24, 57, 52, 8]} className="ivory-date">
            {weddingDate ? (
              <>
                <span>
                  {new Intl.DateTimeFormat('en', {
                    weekday: 'long',
                    timeZone: 'UTC',
                  }).format(weddingDate)}
                </span>
                <div className="ivory-date-parts">
                  <span>
                    {new Intl.DateTimeFormat('en', {
                      month: 'short',
                      timeZone: 'UTC',
                    }).format(weddingDate)}
                  </span>
                  <strong>{weddingDate.getUTCDate()}</strong>
                  <span>{weddingDate.getUTCFullYear()}</span>
                </div>
              </>
            ) : (
              formatDate(data.date)
            )}
          </Region>
          <Region box={[23, 68, 54, 8]} className="ivory-location">
            <strong>{data.venue}</strong>
            <span>{data.venueAddress}</span>
            <span>{[data.venueCity, data.venueCountry].filter(Boolean).join(', ')}</span>
          </Region>
          <Region box={[28, 79, 44, 8]} className="ivory-tagline">
            {data.tagline || ''}
          </Region>
          <Region box={[22, 87, 56, 4]} className="ivory-guest">
            {data.guestName && <span>Especially for {data.guestName}</span>}
            {data.rsvpDeadline && (
              <span data-testid="invitation-rsvp-deadline">
                RSVP by {formatDate(data.rsvpDeadline)}
              </span>
            )}
          </Region>
          <button
            data-testid="invitation-details-button"
            aria-label="Wedding details"
            className="ivory-hit ivory-read"
            onClick={showDetails}
          >
            <span>Wedding details ↓</span>
          </button>
        </div>
        {view === 'details' && (
          <div data-testid="invitation-interactive-details" className="ivory-details">
            <Art name="details-surface" />
            <Region box={[25, 2, 55, 3]} className="ivory-couple">
              {data.title}
            </Region>
            <Region box={[28, 26, 46, 5]} className="ivory-note-intro">
              {note}
            </Region>
            <Region box={[35, 56, 44, 5]} className="ivory-detail-venue">
              <span>{data.venue}</span>
              <span>{data.venueAddress}</span>
              <span>{[data.venueCity, data.venueCountry].filter(Boolean).join(', ')}</span>
            </Region>
            <Region box={[36, 76, 44, 4]} className="ivory-detail-note">
              A special message from us
            </Region>
            {hit('rsvp', 'RSVP', 35, 7.2, () =>
              window.dispatchEvent(new CustomEvent('wewed:open-premium-rsvp')),
            )}
            {hit('calendar', 'Add to Calendar', 44.2, 7.3, () => buildCalendarFile(data))}
            {hit('venue', 'Venue Location', 53.2, 8.4, undefined, mapUrl)}
            {hit('registry', 'Gift / Contributions', 63.4, 7.3, () =>
              window.dispatchEvent(new CustomEvent('wewed:open-contributions')),
            )}
            {hit('note', 'A Note from Us', 72.4, 8, () => noteRef.current?.showModal())}
            <button type="button" className="ivory-back" onClick={() => setView('open')}>
              View invitation
            </button>
            {!previewMode && (
              <button
                type="button"
                className="ivory-site"
                onClick={() => window.location.assign(window.location.pathname)}
              >
                Back to Wewed Couple Site
              </button>
            )}
          </div>
        )}
        {(view === 'closed' || opening) && (
          <div data-testid="invitation-closed-cover" className="ivory-cover" aria-hidden={opening}>
            <span className="sr-only">A special invitation awaits</span>
            {(['left', 'right'] as const).map((side) => (
              <div
                key={side + replay}
                data-testid={'invitation-panel-' + side}
                className={'ivory-door ivory-door-' + side}
              >
                <Art name={side + '-door'} priority />
              </div>
            ))}
            <Region box={[38, 39, 24, 6]} className="ivory-monogram">
              {monogram.replace(/[·|]/g, ' ')}
            </Region>
            {view === 'closed' && (
              <button
                type="button"
                data-testid="invitation-open-button"
                aria-label={open && !artworkReady ? 'Preparing invitation' : 'Tap to open'}
                className="ivory-hit ivory-open"
                disabled={open && !artworkReady}
                onClick={onOpen}
              />
            )}
          </div>
        )}
        {opening && (
          <p role="status" className="sr-only">
            Opening your invitation…
          </p>
        )}
      </div>
      {previewMode && (view === 'open' || view === 'details') && (
        <button
          type="button"
          data-testid="invitation-replay-button"
          className="ivory-replay"
          onClick={() => {
            setReplay((v) => v + 1)
          }}
        >
          Replay opening
        </button>
      )}
      <dialog
        ref={noteRef}
        className="ivory-note"
        aria-label="A note from us"
        onClose={() =>
          stageRef.current
            ?.querySelector<HTMLButtonElement>('[data-testid="invitation-cta-note"]')
            ?.focus()
        }
      >
        <h2>A note from us</h2>
        <p>{note}</p>
        <form method="dialog">
          <button autoFocus aria-label="Close note">
            Close
          </button>
        </form>
      </dialog>
    </div>
  )
}