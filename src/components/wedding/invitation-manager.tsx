'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  History,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Share2,
  Trash2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PremiumInvitationStudio } from '@/components/wedding/invitation-experience/premium-invitation-studio'
import {
  normalizeInvitationCardStyle,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'
import type {
  InvitationDeliveryChannel,
  InvitationDeliveryRecord,
  InvitationDeliverySummary,
} from '@/lib/planner-invitation-delivery'
import { usePlannerFilterState } from '@/lib/planner-filter-state'

type ChildrenPolicy = 'welcome' | 'adults_only'

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
  delivery: InvitationDeliverySummary
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

const DELIVERY_CHANNELS: Array<{ value: InvitationDeliveryChannel; label: string }> = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'share_sheet', label: 'Share sheet' },
  { value: 'copy_link', label: 'Copied link' },
  { value: 'qr', label: 'QR code' },
  { value: 'manual', label: 'Manual / other' },
]

function GuestQr({ value, name }: { value: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: { dark: '#1A1410', light: '#FBF6EE' },
    }).then((result) => { if (!cancelled) setSrc(result) })
    return () => { cancelled = true }
  }, [value])

  if (!src) {
    return <div className="flex size-72 items-center justify-center rounded-2xl bg-white"><Loader2 className="size-6 animate-spin text-gold-muted" /></div>
  }
  return (
    <img
      src={src}
      alt={`Private digital invitation QR code for ${name}`}
      className="size-72 rounded-2xl border border-gold/20 bg-white p-3"
    />
  )
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function dateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function channelLabel(channel: InvitationDeliveryChannel | null): string {
  return DELIVERY_CHANNELS.find((candidate) => candidate.value === channel)?.label ?? '—'
}

