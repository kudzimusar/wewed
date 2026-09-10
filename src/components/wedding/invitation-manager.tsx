'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
  RotateCcw,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PremiumInvitationStudio } from '@/components/wedding/invitation-experience/premium-invitation-studio'
import {
  normalizeInvitationCardStyle,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

interface InvitationRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  tableNumber: number | null
  status: string
  checkedIn: boolean
  invitationUrl: string | null
  qrValue: string | null
  shareMessage: string | null
}

interface InvitationWedding {
  slug: string
  title: string
  monogram: string | null
  tagline: string | null
  date: string
  venue: string
  venueCity: string
  venueCountry: string
  primaryColor: string
  accentColor: string
  backgroundColor: string
  invitationCardStyle: InvitationCardStyle
  invitationCardMessage: string | null
  rsvpDeadline: string | null
}

function GuestQr({ value, name }: { value: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 240,
      color: { dark: '#1A1410', light: '#FBF6EE' },
    }).then((result) => { if (!cancelled) setSrc(result) })
    return () => { cancelled = true }
  }, [value])

  if (!src) return <div className="flex size-36 items-center justify-center rounded-xl bg-white"><Loader2 className="size-5 animate-spin text-gold-muted" /></div>
  return <img src={src} alt={`Private digital invitation QR code for ${name}`} className="size-36 rounded-xl border border-gold/20 bg-white p-2" />
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export function InvitationManager({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<InvitationRow[]>([])
  const [wedding, setWedding] = useState<InvitationWedding | null>(null)
  const [draftStyle, setDraftStyle] = useState<InvitationCardStyle>('botanical')
  const [draftMessage, setDraftMessage] = useState('')
  const [draftDeadline, setDraftDeadline] = useState('')
  const [busy, setBusy] = useState<string | null>('load')
  const [copied, setCopied] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy('load')
    setError(null)
    try {
      const repair = await fetch('/api/planner/guests/invitations', { method: 'POST' })
      const repairPayload = await repair.json()
      if (!repair.ok || !repairPayload.success) throw new Error(repairPayload.error || 'Unable to prepare invitations.')
      const response = await fetch('/api/planner/guests/invitations', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load invitations.')
      const nextWedding = {
        ...payload.wedding,
        invitationCardStyle: normalizeInvitationCardStyle(payload.wedding.invitationCardStyle),
      } as InvitationWedding
      setRows(payload.data)
      setWedding(nextWedding)
      setDraftStyle(nextWedding.invitationCardStyle)
      setDraftMessage(nextWedding.invitationCardMessage || '')
      setDraftDeadline(dateInputValue(nextWedding.rsvpDeadline))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load invitations.')
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const previewData = useMemo(() => wedding ? {
    title: wedding.title,
    monogram: wedding.monogram,
    tagline: wedding.tagline,
    date: wedding.date,
    venue: wedding.venue,
    venueCity: wedding.venueCity,
    venueCountry: wedding.venueCountry,
    guestName: null,
    message: draftMessage,
    rsvpDeadline: draftDeadline || null,
    primaryColor: wedding.primaryColor,
    accentColor: wedding.accentColor,
    backgroundColor: wedding.backgroundColor,
  } : null, [draftDeadline, draftMessage, wedding])

  async function rememberCopied(key: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    window.setTimeout(() => setCopied((current) => current === key ? null : current), 1800)
  }

  async function copyLink(row: InvitationRow) {
    if (row.invitationUrl) await rememberCopied(`link-${row.id}`, row.invitationUrl)
  }

  async function copyMessage(row: InvitationRow) {
    if (row.shareMessage) await rememberCopied(`message-${row.id}`, row.shareMessage)
  }

  async function share(row: InvitationRow) {
    if (!row.invitationUrl || !row.shareMessage) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: wedding?.title || 'Wedding invitation',
          text: row.shareMessage,
          url: row.invitationUrl,
        })
        return
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
      }
    }
    await rememberCopied(`share-${row.id}`, row.shareMessage)
  }

  async function saveDesign() {
    setBusy('design')
    setError(null)
    setSaved(false)
    try {
      const response = await fetch('/api/planner/guests/invitations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: draftStyle, message: draftMessage, rsvpDeadline: draftDeadline || null }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save invitation card design.')
      setSaved(true)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save invitation card design.')
      setBusy(null)
    }
  }

  async function rotate(row: InvitationRow) {
    if (!window.confirm(`Rotate ${row.name}'s invitation? Their previous link and active guest session will stop working immediately.`)) return
    setBusy(row.id)
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: row.id }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to rotate invitation.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to rotate invitation.')
      setBusy(null)
    }
  }

  function downloadCsv() {
    window.location.href = '/api/planner/guests/invitations?format=csv'
  }

  return (
    <section className={compact ? '' : 'rounded-3xl border border-gold/20 bg-white p-5 sm:p-7'}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Digital wedding cards & RSVP</p>
          <h2 className="mt-2 font-serif text-3xl">{wedding?.title || 'Active wedding'}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-espresso/60">Choose a premium invitation experience. Personal QR codes and share messages securely recognise each guest, remove the private credential from the address bar, and carry the selected design into their RSVP journey.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void load()} disabled={busy !== null}><RefreshCw className={`size-4 ${busy === 'load' ? 'animate-spin' : ''}`} />Refresh</Button>
          <Button type="button" variant="outline" onClick={downloadCsv}><Download className="size-4" />Invitation CSV</Button>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-clay/30 bg-clay/10 p-3 text-sm">{error}</p>}

      {previewData && (
        <PremiumInvitationStudio
          data={previewData}
          style={draftStyle}
          message={draftMessage}
          deadline={draftDeadline}
          saved={saved}
          busy={busy !== null}
          onStyleChange={(next) => { setDraftStyle(next); setSaved(false) }}
          onMessageChange={(next) => { setDraftMessage(next); setSaved(false) }}
          onDeadlineChange={(next) => { setDraftDeadline(next); setSaved(false) }}
          onSave={() => void saveDesign()}
        />
      )}

      <section className="mt-7" aria-labelledby="personal-invitation-delivery-heading">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Personal delivery</p>
          <h3 id="personal-invitation-delivery-heading" className="mt-1 font-serif text-2xl">Guest-specific links & QR codes</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-espresso/50">Each link is personal to one guest. The bulk physical invitation QR remains a separate shared-access feature.</p>
        </div>

        {busy === 'load' && rows.length === 0 ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold-muted" /></div> : (
          <div className="grid gap-5 lg:grid-cols-2">
            {rows.map((row) => (
              <article key={row.id} className="grid gap-5 rounded-2xl border border-gold/20 bg-champagne p-5 sm:grid-cols-[9rem_1fr]">
                {row.qrValue ? <GuestQr value={row.qrValue} name={row.name} /> : <div className="flex size-36 items-center justify-center rounded-xl border border-dashed border-gold/30"><QrCode className="size-9 text-gold/40" /></div>}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-serif text-2xl">{row.name}</h3><p className="mt-1 text-xs text-espresso/55">{row.email || row.phone || 'No contact saved'}</p></div><span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">{row.status}</span></div>
                  <p className="mt-3 text-xs text-espresso/55">Table: {row.tableNumber ?? 'Not assigned'} · {row.checkedIn ? 'Checked in' : 'Not checked in'}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void copyMessage(row)} disabled={!row.shareMessage}><Copy className="size-4" />{copied === `message-${row.id}` ? 'Message copied' : 'Copy message'}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void share(row)} disabled={!row.invitationUrl}><Share2 className="size-4" />{copied === `share-${row.id}` ? 'Copied' : 'Share card'}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void copyLink(row)} disabled={!row.invitationUrl}>{copied === `link-${row.id}` ? <Check className="size-4" /> : <Copy className="size-4" />}{copied === `link-${row.id}` ? 'Link copied' : 'Copy link'}</Button>
                    {row.invitationUrl && <Button asChild size="sm" variant="outline"><a href={row.invitationUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Preview guest journey</a></Button>}
                    <Button type="button" size="sm" variant="outline" onClick={() => void rotate(row)} disabled={busy !== null}><RotateCcw className={`size-4 ${busy === row.id ? 'animate-spin' : ''}`} />Rotate</Button>
                  </div>
                </div>
              </article>
            ))}
            {rows.length === 0 && <p className="rounded-2xl border border-dashed border-gold/30 p-8 text-center text-sm text-espresso/55 lg:col-span-2">Add guests to generate private digital invitation cards, links and QR codes.</p>}
          </div>
        )}
      </section>
    </section>
  )
}
