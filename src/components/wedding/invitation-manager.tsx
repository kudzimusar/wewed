'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PremiumInvitationStudio } from '@/components/wedding/invitation-experience/premium-invitation-studio'
import {
  normalizeInvitationCardStyle,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

type ChildrenPolicy = 'welcome' | 'adults_only'
type DeliveryStatus = 'not_sent' | 'sent' | 'opened'
type DeliveryChannel = 'whatsapp' | 'email' | 'sms' | 'other' | 'in_person'

interface InvitationDelivery {
  status: DeliveryStatus
  sentAt: string | null
  sentChannel: string | null
  openedAt: string | null
}

interface InvitationRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  tableNumber: number | null
  status: 'attending' | 'declined' | 'pending'
  checkedIn: boolean
  invitationUrl: string | null
  qrValue: string | null
  shareMessage: string | null
  delivery?: InvitationDelivery
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
  childrenPolicy: ChildrenPolicy
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

  if (!src) {
    return (
      <div className="flex size-36 items-center justify-center rounded-xl bg-white">
        <Loader2 className="size-5 animate-spin text-gold-muted" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={`Private digital invitation QR code for ${name}`}
      className="size-36 rounded-xl border border-gold/20 bg-white p-2"
    />
  )
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function shortDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function deliveryFor(row: InvitationRow): InvitationDelivery {
  return row.delivery ?? {
    status: 'not_sent',
    sentAt: null,
    sentChannel: null,
    openedAt: null,
  }
}

function deliveryLabel(row: InvitationRow): string {
  const delivery = deliveryFor(row)
  if (delivery.status === 'opened') return 'Opened'
  if (delivery.status === 'sent') return delivery.sentChannel ? `Sent · ${delivery.sentChannel}` : 'Sent'
  return 'Not sent'
}

function deliveryClass(row: InvitationRow): string {
  const status = deliveryFor(row).status
  if (status === 'opened') return 'border-sage/30 bg-sage/10 text-sage'
  if (status === 'sent') return 'border-gold/30 bg-gold/10 text-gold-muted'
  return 'border-espresso/10 bg-white text-espresso/45'
}

function whatsappUrl(row: InvitationRow): string | null {
  if (!row.phone || !row.shareMessage) return null
  const digits = row.phone.replace(/\D/g, '')
  if (digits.length < 7) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(row.shareMessage)}`
}

function emailUrl(row: InvitationRow): string | null {
  if (!row.email || !row.shareMessage) return null
  const subject = 'Your Wewed wedding invitation'
  return `mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(row.shareMessage)}`
}

export function InvitationManager({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<InvitationRow[]>([])
  const [wedding, setWedding] = useState<InvitationWedding | null>(null)
  const [draftStyle, setDraftStyle] = useState<InvitationCardStyle>('botanical')
  const [draftMessage, setDraftMessage] = useState('')
  const [draftDeadline, setDraftDeadline] = useState('')
  const [draftChildrenPolicy, setDraftChildrenPolicy] = useState<ChildrenPolicy>('welcome')
  const [busy, setBusy] = useState<string | null>('load')
  const [copied, setCopied] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [missingTokens, setMissingTokens] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [rsvpFilter, setRsvpFilter] = useState<'all' | InvitationRow['status']>('all')
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | DeliveryStatus>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>('whatsapp')

  const [newGuest, setNewGuest] = useState({ name: '', email: '', phone: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editGuest, setEditGuest] = useState({ name: '', email: '', phone: '' })

  const load = useCallback(async () => {
    setBusy('load')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load invitations.')

      const nextWedding = {
        ...payload.wedding,
        invitationCardStyle: normalizeInvitationCardStyle(payload.wedding.invitationCardStyle),
        childrenPolicy: payload.wedding.childrenPolicy === 'adults_only' ? 'adults_only' : 'welcome',
      } as InvitationWedding
      const nextRows = payload.data as InvitationRow[]

      setRows(nextRows)
      setSelected((current) => new Set(Array.from(current).filter((id) => nextRows.some((row) => row.id === id))))
      setMissingTokens(typeof payload.missingTokens === 'number' ? payload.missingTokens : 0)
      setWedding(nextWedding)
      setDraftStyle(nextWedding.invitationCardStyle)
      setDraftMessage(nextWedding.invitationCardMessage || '')
      setDraftDeadline(dateInputValue(nextWedding.rsvpDeadline))
      setDraftChildrenPolicy(nextWedding.childrenPolicy)
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

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (query && ![row.name, row.email ?? '', row.phone ?? ''].some((value) => value.toLowerCase().includes(query))) return false
      if (rsvpFilter !== 'all' && row.status !== rsvpFilter) return false
      if (deliveryFilter !== 'all' && deliveryFor(row).status !== deliveryFilter) return false
      return true
    })
  }, [deliveryFilter, rows, rsvpFilter, search])

  const counts = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((row) => row.status === 'pending').length,
    notSent: rows.filter((row) => deliveryFor(row).status === 'not_sent').length,
    sent: rows.filter((row) => deliveryFor(row).status === 'sent').length,
    opened: rows.filter((row) => deliveryFor(row).status === 'opened').length,
  }), [rows])

  const visibleSelected = filteredRows.filter((row) => selected.has(row.id))
  const allVisibleSelected = filteredRows.length > 0 && visibleSelected.length === filteredRows.length

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
          title: wedding?.title ? `Wewed · ${wedding.title}` : 'Wewed · Private wedding invitation',
          text: row.shareMessage,
        })
        return
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
      }
    }
    await rememberCopied(`share-${row.id}`, row.shareMessage)
  }

  async function generateMissingLinks() {
    if (missingTokens <= 0) return
    if (!window.confirm(`Generate private invitation links for ${missingTokens} guest${missingTokens === 1 ? '' : 's'} who do not have one yet?`)) return

    setBusy('repair')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to generate missing invitation links.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to generate missing invitation links.')
      setBusy(null)
    }
  }

  async function saveDesign() {
    setBusy('design')
    setError(null)
    setSaved(false)
    try {
      const response = await fetch('/api/planner/guests/invitations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: draftStyle,
          message: draftMessage,
          rsvpDeadline: draftDeadline || null,
          childrenPolicy: draftChildrenPolicy,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save invitation settings.')
      setSaved(true)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save invitation settings.')
      setBusy(null)
    }
  }

  async function rotate(row: InvitationRow) {
    if (!window.confirm(`Rotate ${row.name}'s invitation? Their previous link and active guest session will stop working immediately.`)) return
    setBusy(`rotate-${row.id}`)
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

  async function trackDelivery(guestIds: string[], action: 'mark_sent' | 'reset') {
    if (guestIds.length === 0) return
    setBusy('tracking')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          guestIds,
          channel: action === 'mark_sent' ? deliveryChannel : undefined,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to update delivery tracking.')
      if (action === 'reset') setSelected(new Set())
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update delivery tracking.')
      setBusy(null)
    }
  }

  async function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newGuest.name.trim()) return
    setBusy('add-guest')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'guest',
          name: newGuest.name.trim(),
          email: newGuest.email.trim() || null,
          phone: newGuest.phone.trim() || null,
          role: 'guest',
          side: 'neutral',
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to add guest.')
      setNewGuest({ name: '', email: '', phone: '' })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add guest.')
      setBusy(null)
    }
  }

  function startEdit(row: InvitationRow) {
    setEditingId(row.id)
    setEditGuest({ name: row.name, email: row.email ?? '', phone: row.phone ?? '' })
  }

  async function saveGuest(row: InvitationRow) {
    if (!editGuest.name.trim()) return
    setBusy(`edit-${row.id}`)
    setError(null)
    try {
      const response = await fetch(`/api/planner/guests/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editGuest.name.trim(),
          email: editGuest.email.trim() || null,
          phone: editGuest.phone.trim() || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to update guest.')
      setEditingId(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update guest.')
      setBusy(null)
    }
  }

  async function removeGuest(row: InvitationRow) {
    if (!window.confirm(`Remove ${row.name} from this wedding's guest list? This also removes their personal invitation and RSVP record.`)) return
    setBusy(`delete-${row.id}`)
    setError(null)
    try {
      const response = await fetch(`/api/planner/guests/${encodeURIComponent(row.id)}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to remove guest.')
      setSelected((current) => {
        const next = new Set(current)
        next.delete(row.id)
        return next
      })
      if (expandedId === row.id) setExpandedId(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to remove guest.')
      setBusy(null)
    }
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current)
      if (allVisibleSelected) filteredRows.forEach((row) => next.delete(row.id))
      else filteredRows.forEach((row) => next.add(row.id))
      return next
    })
  }

  function downloadCsv() {
    window.location.href = '/api/planner/guests/invitations?format=csv'
  }

  return (
    <section className={compact ? '' : 'rounded-3xl border border-gold/20 bg-white p-4 text-espresso sm:p-7'}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Guest invitation desk</p>
          <h2 className="mt-2 font-serif text-3xl">{wedding?.title || 'Active wedding'}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-espresso/60">
            Search, select, maintain and track personal invitations from one durable workspace.
            “Opened” means the guest's private invitation was exchanged; copying or opening a share app is never falsely counted as delivery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void load()} disabled={busy !== null}>
            <RefreshCw className={`size-4 ${busy === 'load' ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {missingTokens > 0 && (
            <Button type="button" variant="outline" onClick={() => void generateMissingLinks()} disabled={busy !== null}>
              <QrCode className="size-4" />
              {busy === 'repair' ? 'Generating…' : `Generate ${missingTokens} missing link${missingTokens === 1 ? '' : 's'}`}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={downloadCsv}>
            <Download className="size-4" />
            Invitation CSV
          </Button>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-clay/30 bg-clay/10 p-3 text-sm">{error}</p>}

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" data-testid="invitation-delivery-summary">
        {[
          ['Guests', counts.total],
          ['Pending RSVP', counts.pending],
          ['Not sent', counts.notSent],
          ['Sent', counts.sent],
          ['Opened', counts.opened],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gold/15 bg-champagne px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-espresso/45">{label}</p>
            <p className="mt-1 font-serif text-2xl">{value}</p>
          </div>
        ))}
      </div>

      {wedding && (
        <div className="mt-4 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-xs text-espresso/65" data-testid="live-invitation-settings">
          <strong className="text-espresso">Live guest settings:</strong>{' '}
          {wedding.childrenPolicy === 'adults_only' ? 'Adults-only celebration' : 'Children welcome'}
          {' · '}RSVP deadline {wedding.rsvpDeadline ? new Date(wedding.rsvpDeadline).toLocaleDateString() : 'not set'}
          {' · '}Guest note {wedding.invitationCardMessage?.trim() ? 'saved' : 'not set'}
        </div>
      )}

      <details className="mt-5 rounded-2xl border border-gold/20 bg-champagne/55">
        <summary className="cursor-pointer px-4 py-3 font-medium text-espresso">
          Invitation design & RSVP settings
          <span className="ml-2 text-xs font-normal text-espresso/50">Card style, guest note, deadline and children policy</span>
        </summary>
        <div className="border-t border-gold/15 p-3 sm:p-5">
          {previewData && (
            <PremiumInvitationStudio
              data={previewData}
              style={draftStyle}
              message={draftMessage}
              deadline={draftDeadline}
              childrenPolicy={draftChildrenPolicy}
              saved={saved}
              busy={busy !== null}
              onStyleChange={(next) => { setDraftStyle(next); setSaved(false) }}
              onMessageChange={(next) => { setDraftMessage(next); setSaved(false) }}
              onDeadlineChange={(next) => { setDraftDeadline(next); setSaved(false) }}
              onChildrenPolicyChange={(next) => { setDraftChildrenPolicy(next); setSaved(false) }}
              onSave={() => void saveDesign()}
            />
          )}
        </div>
      </details>

      <section className="mt-6" aria-labelledby="personal-invitation-delivery-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Personal delivery</p>
            <h3 id="personal-invitation-delivery-heading" className="mt-1 font-serif text-2xl">
              Open Invitation · guest-specific links & QR codes
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-espresso/50">
              Personal links are private invitation/RSVP access, never Wedding Passes. Mark delivery explicitly after you actually send an invitation; Wewed records a separate Opened state when the guest uses it.
            </p>
          </div>
        </div>

        <form onSubmit={addGuest} className="mt-4 grid gap-2 rounded-xl border border-gold/15 bg-champagne/45 p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]" data-testid="invitation-quick-add-guest">
          <Input
            value={newGuest.name}
            onChange={(event) => setNewGuest((current) => ({ ...current, name: event.target.value }))}
            placeholder="Guest name"
            aria-label="Guest name"
            required
          />
          <Input
            value={newGuest.email}
            onChange={(event) => setNewGuest((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email (optional)"
            type="email"
            aria-label="Guest email"
          />
          <Input
            value={newGuest.phone}
            onChange={(event) => setNewGuest((current) => ({ ...current, phone: event.target.value }))}
            placeholder="Phone (optional)"
            aria-label="Guest phone"
          />
          <Button type="submit" disabled={busy !== null}>
            {busy === 'add-guest' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add guest
          </Button>
        </form>

        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(16rem,1fr)_auto_auto]" data-testid="invitation-filters">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-espresso/35" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or phone"
              className="pl-9"
              aria-label="Search invitations"
            />
          </label>
          <select
            value={rsvpFilter}
            onChange={(event) => setRsvpFilter(event.target.value as typeof rsvpFilter)}
            aria-label="Filter by RSVP"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All RSVP states</option>
            <option value="pending">Pending RSVP</option>
            <option value="attending">Attending</option>
            <option value="declined">Declined</option>
          </select>
          <select
            value={deliveryFilter}
            onChange={(event) => setDeliveryFilter(event.target.value as typeof deliveryFilter)}
            aria-label="Filter by delivery"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All delivery states</option>
            <option value="not_sent">Not sent</option>
            <option value="sent">Sent</option>
            <option value="opened">Opened</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gold/15 bg-white px-3 py-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              aria-label="Select all filtered guests"
            />
            Select all shown ({filteredRows.length})
          </label>
          <span className="text-xs text-espresso/40">{selected.size} selected</span>
          {selected.size > 0 && (
            <>
              <select
                value={deliveryChannel}
                onChange={(event) => setDeliveryChannel(event.target.value as DeliveryChannel)}
                aria-label="Delivery channel"
                className="ml-auto h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="in_person">In person</option>
                <option value="other">Other</option>
              </select>
              <Button type="button" size="sm" onClick={() => void trackDelivery(Array.from(selected), 'mark_sent')} disabled={busy !== null}>
                <Send className="size-4" />
                Mark sent
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void trackDelivery(Array.from(selected), 'reset')} disabled={busy !== null}>
                <RotateCcw className="size-4" />
                Reset tracking
              </Button>
            </>
          )}
        </div>

        {busy === 'load' && rows.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="size-7 animate-spin text-gold-muted" />
          </div>
        ) : (
          <div className="mt-3 divide-y divide-gold/10 overflow-hidden rounded-2xl border border-gold/20 bg-champagne" data-testid="invitation-guest-list">
            {filteredRows.map((row) => {
              const delivery = deliveryFor(row)
              const expanded = expandedId === row.id
              const wa = whatsappUrl(row)
              const mail = emailUrl(row)

              return (
                <article key={row.id} className="bg-champagne">
                  <div className="grid gap-3 px-3 py-3 md:grid-cols-[auto_minmax(13rem,1.5fr)_minmax(8rem,.7fr)_minmax(9rem,.8fr)_auto] md:items-center">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelected(row.id)}
                      aria-label={`Select ${row.name}`}
                    />

                    {editingId === row.id ? (
                      <div className="grid gap-2 sm:grid-cols-3 md:col-span-3">
                        <Input value={editGuest.name} onChange={(event) => setEditGuest((current) => ({ ...current, name: event.target.value }))} aria-label="Edit guest name" />
                        <Input value={editGuest.email} onChange={(event) => setEditGuest((current) => ({ ...current, email: event.target.value }))} aria-label="Edit guest email" type="email" placeholder="Email" />
                        <Input value={editGuest.phone} onChange={(event) => setEditGuest((current) => ({ ...current, phone: event.target.value }))} aria-label="Edit guest phone" placeholder="Phone" />
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <p className="truncate font-serif text-lg">{row.name}</p>
                          <p className="truncate text-xs text-espresso/50">{row.email || row.phone || 'No contact saved'}</p>
                        </div>
                        <div>
                          <span className="rounded-full border border-espresso/10 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]">
                            {row.status}
                          </span>
                          <p className="mt-1 text-[10px] text-espresso/40">Table {row.tableNumber ?? '—'}</p>
                        </div>
                        <div>
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${deliveryClass(row)}`}>
                            {deliveryLabel(row)}
                          </span>
                          {delivery.openedAt && <p className="mt-1 text-[10px] text-espresso/40">{shortDate(delivery.openedAt)}</p>}
                          {!delivery.openedAt && delivery.sentAt && <p className="mt-1 text-[10px] text-espresso/40">{shortDate(delivery.sentAt)}</p>}
                        </div>
                      </>
                    )}

                    <div className="flex flex-wrap justify-end gap-1.5">
                      {editingId === row.id ? (
                        <>
                          <Button type="button" size="sm" onClick={() => void saveGuest(row)} disabled={busy !== null}>
                            <Check className="size-4" />
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => void copyMessage(row)} disabled={!row.shareMessage}>
                            <Copy className="size-4" />
                            {copied === `message-${row.id}` ? 'Copied' : 'Message'}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void share(row)} disabled={!row.invitationUrl}>
                            <Share2 className="size-4" />
                            Share
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setExpandedId(expanded ? null : row.id)}>
                            <QrCode className="size-4" />
                            {expanded ? 'Hide' : 'Details'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {expanded && editingId !== row.id && (
                    <div className="grid gap-4 border-t border-gold/10 bg-white/55 px-4 py-4 lg:grid-cols-[10rem_1fr]">
                      <div>
                        {row.qrValue
                          ? <GuestQr value={row.qrValue} name={row.name} />
                          : <div className="flex size-36 items-center justify-center rounded-xl border border-dashed border-gold/30"><QrCode className="size-9 text-gold/40" /></div>}
                      </div>
                      <div className="min-w-0 space-y-3">
                        <div className="grid gap-2 text-xs sm:grid-cols-2">
                          <p><strong>Sent:</strong> {delivery.sentAt ? shortDate(delivery.sentAt) : 'Not marked sent'}{delivery.sentChannel ? ` · ${delivery.sentChannel}` : ''}</p>
                          <p><strong>Opened:</strong> {delivery.openedAt ? shortDate(delivery.openedAt) : 'Not opened yet'}</p>
                          <p><strong>Check-in:</strong> {row.checkedIn ? 'Checked in' : 'Not checked in'}</p>
                          <p><strong>Personal link:</strong> {row.invitationUrl ? 'Ready' : 'Missing'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={() => void trackDelivery([row.id], 'mark_sent')} disabled={busy !== null}>
                            <Send className="size-4" />
                            Mark sent · {deliveryChannel}
                          </Button>
                          {wa && (
                            <Button asChild type="button" size="sm" variant="outline">
                              <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
                            </Button>
                          )}
                          {mail && (
                            <Button asChild type="button" size="sm" variant="outline">
                              <a href={mail}><Mail className="size-4" />Email</a>
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="outline" onClick={() => void copyLink(row)} disabled={!row.invitationUrl}>
                            {copied === `link-${row.id}` ? <Check className="size-4" /> : <Copy className="size-4" />}
                            {copied === `link-${row.id}` ? 'Link copied' : 'Copy link'}
                          </Button>
                          {row.invitationUrl && (
                            <Button asChild type="button" size="sm" variant="outline">
                              <a href={row.invitationUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="size-4" />
                                Preview
                              </a>
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 border-t border-gold/10 pt-3">
                          <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(row)}>
                            <Pencil className="size-4" />
                            Edit contact
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => void rotate(row)} disabled={busy !== null}>
                            <RotateCcw className={`size-4 ${busy === `rotate-${row.id}` ? 'animate-spin' : ''}`} />
                            Rotate private link
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="text-clay hover:text-clay" onClick={() => void removeGuest(row)} disabled={busy !== null}>
                            <Trash2 className="size-4" />
                            Remove guest
                          </Button>
                          {delivery.status !== 'not_sent' && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => void trackDelivery([row.id], 'reset')} disabled={busy !== null}>
                              Reset delivery status
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
            {filteredRows.length === 0 && (
              <p className="p-8 text-center text-sm text-espresso/55">
                {rows.length === 0
                  ? 'Add guests to create private digital invitations.'
                  : 'No guests match the current search and filters.'}
              </p>
            )}
          </div>
        )}
      </section>
    </section>
  )
}