function contactLabel(row: InvitationRow): string {
  return row.email || row.phone || 'No contact saved'
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [deliveryChannel, setDeliveryChannel] = useState<InvitationDeliveryChannel>('whatsapp')
  const [qrRow, setQrRow] = useState<InvitationRow | null>(null)
  const [historyRow, setHistoryRow] = useState<InvitationRow | null>(null)
  const [history, setHistory] = useState<InvitationDeliveryRecord[]>([])
  const [historyBusy, setHistoryBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newGuest, setNewGuest] = useState({ name: '', email: '', phone: '' })
  const [filters, setFilters, resetFilters] = usePlannerFilterState(
    'wewed:planner:invitation-ops:filters',
    { search: '', rsvp: 'all', delivery: 'all', contact: 'all', sort: 'name' },
  )

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
      const nextRows = (payload.data ?? []) as InvitationRow[]
      setRows(nextRows)
      setSelectedIds((current) => new Set(Array.from(current).filter((id) => nextRows.some((row) => row.id === id))))
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
    const query = filters.search.trim().toLowerCase()
    const next = rows.filter((row) => {
      if (filters.rsvp !== 'all' && row.status !== filters.rsvp) return false
      if (filters.delivery === 'sent' && row.delivery.status !== 'sent') return false
      if (filters.delivery === 'not_sent' && row.delivery.status !== 'not_sent') return false
      if (filters.contact === 'email' && !row.email) return false
      if (filters.contact === 'phone' && !row.phone) return false
      if (filters.contact === 'missing' && (row.email || row.phone)) return false
      if (!query) return true
      return [row.name, row.email ?? '', row.phone ?? '', String(row.tableNumber ?? '')]
        .some((value) => value.toLowerCase().includes(query))
    })
    return next.sort((a, b) => {
      if (filters.sort === 'rsvp') return a.status.localeCompare(b.status) || a.name.localeCompare(b.name)
      if (filters.sort === 'last_sent') {
        const aTime = a.delivery.lastSentAt ? Date.parse(a.delivery.lastSentAt) : 0
        const bTime = b.delivery.lastSentAt ? Date.parse(b.delivery.lastSentAt) : 0
        return bTime - aTime || a.name.localeCompare(b.name)
      }
      return a.name.localeCompare(b.name)
    })
  }, [filters, rows])

  const stats = useMemo(() => ({
    total: rows.length,
    sent: rows.filter((row) => row.delivery.status === 'sent').length,
    notSent: rows.filter((row) => row.delivery.status !== 'sent').length,
    responded: rows.filter((row) => row.status !== 'pending').length,
    pending: rows.filter((row) => row.status === 'pending').length,
  }), [rows])

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.id)),
    [rows, selectedIds],
  )
  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.has(row.id))

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

  async function updateDelivery(guestIds: string[], action: 'mark_sent' | 'clear_sent') {
    if (guestIds.length === 0) return
    setBusy('delivery')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, guestIds, channel: action === 'mark_sent' ? deliveryChannel : undefined }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to update invitation delivery.')
      setSelectedIds(new Set())
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update invitation delivery.')
      setBusy(null)
    }
  }

  async function openHistory(row: InvitationRow) {
    setHistoryRow(row)
    setHistory([])
    setHistoryBusy(true)
    try {
      const response = await fetch(`/api/planner/guests/invitations/delivery?guestId=${encodeURIComponent(row.id)}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load delivery history.')
      setHistory(payload.data ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load delivery history.')
    } finally {
      setHistoryBusy(false)
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
      setAddOpen(false)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add guest.')
      setBusy(null)
    }
  }

  async function removeSelected() {
    if (selectedRows.length === 0) return
    const names = selectedRows.slice(0, 5).map((row) => row.name).join(', ')
    const suffix = selectedRows.length > 5 ? ` and ${selectedRows.length - 5} more` : ''
    if (!window.confirm(`Remove ${selectedRows.length} guest record${selectedRows.length === 1 ? '' : 's'} from this wedding?\n\n${names}${suffix}\n\nThis also removes their RSVP credential and cannot be undone from this page.`)) return
    setBusy('delete')
    setError(null)
    try {
      for (const row of selectedRows) {
        const response = await fetch(`/api/planner/guests/${encodeURIComponent(row.id)}`, { method: 'DELETE' })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) throw new Error(payload?.error || `Unable to remove ${row.name}.`)
      }
      setSelectedIds(new Set())
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to remove selected guests.')
      setBusy(null)
    }
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAllFiltered(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const row of filteredRows) {
        if (checked) next.add(row.id)
        else next.delete(row.id)
      }
      return next
    })
  }

  function downloadCsv() {
    window.location.href = '/api/planner/guests/invitations?format=csv'
  }

  const panel = compact
    ? 'rounded-2xl border border-gold/15 bg-champagne p-4 text-espresso sm:p-5'
    : 'rounded-3xl border border-gold/20 bg-white p-5 text-espresso sm:p-7'

  return (
    <section className="space-y-6">
      <section className={panel}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Digital wedding cards & RSVP</p>
            <h2 className="mt-2 font-serif text-3xl">{wedding?.title || 'Active wedding'}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-espresso/60">
              These settings are database-backed. Web Guest RSVP reads them live, and current native Guest clients read the same guest-session authority on refresh.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void load()} disabled={busy !== null}>
              <RefreshCw className={`size-4 ${busy === 'load' ? 'animate-spin' : ''}`} />Refresh
            </Button>
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
      </section>

      <section className={panel} aria-labelledby="personal-invitation-delivery-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Personal delivery</p>
            <h3 id="personal-invitation-delivery-heading" className="mt-1 font-serif text-2xl">Open Invitation · guest-specific links & QR codes</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-espresso/55">
              Wewed records an invitation as sent only when you explicitly mark it sent. Copying or opening a share sheet is not treated as proof of delivery.
              RSVP status is the first verified guest response; provider delivery/read receipts are not invented when they are unavailable.
            </p>
          </div>
          <Button type="button" onClick={() => setAddOpen((current) => !current)} variant={addOpen ? 'outline' : 'default'}>
            <Plus className="size-4" />{addOpen ? 'Close add guest' : 'Add guest'}
          </Button>
        </div>

        {addOpen && (
          <form onSubmit={addGuest} className="mt-4 grid gap-3 rounded-xl border border-gold/20 bg-white/55 p-4 md:grid-cols-[1.2fr_1.2fr_1fr_auto]">
            <div><Label htmlFor="invitation-add-name">Name</Label><Input id="invitation-add-name" value={newGuest.name} onChange={(event) => setNewGuest((current) => ({ ...current, name: event.target.value }))} required /></div>
            <div><Label htmlFor="invitation-add-email">Email</Label><Input id="invitation-add-email" type="email" value={newGuest.email} onChange={(event) => setNewGuest((current) => ({ ...current, email: event.target.value }))} /></div>
            <div><Label htmlFor="invitation-add-phone">Phone</Label><Input id="invitation-add-phone" value={newGuest.phone} onChange={(event) => setNewGuest((current) => ({ ...current, phone: event.target.value }))} /></div>
            <Button type="submit" className="self-end" disabled={busy !== null}>{busy === 'add-guest' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Add</Button>
          </form>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Guests', stats.total],
            ['Marked sent', stats.sent],
            ['Not sent', stats.notSent],
            ['Responded', stats.responded],
            ['Pending RSVP', stats.pending],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-gold/15 bg-white/55 px-3 py-3 text-center">
              <p className="font-serif text-2xl">{value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-espresso/45">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2 rounded-xl border border-gold/15 bg-white/45 p-3 md:grid-cols-[minmax(12rem,2fr)_repeat(4,minmax(8rem,1fr))_auto]">
          <label className="relative">
            <span className="sr-only">Search invitations</span>
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-espresso/35" />
            <Input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search guest, email, phone, table…"
              className="pl-9"
            />
          </label>
          <select aria-label="Filter RSVP status" value={filters.rsvp} onChange={(event) => setFilters((current) => ({ ...current, rsvp: event.target.value }))} className="h-10 rounded-md border border-input bg-white px-3 text-sm">
            <option value="all">All RSVP</option><option value="pending">Pending</option><option value="attending">Attending</option><option value="declined">Declined</option>
          </select>
          <select aria-label="Filter delivery status" value={filters.delivery} onChange={(event) => setFilters((current) => ({ ...current, delivery: event.target.value }))} className="h-10 rounded-md border border-input bg-white px-3 text-sm">
            <option value="all">All delivery</option><option value="not_sent">Not sent</option><option value="sent">Marked sent</option>
          </select>
          <select aria-label="Filter contact availability" value={filters.contact} onChange={(event) => setFilters((current) => ({ ...current, contact: event.target.value }))} className="h-10 rounded-md border border-input bg-white px-3 text-sm">
            <option value="all">All contacts</option><option value="email">Has email</option><option value="phone">Has phone</option><option value="missing">Missing contact</option>
          </select>
          <select aria-label="Sort invitations" value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))} className="h-10 rounded-md border border-input bg-white px-3 text-sm">
            <option value="name">Sort: name</option><option value="rsvp">Sort: RSVP</option><option value="last_sent">Sort: last sent</option>
          </select>
          <Button type="button" variant="ghost" onClick={resetFilters}>Reset</Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gold/15 bg-white/45 px-3 py-2">
          <Checkbox
            id="invitation-select-filtered"
            checked={allFilteredSelected}
            onCheckedChange={(value) => toggleAllFiltered(value === true)}
          />
          <Label htmlFor="invitation-select-filtered" className="mr-2 text-xs">
            Select filtered ({filteredRows.length})
          </Label>
          <span className="text-xs text-espresso/50">{selectedRows.length} selected</span>
          <select aria-label="Invitation delivery channel" value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value as InvitationDeliveryChannel)} className="h-9 rounded-md border border-input bg-white px-2 text-xs">
            {DELIVERY_CHANNELS.map((channel) => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
          </select>
          <Button type="button" size="sm" disabled={selectedRows.length === 0 || busy !== null} onClick={() => void updateDelivery(selectedRows.map((row) => row.id), 'mark_sent')}>
            <Send className="size-4" />Mark selected sent
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={selectedRows.length === 0 || busy !== null} onClick={() => void updateDelivery(selectedRows.map((row) => row.id), 'clear_sent')}>
            Clear sent mark
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={selectedRows.length === 0 || busy !== null} onClick={() => void removeSelected()} className="ml-auto border-clay/30 text-clay">
            <Trash2 className="size-4" />Remove selected
          </Button>
        </div>

        {busy === 'load' && rows.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold-muted" /></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-gold/15">
            <table className="min-w-[1180px] w-full border-collapse text-left text-xs">
              <thead className="bg-espresso text-champagne">
                <tr>
                  <th className="w-10 px-3 py-3">Select</th>
                  <th className="px-3 py-3">Guest</th>
                  <th className="px-3 py-3">RSVP</th>
                  <th className="px-3 py-3">Delivery</th>
                  <th className="px-3 py-3">Table</th>
                  <th className="px-3 py-3">Private invitation</th>
                  <th className="px-3 py-3 text-right">Admin</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-gold/15 bg-white/55 align-top hover:bg-white/80">
                    <td className="px-3 py-3">
                      <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={(value) => toggleSelected(row.id, value === true)} aria-label={`Select ${row.name}`} />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-serif text-base">{row.name}</p>
                      <p className="mt-1 text-espresso/50">{contactLabel(row)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-gold/20 bg-champagne px-2 py-1 font-semibold capitalize">{row.status}</span>
                      <p className="mt-2 text-espresso/45">{row.checkedIn ? 'Checked in' : 'Not checked in'}</p>
                    </td>
                    <td className="px-3 py-3">
                      {row.delivery.status === 'sent' ? (
                        <>
                          <p className="font-semibold text-sage-deep">Marked sent · {channelLabel(row.delivery.channel)}</p>
                          <p className="mt-1 text-espresso/50">{dateTime(row.delivery.lastSentAt)}</p>
                          <p className="truncate text-espresso/45">{row.delivery.recipient || 'Recipient not recorded'}</p>
                        </>
                      ) : <p className="font-semibold text-clay">Not marked sent</p>}
                      <Button type="button" variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" onClick={() => void openHistory(row)}>
                        <History className="size-3.5" />History ({row.delivery.historyCount})
                      </Button>
                    </td>
                    <td className="px-3 py-3">{row.tableNumber ?? '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button type="button" size="sm" onClick={() => void copyMessage(row)} disabled={!row.shareMessage}>
                          <Copy className="size-3.5" />{copied === `message-${row.id}` ? 'Copied' : 'Message'}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void share(row)} disabled={!row.invitationUrl}>
                          <Share2 className="size-3.5" />Share
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void copyLink(row)} disabled={!row.invitationUrl}>
                          {copied === `link-${row.id}` ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}Link
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setQrRow(row)} disabled={!row.qrValue}>
                          <QrCode className="size-3.5" />QR
                        </Button>
                        {row.invitationUrl && (
                          <Button asChild size="sm" variant="outline">
                            <a href={row.invitationUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" />Preview</a>
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void updateDelivery([row.id], row.delivery.status === 'sent' ? 'clear_sent' : 'mark_sent')}>
                          <Send className="size-3.5" />{row.delivery.status === 'sent' ? 'Clear sent' : 'Mark sent'}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void rotate(row)} disabled={busy !== null}>
                          <RotateCcw className={`size-3.5 ${busy === `rotate-${row.id}` ? 'animate-spin' : ''}`} />Rotate
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-espresso/50">No invitations match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={Boolean(qrRow)} onOpenChange={(open) => { if (!open) setQrRow(null) }}>
        <DialogContent className="max-w-md bg-champagne text-espresso">
          <DialogTitle className="font-serif text-2xl">{qrRow?.name}</DialogTitle>
          <DialogDescription>Private RSVP invitation QR. Do not post or share it publicly.</DialogDescription>
          <div className="flex justify-center py-3">{qrRow?.qrValue && <GuestQr value={qrRow.qrValue} name={qrRow.name} />}</div>
          {qrRow?.invitationUrl && <Button type="button" onClick={() => void copyLink(qrRow)}><Copy className="size-4" />Copy private link</Button>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyRow)} onOpenChange={(open) => { if (!open) { setHistoryRow(null); setHistory([]) } }}>
        <DialogContent className="max-w-xl bg-champagne text-espresso">
          <DialogTitle className="font-serif text-2xl">Invitation history · {historyRow?.name}</DialogTitle>
          <DialogDescription>
            Immutable Planner audit history. It records what the Planner marked as sent; it does not fabricate provider read receipts.
          </DialogDescription>
          {historyBusy ? <div className="flex min-h-28 items-center justify-center"><Loader2 className="size-5 animate-spin" /></div> : (
            <div className="max-h-[55dvh] space-y-2 overflow-y-auto">
              {history.map((event) => (
                <div key={`${event.createdAt}-${event.action}`} className="rounded-xl border border-gold/20 bg-white/55 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{event.action === 'sent' ? `Marked sent · ${channelLabel(event.channel)}` : 'Sent mark cleared'}</strong>
                    <span className="text-xs text-espresso/45">{dateTime(event.createdAt)}</span>
                  </div>
                  {event.recipient && <p className="mt-1 text-xs text-espresso/55">To: {event.recipient}</p>}
                  {event.cardStyle && <p className="text-xs text-espresso/45">Card: {event.cardStyle}</p>}
                </div>
              ))}
              {history.length === 0 && <p className="py-8 text-center text-sm text-espresso/50">No send history yet.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
