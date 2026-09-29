'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
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
import { Label } from '@/components/ui/label'
import { PremiumInvitationStudio } from '@/components/wedding/invitation-experience/premium-invitation-studio'
import {
  normalizeInvitationCardStyle,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

type ChildrenPolicy = 'welcome' | 'adults_only'
type DeliveryChannel = 'whatsapp' | 'email' | 'sms' | 'copy_link' | 'share_sheet' | 'other'
type RsvpFilter = 'all' | 'pending' | 'attending' | 'declined'
type DeliveryFilter = 'all' | 'sent' | 'not_sent'

interface InvitationRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  tableNumber: number | null
  status: 'pending' | 'attending' | 'declined'
  checkedIn: boolean
  deliveryCount: number
  lastSentAt: string | null
  lastSentVia: string | null
  lastSentRecipient: string | null
  lastSentInvitationStyle: string | null
  lastSentInvitationMessage: string | null
  lastSentRsvpDeadline: string | null
  lastSentChildrenPolicy: string | null
  lastSentLinkCurrent: boolean | null
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
  childrenPolicy: ChildrenPolicy
}

interface GuestDraft {
  name: string
  email: string
  phone: string
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

function deliveryChannelLabel(value: string | null | undefined): string {
  if (!value) return 'Not marked sent'
  const labels: Record<string, string> = {
    whatsapp: 'WhatsApp',
    email: 'Email',
    sms: 'SMS',
    copy_link: 'Copied link',
    share_sheet: 'Share sheet',
    other: 'Other',
  }
  return labels[value] ?? value.replaceAll('_', ' ')
}

function sentDate(value: string | null): string {
  if (!value) return 'Not marked sent'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Marked sent'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function invitationStyleLabel(value: string | null): string {
  if (!value) return 'Unknown design'
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function shortDate(value: string | null): string {
  if (!value) return 'No RSVP deadline'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'RSVP deadline saved'
  return `RSVP ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)}`
}

function statusLabel(value: InvitationRow['status']): string {
  if (value === 'attending') return 'Attending'
  if (value === 'declined') return 'Declined'
  return 'Pending'
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
  const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>('all')
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>('whatsapp')
  const [deliveryNote, setDeliveryNote] = useState('')

  const [addingGuest, setAddingGuest] = useState(false)
  const [newGuest, setNewGuest] = useState<GuestDraft>({ name: '', email: '', phone: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editGuest, setEditGuest] = useState<GuestDraft>({ name: '', email: '', phone: '' })

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
      setRows(payload.data)
      setMissingTokens(typeof payload.missingTokens === 'number' ? payload.missingTokens : 0)
      setWedding(nextWedding)
      setDraftStyle(nextWedding.invitationCardStyle)
      setDraftMessage(nextWedding.invitationCardMessage || '')
      setDraftDeadline(dateInputValue(nextWedding.rsvpDeadline))
      setDraftChildrenPolicy(nextWedding.childrenPolicy)
      setSelected((current) => new Set([...current].filter((id) => payload.data.some((row: InvitationRow) => row.id === id))))
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
      if (rsvpFilter !== 'all' && row.status !== rsvpFilter) return false
      if (deliveryFilter === 'sent' && !row.lastSentAt) return false
      if (deliveryFilter === 'not_sent' && row.lastSentAt) return false
      if (channelFilter !== 'all' && row.lastSentVia !== channelFilter) return false
      if (!query) return true
      return [
        row.name,
        row.email ?? '',
        row.phone ?? '',
        row.lastSentRecipient ?? '',
        row.tableNumber?.toString() ?? '',
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [channelFilter, deliveryFilter, rows, rsvpFilter, search])

  const stats = useMemo(() => ({
    total: rows.length,
    sent: rows.filter((row) => row.lastSentAt).length,
    unsent: rows.filter((row) => !row.lastSentAt).length,
    pending: rows.filter((row) => row.status === 'pending').length,
    attending: rows.filter((row) => row.status === 'attending').length,
    declined: rows.filter((row) => row.status === 'declined').length,
  }), [rows])

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
      const response = await fetch('/api/planner/guests/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'repair_links' }),
      })
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

  async function markSent(guestIds: string[]) {
    if (guestIds.length === 0) return
    setBusy('mark-sent')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_sent',
          guestIds,
          channel: deliveryChannel,
          note: deliveryNote || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to record invitation delivery.')
      setSelected(new Set())
      setDeliveryNote('')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to record invitation delivery.')
      setBusy(null)
    }
  }

  async function addGuest() {
    const name = newGuest.name.trim()
    const email = newGuest.email.trim()
    const phone = newGuest.phone.trim()
    if (!name) { setError('Enter the guest name.'); return }
    setBusy('add-guest')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, role: 'guest', side: 'neutral' }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to add guest.')
      setNewGuest({ name: '', email: '', phone: '' })
      setAddingGuest(false)
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
    const name = editGuest.name.trim()
    if (!name) { setError('Guest name cannot be empty.'); return }
    setBusy(`edit-${row.id}`)
    setError(null)
    try {
      const response = await fetch(`/api/planner/guests/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: editGuest.email.trim() || null,
          phone: editGuest.phone.trim() || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save guest.')
      setEditingId(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save guest.')
      setBusy(null)
    }
  }

  async function deleteGuest(row: InvitationRow) {
    if (!window.confirm(`Remove ${row.name} from this wedding? This deletes their guest record, RSVP and private invitation link. This cannot be undone from this screen.`)) return
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

  function toggleAllFiltered() {
    const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.has(row.id))
    setSelected((current) => {
      const next = new Set(current)
      for (const row of filteredRows) {
        if (allSelected) next.delete(row.id)
        else next.add(row.id)
      }
      return next
    })
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
          <p className="mt-2 max-w-3xl text-sm leading-6 text-espresso/60">Design the invitation once, then manage personal delivery guest by guest. Delivery tracking is operational metadata only: it never changes RSVP, Wedding Pass or check-in state.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void load()} disabled={busy !== null}><RefreshCw className={`size-4 ${busy === 'load' ? 'animate-spin' : ''}`} />Refresh</Button>
          {missingTokens > 0 && (
            <Button type="button" variant="outline" onClick={() => void generateMissingLinks()} disabled={busy !== null}>
              <QrCode className="size-4" />
              {busy === 'repair' ? 'Generating…' : `Generate ${missingTokens} missing link${missingTokens === 1 ? '' : 's'}`}
            </Button>
          )}
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

      <section className="mt-7 space-y-4" aria-labelledby="personal-invitation-delivery-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Personal delivery</p>
          <h3 id="personal-invitation-delivery-heading" className="mt-1 font-serif text-2xl">Open Invitation · guest-specific links & QR codes</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-espresso/50">Search, edit and track the guest list before sending. “Marked sent” means a planner recorded the handoff; Wewed does not claim WhatsApp/SMS delivery unless a provider later confirms it.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ['Guests', stats.total],
            ['Marked sent', stats.sent],
            ['Not sent', stats.unsent],
            ['Pending RSVP', stats.pending],
            ['Attending', stats.attending],
            ['Declined', stats.declined],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-gold/15 bg-white px-3 py-3">
              <p className="font-serif text-2xl text-espresso">{value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-espresso/45">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gold/20 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_11rem_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-espresso/35" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone, recipient or table" className="pl-9" />
            </div>
            <select value={rsvpFilter} onChange={(event) => setRsvpFilter(event.target.value as RsvpFilter)} aria-label="Filter by RSVP" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All RSVP</option>
              <option value="pending">Pending</option>
              <option value="attending">Attending</option>
              <option value="declined">Declined</option>
            </select>
            <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value as DeliveryFilter)} aria-label="Filter by delivery" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All delivery</option>
              <option value="not_sent">Not sent</option>
              <option value="sent">Marked sent</option>
            </select>
            <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)} aria-label="Filter by channel" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="copy_link">Copied link</option>
              <option value="share_sheet">Share sheet</option>
              <option value="other">Other</option>
            </select>
            <Button type="button" variant="outline" onClick={() => { setSearch(''); setRsvpFilter('all'); setDeliveryFilter('all'); setChannelFilter('all') }}>Reset filters</Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gold/10 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={toggleAllFiltered} disabled={filteredRows.length === 0}>
                {filteredRows.length > 0 && filteredRows.every((row) => selected.has(row.id)) ? 'Clear visible' : 'Select visible'}
              </Button>
              <span className="text-xs text-espresso/55">{selected.size} selected · {filteredRows.length} visible</span>
            </div>
            <Button type="button" size="sm" onClick={() => setAddingGuest((current) => !current)} className="bg-espresso text-champagne">
              {addingGuest ? <X className="size-4" /> : <Plus className="size-4" />}
              {addingGuest ? 'Close add guest' : 'Add guest'}
            </Button>
          </div>

          {addingGuest && (
            <div className="mt-4 grid gap-3 rounded-xl border border-gold/15 bg-champagne/40 p-4 md:grid-cols-[1.2fr_1.2fr_1fr_auto]">
              <div><Label htmlFor="invitation-add-name">Guest name</Label><Input id="invitation-add-name" value={newGuest.name} onChange={(event) => setNewGuest((current) => ({ ...current, name: event.target.value }))} className="mt-1" /></div>
              <div><Label htmlFor="invitation-add-email">Email</Label><Input id="invitation-add-email" type="email" value={newGuest.email} onChange={(event) => setNewGuest((current) => ({ ...current, email: event.target.value }))} className="mt-1" /></div>
              <div><Label htmlFor="invitation-add-phone">Phone</Label><Input id="invitation-add-phone" value={newGuest.phone} onChange={(event) => setNewGuest((current) => ({ ...current, phone: event.target.value }))} className="mt-1" /></div>
              <Button type="button" onClick={() => void addGuest()} disabled={busy !== null} className="self-end bg-gold text-espresso"><Plus className="size-4" />Create guest</Button>
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <div className="sticky top-3 z-20 rounded-2xl border border-gold/30 bg-espresso p-4 text-champagne shadow-xl">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="invitation-delivery-channel" className="text-champagne">Record selected as sent via</Label>
                <select id="invitation-delivery-channel" value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value as DeliveryChannel)} className="mt-1 h-10 rounded-md border border-gold/25 bg-espresso px-3 text-sm">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="copy_link">Copied link</option>
                  <option value="share_sheet">Share sheet</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="min-w-[15rem] flex-1">
                <Label htmlFor="invitation-delivery-note" className="text-champagne">Optional delivery note</Label>
                <Input id="invitation-delivery-note" value={deliveryNote} maxLength={500} onChange={(event) => setDeliveryNote(event.target.value)} placeholder="e.g. Sent by family WhatsApp" className="mt-1 border-gold/25 bg-espresso text-champagne" />
              </div>
              <Button type="button" onClick={() => void markSent([...selected])} disabled={busy !== null} className="bg-gold text-espresso">
                <Send className="size-4" />Mark {selected.size} sent
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSelected(new Set())} className="text-champagne/70">Clear</Button>
            </div>
          </div>
        )}

        {busy === 'load' && rows.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold-muted" /></div>
        ) : filteredRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gold/30 p-8 text-center text-sm text-espresso/55">No guests match these filters.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gold/20 bg-white">
            <div className="hidden grid-cols-[2.5rem_minmax(0,1.3fr)_10rem_15rem_8rem] gap-3 border-b border-gold/15 bg-champagne/50 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-espresso/45 lg:grid">
              <span />
              <span>Guest</span>
              <span>RSVP</span>
              <span>Delivery</span>
              <span>Table</span>
            </div>
            {filteredRows.map((row) => {
              const editing = editingId === row.id
              const currentSettingsChanged = Boolean(
                row.lastSentAt &&
                wedding &&
                (
                  row.lastSentInvitationStyle !== wedding.invitationCardStyle ||
                  (row.lastSentInvitationMessage ?? '') !== (wedding.invitationCardMessage ?? '') ||
                  dateInputValue(row.lastSentRsvpDeadline) !== dateInputValue(wedding.rsvpDeadline) ||
                  row.lastSentChildrenPolicy !== wedding.childrenPolicy
                )
              )
              return (
                <article key={row.id} className="border-b border-gold/10 last:border-b-0">
                  <div className="grid gap-3 px-4 py-4 lg:grid-cols-[2.5rem_minmax(0,1.3fr)_10rem_15rem_8rem] lg:items-center">
                    <label className="flex items-center gap-2 text-xs text-espresso/55">
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelected(row.id)} className="size-4 accent-espresso" aria-label={`Select ${row.name}`} />
                      <span className="lg:hidden">Select</span>
                    </label>
                    <div className="min-w-0">
                      <p className="font-serif text-xl text-espresso">{row.name}</p>
                      <p className="mt-1 truncate text-xs text-espresso/50">{row.email || 'No email'} · {row.phone || 'No phone'}</p>
                    </div>
                    <div><span className="rounded-full border border-gold/20 bg-champagne/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-espresso/70">{statusLabel(row.status)}</span></div>
                    <div className="text-xs leading-5 text-espresso/55">
                      <p className={row.lastSentAt ? 'font-medium text-espresso' : ''}>{row.lastSentAt ? sentDate(row.lastSentAt) : 'Not marked sent'}</p>
                      {row.lastSentAt && (
                        <>
                          <p>{deliveryChannelLabel(row.lastSentVia)}{row.lastSentRecipient ? ` · ${row.lastSentRecipient}` : ''}{row.deliveryCount > 1 ? ` · ${row.deliveryCount} sends` : ''}</p>
                          <p
                            className="text-[10px] text-espresso/45"
                            title={row.lastSentInvitationMessage || 'No invitation note was saved in this delivery snapshot.'}
                          >
                            {invitationStyleLabel(row.lastSentInvitationStyle)} · {row.lastSentChildrenPolicy === 'adults_only' ? 'Adults only' : 'Children welcome'} · {shortDate(row.lastSentRsvpDeadline)}
                          </p>
                          {row.lastSentLinkCurrent === false && (
                            <p className="font-semibold text-clay">Private link rotated since this send.</p>
                          )}
                          {currentSettingsChanged && (
                            <p className="font-semibold text-amber-800">Invitation settings changed since this send.</p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-espresso/55">Table {row.tableNumber ?? '—'}<br />{row.checkedIn ? 'Checked in' : 'Not checked in'}</div>
                  </div>

                  {editing && (
                    <div className="grid gap-3 border-t border-gold/10 bg-champagne/35 px-4 py-4 md:grid-cols-[1.1fr_1.1fr_1fr_auto]">
                      <div><Label>Name</Label><Input value={editGuest.name} onChange={(event) => setEditGuest((current) => ({ ...current, name: event.target.value }))} className="mt-1" /></div>
                      <div><Label>Email</Label><Input type="email" value={editGuest.email} onChange={(event) => setEditGuest((current) => ({ ...current, email: event.target.value }))} className="mt-1" /></div>
                      <div><Label>Phone</Label><Input value={editGuest.phone} onChange={(event) => setEditGuest((current) => ({ ...current, phone: event.target.value }))} className="mt-1" /></div>
                      <div className="flex items-end gap-2"><Button type="button" size="sm" onClick={() => void saveGuest(row)} disabled={busy !== null}><Check className="size-4" />Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="size-4" /></Button></div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 border-t border-gold/10 bg-white px-4 py-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(row)} disabled={busy !== null}><Pencil className="size-4" />Edit</Button>
                    <Button type="button" size="sm" onClick={() => void copyMessage(row)} disabled={!row.shareMessage}><Copy className="size-4" />{copied === `message-${row.id}` ? 'Message copied' : 'Copy message'}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void share(row)} disabled={!row.invitationUrl}><Share2 className="size-4" />{copied === `share-${row.id}` ? 'Copied' : 'Share card'}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void copyLink(row)} disabled={!row.invitationUrl}>{copied === `link-${row.id}` ? <Check className="size-4" /> : <Copy className="size-4" />}{copied === `link-${row.id}` ? 'Link copied' : 'Copy link'}</Button>
                    {row.invitationUrl && <Button asChild size="sm" variant="outline"><a href={row.invitationUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Preview</a></Button>}
                    <Button type="button" size="sm" variant="outline" onClick={() => void markSent([row.id])} disabled={busy !== null}><Send className="size-4" />Mark sent · {deliveryChannelLabel(deliveryChannel)}</Button>
                    <details className="relative">
                      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"><QrCode className="size-4" />QR</summary>
                      <div className="absolute bottom-11 left-0 z-30 rounded-xl border border-gold/20 bg-champagne p-3 shadow-xl">{row.qrValue ? <GuestQr value={row.qrValue} name={row.name} /> : <div className="flex size-36 items-center justify-center text-xs text-espresso/45">No link yet</div>}</div>
                    </details>
                    <Button type="button" size="sm" variant="outline" onClick={() => void rotate(row)} disabled={busy !== null}><RotateCcw className={`size-4 ${busy === `rotate-${row.id}` ? 'animate-spin' : ''}`} />Rotate</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void deleteGuest(row)} disabled={busy !== null} className="ml-auto text-clay hover:bg-clay/10 hover:text-clay"><Trash2 className="size-4" />Remove</Button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}
