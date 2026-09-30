'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Check, CheckCircle2, Circle, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  PlannerGuestEditor,
  PLANNER_GUEST_ALLOCATION_OPTIONS,
  PLANNER_GUEST_SIDE_OPTIONS,
  type PlannerGuestEditorValue,
} from '@/components/wedding/planner/planner-guest-editor'
import { PlannerGuestCapacityPanel } from '@/components/wedding/planner/planner-guest-capacity-panel'
import {
  PlannerGuestInvitationActions,
  type PlannerGuestInvitationActionData,
} from '@/components/wedding/planner/planner-guest-invitation-actions'
import { usePlannerFilterState } from '@/lib/planner-filter-state'

export interface GuestRow {
  id: string; name: string; email: string | null; phone: string | null; role: string; roleDetail: string | null; side: string | null; attendanceAllocation: string; seatingTableId: string | null; seatingTableName: string | null
  rsvp: { attending: boolean | null; mealChoice: string | null; plusOne: boolean; plusOneName: string | null; plusOneMeal: string | null; kidsAttending: boolean; kidsCount: number; dietaryNotes: string | null; checkedIn: boolean; checkedInAt: string | null } | null
}
export interface SeatingTableOption { id: string; name: string; capacity: number }
export type GuestForm = PlannerGuestEditorValue
export interface GuestStats { total: number; confirmed: number; declined: number; pending: number; plusOnes: number; kidsTotal: number; checkedIn: number; heads: number }
type GuestPassState = 'pending_rsvp' | 'declined' | 'not_yet_issuable' | 'not_yet_issued' | 'active' | 'revoked' | 'superseded' | 'issuance_closed'
interface GuestRegisterSummary { registered: number; sent: number; notSent: number; opened: number; responded: number; responseRate: number; attending: number; declined: number; awaiting: number; expectedNamedAttendees: number; checkedIn: number; notYetArrived: number; missingContact: number; passPendingRsvp: number; passDeclined: number; passNotYetIssuable: number; passNotYetIssued: number; passActive: number; passRevoked: number; passSuperseded: number; passIssuanceClosed: number; nativeActivated: number; nativeActivationRate: number; nativeAndroid: number; nativeIos: number }
interface GuestInvitationOperationalRow extends PlannerGuestInvitationActionData { status: 'attending' | 'declined' | 'pending'; openedAt: string | null; checkedIn: boolean; passState: GuestPassState; nativeActivated: boolean; nativePlatforms: string[]; nativeLastSeenAt: string | null; email: string | null; phone: string | null; role: string; side: string | null }
export interface GuestUpdate { name: string; email: string | null; phone: string | null; role: string; roleDetail: string | null; side: string; attendanceAllocation: string; seatingTableId: string | null }
interface PlannerGuestsModuleProps {
  guests: GuestRow[]; tables: SeatingTableOption[]; guestForm: GuestForm; setGuestForm: Dispatch<SetStateAction<GuestForm>>; saving: boolean
  onAddGuest: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onUpdateGuest: (guest: GuestRow, updates: GuestUpdate) => Promise<{ success: boolean; error?: string; field?: string }>
  onAssignGuestTable: (guest: GuestRow, tableId: string | null) => void | Promise<void>
  onDeleteGuest: (guest: GuestRow) => void | Promise<void>
}
const GUEST_SIDES = PLANNER_GUEST_SIDE_OPTIONS
const GUEST_ALLOCATIONS = PLANNER_GUEST_ALLOCATION_OPTIONS
function titleCase(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function sideLabel(value: string | null): string { return GUEST_SIDES.find((side) => side.value === value)?.label ?? (value ? titleCase(value) : 'No side') }
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section> }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center"><p className="font-serif text-lg text-champagne">{title}</p><p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">{detail}</p></div> }
function validEmail(value: string): boolean { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) }

