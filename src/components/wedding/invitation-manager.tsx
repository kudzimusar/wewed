'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import {
  Check,
  CheckSquare2,
  Download,
  Loader2,
  Pencil,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PremiumInvitationStudio } from '@/components/wedding/invitation-experience/premium-invitation-studio'
import {
  EMPTY_PLANNER_GUEST_EDITOR_VALUE,
  PlannerGuestEditor,
  type PlannerGuestEditorTable,
  type PlannerGuestEditorValue,
} from '@/components/wedding/planner/planner-guest-editor'
import { PlannerGuestInvitationActions } from '@/components/wedding/planner/planner-guest-invitation-actions'
import {
  normalizeInvitationCardStyle,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

type ChildrenPolicy = 'welcome' | 'adults_only'
type DeliveryChannel = 'whatsapp' | 'email' | 'sms' | 'other'
type DeliveryStatus = 'sent' | 'not_sent'
type RsvpFilter = 'all' | 'responded' | 'attending' | 'declined' | 'pending'
type DeliveryFilter = 'all' | DeliveryStatus
type ContactFilter = 'all' | 'with_contact' | 'missing_contact'
type OpenFilter = 'all' | 'opened' | 'not_opened'
type ArrivalFilter = 'all' | 'checked_in' | 'not_arrived'
type PassState = 'pending_rsvp' | 'declined' | 'not_yet_issuable' | 'not_yet_issued' | 'active' | 'revoked' | 'superseded' | 'issuance_closed'
type PassFilter = 'all' | PassState

interface InvitationRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  roleDetail: string | null
  side: string | null
  seatingTableId: string | null
  seatingTableName: string | null
  tableNumber: number | null
  status: 'attending' | 'declined' | 'pending'
  checkedIn: boolean
  passState: PassState
  invitationUrl: string | null
  qrValue: string | null
  shareMessage: string | null
  deliveryStatus: DeliveryStatus
  deliveryChannel: DeliveryChannel | null
  deliveredAt: string | null
  deliveredBy: string | null
  openedAt: string | null
}

interface PlannerAttendanceSummary {
  registered: number
  sent: number
  notSent: number
  opened: number
  responded: number
  responseRate: number
  attending: number
  declined: number
  awaiting: number
  expectedNamedAttendees: number
  checkedIn: number
  notYetArrived: number
  missingContact: number
  passPendingRsvp: number
  passDeclined: number
  passNotYetIssuable: number
  passNotYetIssued: number
  passActive: number
  passRevoked: number
  passSuperseded: number
  passIssuanceClosed: number
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

const PAGE_SIZE = 40

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
      <div className="flex size-32 items-center justify-center rounded-xl bg-white">
        <Loader2 className="size-5 animate-spin text-gold-muted" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={`Private digital invitation QR code for ${name}`}
      className="size-32 rounded-xl border border-gold/20 bg-white p-2"
    />
  )
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function channelLabel(value: DeliveryChannel | null): string {
  if (value === 'whatsapp') return 'WhatsApp'
  if (value === 'email') return 'Email'
  if (value === 'sms') return 'SMS'
  if (value === 'other') return 'Other'
  return 'Not recorded'
}

function deliveryTime(value: string | null): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : date.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}