export function PlannerGuestsModule({ guests, tables, guestForm, setGuestForm, saving, onAddGuest, onUpdateGuest, onAssignGuestTable, onDeleteGuest }: PlannerGuestsModuleProps) {
  const [filters, setFilters, resetFilters] = usePlannerFilterState('wewed:planner:guests:filters', { search: '', side: 'all', allocation: 'all', status: 'all', delivery: 'all', open: 'all', contact: 'all', arrival: 'all', pass: 'all', native: 'all' })
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null)
  const [editGuest, setEditGuest] = useState<PlannerGuestEditorValue>({ name: '', email: '', phone: '', role: 'guest', roleDetail: '', side: 'neutral', attendanceAllocation: 'shared', seatingTableId: '' })
  const [editError, setEditError] = useState<string | null>(null)
  const [invitationActions, setInvitationActions] = useState<Record<string, GuestInvitationOperationalRow>>({})
  const [attendanceSummary, setAttendanceSummary] = useState<GuestRegisterSummary | null>(null)

  const guestRevision = useMemo(
    () => guests.map((guest) => [guest.id, guest.name, guest.email ?? '', guest.phone ?? ''].join(':')).join('|'),
    [guests],
  )

  const loadInvitationActions = useCallback(async () => {
    try {
      const response = await fetch('/api/planner/guests/invitations', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) return
      const next: Record<string, GuestInvitationOperationalRow> = {}
      for (const row of payload.data as GuestInvitationOperationalRow[]) next[row.id] = row
      setInvitationActions(next)
      setAttendanceSummary(payload.summary ?? null)
    } catch {
      // Guest register remains usable when invitation delivery data is temporarily unavailable.
    }
  }, [])

  useEffect(() => { void loadInvitationActions() }, [guestRevision, loadInvitationActions])

  const filteredGuests = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return guests.filter((guest) => {
      if (filters.side !== 'all' && guest.side !== filters.side) return false
      if (filters.allocation !== 'all' && guest.attendanceAllocation !== filters.allocation) return false
      const operational = invitationActions[guest.id]
      const attending = guest.rsvp?.attending
      if (filters.status === 'responded' && attending == null) return false
      if (filters.status === 'attending' && attending !== true) return false
      if (filters.status === 'declined' && attending !== false) return false
      if (filters.status === 'pending' && attending !== null && attending !== undefined) return false
      if (filters.delivery !== 'all' && operational?.deliveryStatus !== filters.delivery) return false
      if (filters.open === 'opened' && !operational?.openedAt) return false
      if (filters.open === 'not_opened' && operational?.openedAt) return false
      const hasContact = Boolean(guest.email || guest.phone)
      if (filters.contact === 'missing_contact' && hasContact) return false
      if (filters.contact === 'with_contact' && !hasContact) return false
      if (filters.arrival === 'checked_in' && !operational?.checkedIn) return false
      if (filters.arrival === 'not_arrived' && (attending !== true || operational?.checkedIn)) return false
      if (filters.pass !== 'all' && operational?.passState !== filters.pass) return false
      if (filters.native === 'active' && !operational?.nativeActivated) return false
      if (filters.native === 'not_active' && operational?.nativeActivated) return false
      if (filters.native === 'android' && !operational?.nativePlatforms.includes('android')) return false
      if (filters.native === 'ios' && !operational?.nativePlatforms.includes('ios')) return false
      return !query || [guest.name, guest.email ?? '', guest.phone ?? '', guest.seatingTableName ?? ''].some((value) => value.toLowerCase().includes(query))
    })
  }, [guests, filters, invitationActions])

  function focusSummary(key: string) {
    resetFilters()
    if (key === 'sent') setFilters((current) => ({ ...current, delivery: 'sent' }))
    if (key === 'notSent') setFilters((current) => ({ ...current, delivery: 'not_sent' }))
    if (key === 'opened') setFilters((current) => ({ ...current, open: 'opened' }))
    if (key === 'responded') setFilters((current) => ({ ...current, status: 'responded' }))
    if (key === 'attending' || key === 'expectedNamedAttendees') setFilters((current) => ({ ...current, status: 'attending' }))
    if (key === 'declined') setFilters((current) => ({ ...current, status: 'declined' }))
    if (key === 'awaiting') setFilters((current) => ({ ...current, status: 'pending' }))
    if (key === 'checkedIn') setFilters((current) => ({ ...current, arrival: 'checked_in' }))
    if (key === 'notYetArrived') setFilters((current) => ({ ...current, arrival: 'not_arrived' }))
    if (key === 'missingContact') setFilters((current) => ({ ...current, contact: 'missing_contact' }))
    if (key === 'passPendingRsvp') setFilters((current) => ({ ...current, pass: 'pending_rsvp' }))
    if (key === 'passDeclined') setFilters((current) => ({ ...current, pass: 'declined' }))
    if (key === 'passNotYetIssuable') setFilters((current) => ({ ...current, pass: 'not_yet_issuable' }))
    if (key === 'passNotYetIssued') setFilters((current) => ({ ...current, pass: 'not_yet_issued' }))
    if (key === 'passActive') setFilters((current) => ({ ...current, pass: 'active' }))
    if (key === 'passRevoked') setFilters((current) => ({ ...current, pass: 'revoked' }))
    if (key === 'passSuperseded') setFilters((current) => ({ ...current, pass: 'superseded' }))
    if (key === 'passIssuanceClosed') setFilters((current) => ({ ...current, pass: 'issuance_closed' }))
    if (key === 'nativeActivated') setFilters((current) => ({ ...current, native: 'active' }))
    if (key === 'nativeAndroid') setFilters((current) => ({ ...current, native: 'android' }))
    if (key === 'nativeIos') setFilters((current) => ({ ...current, native: 'ios' }))
  }

  function startEdit(guest: GuestRow) {
    setEditingGuestId(guest.id)
    setEditError(null)
    setEditGuest({
      name: guest.name,
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      role: guest.role,
      roleDetail: guest.roleDetail ?? '',
      side: guest.side ?? 'neutral',
      attendanceAllocation: guest.attendanceAllocation ?? 'shared',
      seatingTableId: guest.seatingTableId ?? '',
    })
  }
  async function saveEdit(guest: GuestRow) {
    const name = editGuest.name.trim()
    const email = editGuest.email.trim().toLowerCase() || null
    if (!name) { setEditError('Enter the guest name.'); return }
    if (email && !validEmail(email)) { setEditError('Enter a valid email address.'); return }
    const result = await onUpdateGuest(guest, {
      name,
      email,
      phone: editGuest.phone.trim() || null,
      role: editGuest.role,
      roleDetail: editGuest.roleDetail.trim() || null,
      side: editGuest.side,
      attendanceAllocation: editGuest.attendanceAllocation,
      seatingTableId: editGuest.seatingTableId || null,
    })
    if (result.success) {
      setEditingGuestId(null)
      setEditError(null)
    } else {
      setEditError(result.error ?? 'The guest could not be saved.')
    }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70">Guest operations</p>
        <h2 className="mt-1 font-serif text-xl">Guest register</h2>
        <p className="mt-1 font-sans text-xs text-champagne/50">Edit guest records here; prepare, send and track personal invitations in the dedicated command center.</p>
      </div>
      <Button asChild variant="outline" className="border-gold/25 bg-transparent text-gold">
        <Link href="/planner/invitations">
          <Send className="size-4" />
          Invitation delivery
        </Link>
      </Button>
    </div>
    {attendanceSummary && <div data-testid="guest-register-canonical-summary" className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-5">{[
      ['registered', 'Registered', attendanceSummary.registered], ['sent', 'Sent', attendanceSummary.sent], ['notSent', 'Not sent', attendanceSummary.notSent], ['opened', 'Opened', attendanceSummary.opened], ['responded', 'Responded', attendanceSummary.responded], ['responseRate', 'Response rate', `${Math.round(attendanceSummary.responseRate * 100)}%`], ['attending', 'Attending', attendanceSummary.attending], ['declined', 'Declined', attendanceSummary.declined], ['awaiting', 'Awaiting', attendanceSummary.awaiting], ['expectedNamedAttendees', 'Expected named', attendanceSummary.expectedNamedAttendees], ['checkedIn', 'Checked in', attendanceSummary.checkedIn], ['notYetArrived', 'Not arrived', attendanceSummary.notYetArrived], ['missingContact', 'Missing contact', attendanceSummary.missingContact], ['passPendingRsvp', 'Pass · RSVP required', attendanceSummary.passPendingRsvp], ['passDeclined', 'Pass · Declined', attendanceSummary.passDeclined], ['passNotYetIssuable', 'Pass · Not yet issuable', attendanceSummary.passNotYetIssuable], ['passNotYetIssued', 'Pass · Ready / not issued', attendanceSummary.passNotYetIssued], ['passActive', 'Pass · Active', attendanceSummary.passActive], ['passRevoked', 'Pass · Revoked', attendanceSummary.passRevoked], ['passSuperseded', 'Pass · Superseded', attendanceSummary.passSuperseded], ['passIssuanceClosed', 'Pass · Issuance closed', attendanceSummary.passIssuanceClosed], ['nativeActivated', 'App active', attendanceSummary.nativeActivated], ['nativeActivationRate', 'App activation', `${Math.round(attendanceSummary.nativeActivationRate * 100)}%`], ['nativeAndroid', 'Android active', attendanceSummary.nativeAndroid], ['nativeIos', 'iOS active', attendanceSummary.nativeIos],
    ].map(([key, label, value]) => <button key={String(key)} type="button" onClick={() => focusSummary(String(key))} className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-3 text-center hover:border-gold/30"><p className="font-serif text-xl">{value}</p><p className="font-sans text-[9px] uppercase tracking-wider text-champagne/45">{label}</p></button>)}</div>}

    <PlannerGuestCapacityPanel revision={guests.map((guest) => `${guest.id}:${guest.attendanceAllocation}:${guest.rsvp?.attending ?? 'pending'}`).join('|')} />

    <SectionCard className="p-4">
      <div className="mb-3"><h2 className="font-serif text-lg">Add guest</h2><p className="font-sans text-xs text-champagne/50">Create the canonical Guest record and optionally assign an initial table.</p></div>
      <form onSubmit={onAddGuest} className="space-y-3">
        <PlannerGuestEditor value={guestForm} tables={tables} onChange={setGuestForm} idPrefix="workspace-guest" tone="dark" disabled={saving} />
        <div className="flex justify-end"><Button type="submit" disabled={saving} className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add guest</Button></div>
      </form>
    </SectionCard>

    <SectionCard className="overflow-hidden">
      <div className="grid gap-3 border-b border-gold/10 p-4 sm:grid-cols-2 xl:grid-cols-5"><div className="relative sm:col-span-2"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, email, phone, or table" className="border-gold/20 bg-espresso/70 pl-9" /></div><select value={filters.side} onChange={(event) => setFilters((current) => ({ ...current, side: event.target.value }))} aria-label="Filter guests by relationship side" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All relationship sides</option>{GUEST_SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}</select><select value={filters.allocation} onChange={(event) => setFilters((current) => ({ ...current, allocation: event.target.value }))} aria-label="Filter guests by capacity allocation" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All capacity allocations</option>{GUEST_ALLOCATIONS.map((allocation) => <option key={allocation.value} value={allocation.value}>{allocation.label}</option>)}</select><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="Filter guests by RSVP" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All RSVP states</option><option value="responded">Responded</option><option value="attending">Attending</option><option value="declined">Declined</option><option value="pending">Awaiting</option></select><select value={filters.delivery} onChange={(event) => setFilters((current) => ({ ...current, delivery: event.target.value }))} aria-label="Filter guests by delivery" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All delivery states</option><option value="sent">Sent</option><option value="not_sent">Not sent</option></select><select value={filters.open} onChange={(event) => setFilters((current) => ({ ...current, open: event.target.value }))} aria-label="Filter guests by open state" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All open states</option><option value="opened">Opened</option><option value="not_opened">Not opened</option></select><select value={filters.contact} onChange={(event) => setFilters((current) => ({ ...current, contact: event.target.value }))} aria-label="Filter guests by contact" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All contacts</option><option value="with_contact">Has contact</option><option value="missing_contact">Missing contact</option></select><select value={filters.arrival} onChange={(event) => setFilters((current) => ({ ...current, arrival: event.target.value }))} aria-label="Filter guests by arrival" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All arrival states</option><option value="checked_in">Checked in</option><option value="not_arrived">Not arrived</option></select><select value={filters.pass} onChange={(event) => setFilters((current) => ({ ...current, pass: event.target.value }))} aria-label="Filter guests by Pass" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All Pass states</option><option value="pending_rsvp">RSVP required</option><option value="declined">Declined</option><option value="not_yet_issuable">Not yet issuable</option><option value="not_yet_issued">Ready / not issued</option><option value="active">Active</option><option value="revoked">Revoked</option><option value="superseded">Superseded</option><option value="issuance_closed">Issuance closed</option></select><select value={filters.native} onChange={(event) => setFilters((current) => ({ ...current, native: event.target.value }))} aria-label="Filter guests by app activation" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All app states</option><option value="active">App active</option><option value="not_active">App not active</option><option value="android">Android active</option><option value="ios">iOS active</option></select><Button type="button" variant="outline" onClick={resetFilters} className="border-gold/20 bg-transparent text-champagne/60">Reset</Button></div>
      <div className="space-y-2 p-4">{guests.length === 0 ? <EmptyState title="No guests" detail="Add guests here or use the Guests worksheet import." /> : filteredGuests.length === 0 ? <EmptyState title="No guests in this view" detail="Clear the search or filters to see the remaining guest records." /> : filteredGuests.map((guest) => {
        const editing = editingGuestId === guest.id
        return <div key={guest.id} className="rounded-xl border border-gold/10 bg-espresso/45 p-3">
          {editing ? <div className="space-y-3"><PlannerGuestEditor value={editGuest} tables={tables} onChange={(value) => { setEditGuest(value); setEditError(null) }} idPrefix={`guest-edit-${guest.id}`} tone="dark" disabled={saving} />{editError && <p id={`guest-edit-error-${guest.id}`} role="alert" className="font-sans text-xs text-clay-light">{editError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditingGuestId(null)}><X className="size-4" />Cancel</Button><Button type="button" disabled={saving} onClick={() => void saveEdit(guest)} className="bg-gold text-espresso"><Check className="size-4" />Save guest</Button></div></div> : <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem_auto] md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-sans text-sm font-medium">{guest.name}</p><Badge variant="outline" className="border-gold/25 text-[10px] text-champagne/70">{titleCase(guest.role)}</Badge><Badge variant="outline" className="border-gold/25 text-[10px] text-champagne/70">{sideLabel(guest.side)}</Badge><Badge variant="outline" className="border-gold/25 text-[10px] text-champagne/70">Allocation: {titleCase(guest.attendanceAllocation)}</Badge>{guest.rsvp?.attending === true ? <Badge className="bg-sage/15 text-sage-light"><CheckCircle2 className="mr-1 size-3" />Confirmed</Badge> : guest.rsvp?.attending === false ? <Badge variant="outline" className="border-clay/40 text-clay-light">Declined</Badge> : <Badge variant="outline" className="border-gold/20 text-champagne/55"><Circle className="mr-1 size-3" />Pending</Badge>}</div><p className="mt-1 truncate font-sans text-xs text-champagne/55">{guest.email || 'No email'} · {guest.phone || 'No phone'}</p>{guest.roleDetail && <p className="mt-1 font-sans text-[11px] text-champagne/45">{guest.roleDetail}</p>}{invitationActions[guest.id] && <><p className="mt-1 font-sans text-[11px] text-champagne/45">Wedding Pass: {invitationActions[guest.id].passState.replaceAll('_', ' ')}</p><p className="mt-1 font-sans text-[11px] text-champagne/45">App: {invitationActions[guest.id].nativeActivated ? invitationActions[guest.id].nativePlatforms.join(' + ') : 'Not active'}</p></>}{guest.rsvp && <p className="mt-1 font-sans text-[11px] leading-5 text-champagne/45">Meal choice: {guest.rsvp.mealChoice || 'Not set'} · Plus-one name: {guest.rsvp.plusOneName || 'None'} · Kids count: {guest.rsvp.kidsCount} · Dietary notes: {guest.rsvp.dietaryNotes || 'None'} · Checked in: {guest.rsvp.checkedIn ? 'Yes' : 'No'}</p>}{invitationActions[guest.id] && <PlannerGuestInvitationActions guest={invitationActions[guest.id]} compact disabled={saving} onDeliveryChanged={loadInvitationActions} />}</div><select value={guest.seatingTableId ?? ''} onChange={(event) => void onAssignGuestTable(guest, event.target.value || null)} aria-label={`Assign table for ${guest.name}`} className="h-9 rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs"><option value="">Unassigned</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${guest.name}`} disabled={saving} onClick={() => startEdit(guest)} className="size-9 text-champagne/50 hover:text-gold"><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${guest.name}`} disabled={saving} onClick={() => { if (window.confirm(`Delete guest “${guest.name}”?`)) void onDeleteGuest(guest) }} className="size-9 text-champagne/45 hover:bg-clay/10 hover:text-clay-light"><Trash2 className="size-4" /></Button></div></div>}
        </div>
      })}</div>
    </SectionCard>
  </div>
}