function validEmail(value: string): boolean {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function InvitationManager({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<InvitationRow[]>([])
  const [summary, setSummary] = useState<PlannerAttendanceSummary | null>(null)
  const [tables, setTables] = useState<PlannerGuestEditorTable[]>([])
  const [wedding, setWedding] = useState<InvitationWedding | null>(null)
  const [draftStyle, setDraftStyle] = useState<InvitationCardStyle>('botanical')
  const [draftMessage, setDraftMessage] = useState('')
  const [draftDeadline, setDraftDeadline] = useState('')
  const [draftChildrenPolicy, setDraftChildrenPolicy] = useState<ChildrenPolicy>('welcome')
  const [busy, setBusy] = useState<string | null>('load')
  const [saved, setSaved] = useState(false)
  const [missingTokens, setMissingTokens] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>('all')
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all')
  const [contactFilter, setContactFilter] = useState<ContactFilter>('all')
  const [openFilter, setOpenFilter] = useState<OpenFilter>('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [allocationFilter, setAllocationFilter] = useState('all')
  const [arrivalFilter, setArrivalFilter] = useState<ArrivalFilter>('all')
  const [passFilter, setPassFilter] = useState<PassFilter>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel>('whatsapp')

  const [showAddGuest, setShowAddGuest] = useState(false)
  const [newGuest, setNewGuest] = useState<PlannerGuestEditorValue>({ ...EMPTY_PLANNER_GUEST_EDITOR_VALUE })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editGuest, setEditGuest] = useState<PlannerGuestEditorValue>({ ...EMPTY_PLANNER_GUEST_EDITOR_VALUE })

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
      const nextRows = (Array.isArray(payload.data) ? payload.data : []).map((row: InvitationRow) => ({
        ...row,
        deliveryStatus: row.deliveryStatus === 'sent' ? 'sent' : 'not_sent',
      }))
      setRows(nextRows)
      setSummary(payload.summary ?? null)
      setTables(Array.isArray(payload.tables) ? payload.tables : [])
      setSelectedIds((current) => new Set([...current].filter((id) => nextRows.some((row: InvitationRow) => row.id === id))))
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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, rsvpFilter, deliveryFilter, contactFilter, openFilter, roleFilter, allocationFilter, arrivalFilter, passFilter])

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
      if (rsvpFilter === 'responded' && row.status === 'pending') return false
      if (rsvpFilter !== 'all' && rsvpFilter !== 'responded' && row.status !== rsvpFilter) return false
      if (deliveryFilter !== 'all' && row.deliveryStatus !== deliveryFilter) return false
      if (roleFilter !== 'all' && row.role !== roleFilter) return false
      if (allocationFilter !== 'all' && (row.side ?? 'neutral') !== allocationFilter) return false
      const hasContact = Boolean(row.email || row.phone)
      if (contactFilter === 'with_contact' && !hasContact) return false
      if (contactFilter === 'missing_contact' && hasContact) return false
      if (openFilter === 'opened' && !row.openedAt) return false
      if (openFilter === 'not_opened' && row.openedAt) return false
      if (arrivalFilter === 'checked_in' && !row.checkedIn) return false
      if (arrivalFilter === 'not_arrived' && (row.status !== 'attending' || row.checkedIn)) return false
      if (passFilter !== 'all' && row.passState !== passFilter) return false
      if (!query) return true
      return [
        row.name,
        row.email ?? '',
        row.phone ?? '',
        row.role,
        row.roleDetail ?? '',
        row.side ?? '',
        row.seatingTableName ?? '',
        row.tableNumber?.toString() ?? '',
        channelLabel(row.deliveryChannel),
        row.deliveredBy ?? '',
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [rows, search, rsvpFilter, deliveryFilter, contactFilter, openFilter, roleFilter, allocationFilter, arrivalFilter, passFilter])

  const displayedRows = filteredRows.slice(0, visibleCount)
  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.has(row.id))
  const selectedRows = rows.filter((row) => selectedIds.has(row.id))
  const roleOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.role))).sort(), [rows])
  const allocationOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.side ?? 'neutral'))).sort(),
    [rows],
  )

  function resetOperationalFilters() {
    setSearch('')
    setRsvpFilter('all')
    setDeliveryFilter('all')
    setContactFilter('all')
    setOpenFilter('all')
    setRoleFilter('all')
    setAllocationFilter('all')
    setArrivalFilter('all')
    setPassFilter('all')
  }

  function focusSummary(key: string) {
    resetOperationalFilters()
    if (key === 'sent') setDeliveryFilter('sent')
    if (key === 'notSent') setDeliveryFilter('not_sent')
    if (key === 'opened') setOpenFilter('opened')
    if (key === 'responded') setRsvpFilter('responded')
    if (key === 'attending' || key === 'expectedNamedAttendees') setRsvpFilter('attending')
    if (key === 'declined') setRsvpFilter('declined')
    if (key === 'awaiting') setRsvpFilter('pending')
    if (key === 'checkedIn') setArrivalFilter('checked_in')
    if (key === 'notYetArrived') setArrivalFilter('not_arrived')
    if (key === 'missingContact') setContactFilter('missing_contact')
    if (key === 'passPendingRsvp') setPassFilter('pending_rsvp')
    if (key === 'passDeclined') setPassFilter('declined')
    if (key === 'passNotYetIssuable') setPassFilter('not_yet_issuable')
    if (key === 'passNotYetIssued') setPassFilter('not_yet_issued')
    if (key === 'passActive') setPassFilter('active')
    if (key === 'passRevoked') setPassFilter('revoked')
    if (key === 'passSuperseded') setPassFilter('superseded')
    if (key === 'passIssuanceClosed') setPassFilter('issuance_closed')
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

  async function recordDelivery(guestIds: string[], channel = deliveryChannel) {
    if (guestIds.length === 0) return
    setBusy('delivery')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds, channel }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to record invitation delivery.')
      setSelectedIds(new Set())
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to record invitation delivery.')
      setBusy(null)
    }
  }

  async function clearDelivery(guestIds: string[]) {
    if (guestIds.length === 0) return
    if (!window.confirm(`Reset the delivery record for ${guestIds.length} selected guest${guestIds.length === 1 ? '' : 's'}? This does not revoke their invitation.`)) return
    setBusy('delivery-reset')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations/delivery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to reset invitation delivery.')
      setSelectedIds(new Set())
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to reset invitation delivery.')
      setBusy(null)
    }
  }

  async function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newGuest.name.trim()
    const email = newGuest.email.trim().toLowerCase()
    const phone = newGuest.phone.trim()
    if (!name) { setError('Enter the guest name.'); return }
    if (!validEmail(email)) { setError('Enter a valid email address.'); return }

    setBusy('add-guest')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'guest',
          name,
          email: email || undefined,
          phone: phone || undefined,
          role: newGuest.role,
          roleDetail: newGuest.roleDetail.trim() || undefined,
          side: newGuest.side,
          seatingTableId: newGuest.seatingTableId || undefined,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to add guest.')
      setNewGuest({ ...EMPTY_PLANNER_GUEST_EDITOR_VALUE })
      setShowAddGuest(false)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add guest.')
      setBusy(null)
    }
  }

  async function saveGuest(row: InvitationRow) {
    const name = editGuest.name.trim()
    const email = editGuest.email.trim().toLowerCase()
    const phone = editGuest.phone.trim()
    if (!name) { setError('Guest name cannot be empty.'); return }
    if (!validEmail(email)) { setError('Enter a valid email address.'); return }

    setBusy(`edit-${row.id}`)
    setError(null)
    try {
      const response = await fetch(`/api/planner/guests/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: email || null,
          phone: phone || null,
          role: editGuest.role,
          roleDetail: editGuest.roleDetail.trim() || null,
          side: editGuest.side,
          seatingTableId: editGuest.seatingTableId || null,
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

  async function deleteGuest(row: InvitationRow) {
    if (!window.confirm(`Delete ${row.name} from this wedding? Their RSVP, private invitation link and active guest access will be removed. This cannot be undone from this screen.`)) return
    setBusy(`delete-${row.id}`)
    setError(null)
    try {
      const response = await fetch(`/api/planner/guests/${encodeURIComponent(row.id)}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to delete guest.')
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(row.id)
        return next
      })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete guest.')
      setBusy(null)
    }
  }

  function downloadCsv() {
    window.location.href = '/api/planner/guests/invitations?format=csv'
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allFilteredSelected) filteredRows.forEach((row) => next.delete(row.id))
      else filteredRows.forEach((row) => next.add(row.id))
      return next
    })
  }

  function startEdit(row: InvitationRow) {
    setEditingId(row.id)
    setEditGuest({
      name: row.name,
      email: row.email ?? '',
      phone: row.phone ?? '',
      role: row.role,
      roleDetail: row.roleDetail ?? '',
      side: row.side ?? 'neutral',
      seatingTableId: row.seatingTableId ?? '',
    })
  }

  const shellClass = compact ? '' : 'rounded-3xl border border-gold/20 bg-white p-5 text-espresso sm:p-7'

  return (
    <section className={shellClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Digital wedding cards & RSVP</p>
          <h2 className="mt-2 font-serif text-3xl">{wedding?.title || 'Active wedding'}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-espresso/60">
            Invitation settings are saved to the selected wedding. The web RSVP and current native guest-session contract read the same saved message, deadline and children policy.
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
          <Button type="button" variant="outline" onClick={downloadCsv}>
            <Download className="size-4" />Invitation CSV
          </Button>
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

      <section className="mt-8 rounded-2xl border border-gold/20 bg-champagne/45 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Guest register</p>
            <h3 className="mt-1 font-serif text-2xl">Invitation delivery command center</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-espresso/55">
              Sending is deliberately separate from tracking. Share or copy a guest&apos;s private invitation, then record the channel once it has actually been sent. Delivery records are wedding-scoped audit events and do not alter RSVP status.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAddGuest((current) => !current)}>
              {showAddGuest ? <X className="size-4" /> : <UserPlus className="size-4" />}
              {showAddGuest ? 'Close add guest' : 'Add guest'}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/planner/guests">Full guest worksheet</Link>
            </Button>
          </div>
        </div>

        {showAddGuest && (
          <form onSubmit={addGuest} className="mt-4 space-y-3 rounded-xl border border-gold/15 bg-white/70 p-4">
            <PlannerGuestEditor
              value={newGuest}
              tables={tables}
              onChange={setNewGuest}
              idPrefix="invitation-add-guest"
              tone="light"
              disabled={busy !== null}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={busy !== null} className="bg-espresso text-champagne">
                {busy === 'add-guest' ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Add guest
              </Button>
            </div>
          </form>
        )}

        {summary && (
          <div data-testid="canonical-attendance-summary" className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {[
              ['registered', 'Registered', summary.registered],
              ['sent', 'Sent', summary.sent],
              ['notSent', 'Not sent', summary.notSent],
              ['opened', 'Opened', summary.opened],
              ['responded', 'Responded', summary.responded],
              ['responseRate', 'Response rate', `${Math.round(summary.responseRate * 100)}%`],
              ['attending', 'Attending', summary.attending],
              ['declined', 'Declined', summary.declined],
              ['awaiting', 'Awaiting', summary.awaiting],
              ['expectedNamedAttendees', 'Expected named', summary.expectedNamedAttendees],
              ['checkedIn', 'Checked in', summary.checkedIn],
              ['notYetArrived', 'Not arrived', summary.notYetArrived],
              ['missingContact', 'Missing contact', summary.missingContact],
              ['passPendingRsvp', 'Pass · RSVP required', summary.passPendingRsvp],
              ['passDeclined', 'Pass · Declined', summary.passDeclined],
              ['passNotYetIssuable', 'Pass · Not yet issuable', summary.passNotYetIssuable],
              ['passNotYetIssued', 'Pass · Ready / not issued', summary.passNotYetIssued],
              ['passActive', 'Pass · Active', summary.passActive],
              ['passRevoked', 'Pass · Revoked', summary.passRevoked],
              ['passSuperseded', 'Pass · Superseded', summary.passSuperseded],
              ['passIssuanceClosed', 'Pass · Issuance closed', summary.passIssuanceClosed],
            ].map(([key, label, value]) => (
              <button
                key={String(key)}
                type="button"
                onClick={() => focusSummary(String(key))}
                className="rounded-xl border border-gold/15 bg-white/75 px-3 py-3 text-center transition hover:border-gold/35 hover:bg-white"
              >
                <p className="font-serif text-2xl">{value}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-espresso/45">{label}</p>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-espresso/35" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search guest, role, allocation, table, sender…"
              className="bg-white pl-9"
            />
          </div>
          <select value={rsvpFilter} onChange={(event) => setRsvpFilter(event.target.value as RsvpFilter)} className="h-10 rounded-md border border-gold/20 bg-white px-3 text-sm">
            <option value="all">All RSVP states</option>
            <option value="responded">Responded</option>
            <option value="attending">Attending</option>
            <option value="declined">Declined</option>
            <option value="pending">Awaiting</option>
          </select>
          <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value as DeliveryFilter)} className="h-10 rounded-md border border-gold/20 bg-white px-3 text-sm">
            <option value="all">All delivery states</option><option value="sent">Sent</option><option value="not_sent">Not sent</option>
          </select>
          <select value={openFilter} onChange={(event) => setOpenFilter(event.target.value as OpenFilter)} className="h-10 rounded-md border border-gold/20 bg-white px-3 text-sm">
            <option value="all">All open states</option><option value="opened">Opened invitation</option><option value="not_opened">Not opened yet</option>
          </select>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-white px-3 text-sm">
            <option value="all">All participant types</option>{roleOptions.map((role) => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}
          </select>
          <select value={allocationFilter} onChange={(event) => setAllocationFilter(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-white px-3 text-sm">
            <option value="all">All allocations</option>{allocationOptions.map((side) => <option key={side} value={side}>{side}</option>)}
          </select>
          <select value={contactFilter} onChange={(event) => setContactFilter(event.target.value as ContactFilter)} className="h-10 rounded-md border border-gold/20 bg-white px-3 text-sm">
            <option value="all">All contacts</option><option value="with_contact">Has contact</option><option value="missing_contact">Missing contact</option>
          </select>
          <select value={arrivalFilter} onChange={(event) => setArrivalFilter(event.target.value as ArrivalFilter)} className="h-10 rounded-md border border-gold/20 bg-white px-3 text-sm">
            <option value="all">All arrival states</option><option value="checked_in">Checked in</option><option value="not_arrived">Not arrived</option>
          </select>
          <select value={passFilter} onChange={(event) => setPassFilter(event.target.value as PassFilter)} className="h-10 rounded-md border border-gold/20 bg-white px-3 text-sm">
            <option value="all">All Pass states</option>
            <option value="pending_rsvp">RSVP required</option><option value="declined">Declined</option><option value="not_yet_issuable">Not yet issuable</option><option value="not_yet_issued">Ready / not issued</option><option value="active">Active</option><option value="revoked">Revoked</option><option value="superseded">Superseded</option><option value="issuance_closed">Issuance closed</option>
          </select>
          <Button type="button" variant="outline" onClick={resetOperationalFilters}>Reset</Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gold/15 bg-white/70 p-3">
          <Button type="button" size="sm" variant="outline" onClick={toggleAllFiltered}>
            <CheckSquare2 className="size-4" />
            {allFilteredSelected ? 'Clear filtered selection' : `Select all ${filteredRows.length} filtered`}
          </Button>
          <span className="text-xs text-espresso/55">{selectedRows.length} selected</span>
          <select
            value={deliveryChannel}
            onChange={(event) => setDeliveryChannel(event.target.value as DeliveryChannel)}
            className="ml-auto h-9 rounded-md border border-gold/20 bg-white px-2 text-xs"
            aria-label="Delivery channel"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="other">Other</option>
          </select>
          <Button type="button" size="sm" disabled={selectedRows.length === 0 || busy !== null} onClick={() => void recordDelivery(selectedRows.map((row) => row.id))}>
            {busy === 'delivery' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Mark selected sent
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={selectedRows.length === 0 || busy !== null} onClick={() => void clearDelivery(selectedRows.map((row) => row.id))}>
            Reset sent status
          </Button>
        </div>

        <p className="mt-3 text-xs text-espresso/50">
          Showing {Math.min(displayedRows.length, filteredRows.length)} of {filteredRows.length} matching guests · {rows.length} total
        </p>
      </section>

      <section className="mt-5" aria-labelledby="personal-invitation-delivery-heading">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Personal delivery</p>
          <h3 id="personal-invitation-delivery-heading" className="mt-1 font-serif text-2xl">Open Invitation · guest-specific links & QR codes</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-espresso/50">
            Each credential belongs to one guest. The delivery register records organizer workflow only; RSVP and Wedding Pass remain separate authorities.
          </p>
        </div>

        {busy === 'load' && rows.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="size-7 animate-spin text-gold-muted" />
          </div>
        ) : (
          <div className="space-y-3">
            {displayedRows.map((row) => {
              const editing = editingId === row.id
              return (
                <article key={row.id} className="rounded-2xl border border-gold/20 bg-champagne p-4 sm:p-5">
                  <div className="grid gap-4 lg:grid-cols-[2rem_8rem_minmax(0,1fr)]">
                    <div className="pt-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelected(row.id)}
                        aria-label={`Select ${row.name}`}
                        className="size-4 accent-[#BF9B5F]"
                      />
                    </div>
                    <div>
                      {row.qrValue ? (
                        <GuestQr value={row.qrValue} name={row.name} />
                      ) : (
                        <div className="flex size-32 items-center justify-center rounded-xl border border-dashed border-gold/30">
                          <QrCode className="size-9 text-gold/40" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      {editing ? (
                        <div className="space-y-3 rounded-xl border border-gold/15 bg-white/65 p-3">
                          <PlannerGuestEditor
                            value={editGuest}
                            tables={tables}
                            onChange={setEditGuest}
                            idPrefix={`invitation-edit-${row.id}`}
                            tone="light"
                            disabled={busy !== null}
                          />
                          <div className="flex gap-2">
                            <Button type="button" size="sm" disabled={busy !== null} onClick={() => void saveGuest(row)}>
                              {busy === `edit-${row.id}` ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                              Save guest
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                              <X className="size-4" />Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="font-serif text-2xl">{row.name}</h4>
                              <p className="mt-1 text-xs text-espresso/55">{row.email || row.phone || 'No contact saved'}</p>
                              {row.email && row.phone && <p className="mt-1 text-xs text-espresso/45">{row.phone}</p>}
                              <p className="mt-1 text-[11px] text-espresso/45">
                                {row.role.replaceAll('_', ' ')}{row.roleDetail ? ` · ${row.roleDetail}` : ''} · {row.side || 'neutral'}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">{row.status}</span>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${row.deliveryStatus === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-white/75 text-espresso/55'}`}>
                                {row.deliveryStatus === 'sent' ? 'Sent' : 'Not sent'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-espresso/55 sm:grid-cols-2 xl:grid-cols-5">
                            <p>Table: <strong>{row.seatingTableName || row.tableNumber || 'Not assigned'}</strong></p>
                            <p>{row.checkedIn ? 'Checked in' : 'Not checked in'}</p>
                            <p>Pass: <strong>{row.passState.replaceAll('_', ' ')}</strong></p>
                            <p>Channel: <strong>{channelLabel(row.deliveryChannel)}</strong></p>
                            <p>Sent: <strong>{deliveryTime(row.deliveredAt)}</strong></p>
                            <p>Opened: <strong>{deliveryTime(row.openedAt)}</strong></p>
                          </div>
                          {row.deliveredBy && <p className="mt-1 text-[11px] text-espresso/45">Recorded by {row.deliveredBy}</p>}

                          <PlannerGuestInvitationActions
                            guest={row}
                            disabled={busy !== null}
                            initialChannel={deliveryChannel}
                            onDeliveryChanged={load}
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => startEdit(row)} disabled={busy !== null}>
                              <Pencil className="size-4" />Edit guest
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => void rotate(row)} disabled={busy !== null}>
                              <RotateCcw className={`size-4 ${busy === `rotate-${row.id}` ? 'animate-spin' : ''}`} />Rotate
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => void deleteGuest(row)} disabled={busy !== null} className="border-clay/30 text-clay-light">
                              {busy === `delete-${row.id}` ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                              Remove
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}

            {filteredRows.length === 0 && (
              <p className="rounded-2xl border border-dashed border-gold/30 p-8 text-center text-sm text-espresso/55">
                {rows.length === 0 ? 'Add guests to generate private digital invitation cards, links and QR codes.' : 'No guests match the current filters.'}
              </p>
            )}

            {visibleCount < filteredRows.length && (
              <div className="flex justify-center pt-2">
                <Button type="button" variant="outline" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>
                  Show next {Math.min(PAGE_SIZE, filteredRows.length - visibleCount)}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  )
}
