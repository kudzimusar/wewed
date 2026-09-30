'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Check, CheckCircle2, Circle, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  PlannerGuestEditor,
  PLANNER_GUEST_SIDE_OPTIONS,
  type PlannerGuestEditorValue,
} from '@/components/wedding/planner/planner-guest-editor'
import {
  PlannerGuestInvitationActions,
  type PlannerGuestInvitationActionData,
} from '@/components/wedding/planner/planner-guest-invitation-actions'
import { usePlannerFilterState } from '@/lib/planner-filter-state'

export interface GuestRow {
  id: string; name: string; email: string | null; phone: string | null; role: string; roleDetail: string | null; side: string | null; seatingTableId: string | null; seatingTableName: string | null
  rsvp: { attending: boolean | null; mealChoice: string | null; plusOne: boolean; plusOneName: string | null; plusOneMeal: string | null; kidsAttending: boolean; kidsCount: number; dietaryNotes: string | null; checkedIn: boolean; checkedInAt: string | null } | null
}
export interface SeatingTableOption { id: string; name: string; capacity: number }
export type GuestForm = PlannerGuestEditorValue
export interface GuestStats { total: number; confirmed: number; declined: number; pending: number; plusOnes: number; kidsTotal: number; checkedIn: number; heads: number }
export interface GuestUpdate { name: string; email: string | null; phone: string | null; role: string; roleDetail: string | null; side: string; seatingTableId: string | null }
interface PlannerGuestsModuleProps {
  guests: GuestRow[]; tables: SeatingTableOption[]; guestForm: GuestForm; setGuestForm: Dispatch<SetStateAction<GuestForm>>; guestStats: GuestStats; saving: boolean
  onAddGuest: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onUpdateGuest: (guest: GuestRow, updates: GuestUpdate) => Promise<{ success: boolean; error?: string; field?: string }>
  onAssignGuestTable: (guest: GuestRow, tableId: string | null) => void | Promise<void>
  onDeleteGuest: (guest: GuestRow) => void | Promise<void>
}
const GUEST_SIDES = PLANNER_GUEST_SIDE_OPTIONS
function titleCase(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function sideLabel(value: string | null): string { return GUEST_SIDES.find((side) => side.value === value)?.label ?? (value ? titleCase(value) : 'No side') }
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section> }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center"><p className="font-serif text-lg text-champagne">{title}</p><p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">{detail}</p></div> }
function validEmail(value: string): boolean { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) }

export function PlannerGuestsModule({ guests, tables, guestForm, setGuestForm, guestStats, saving, onAddGuest, onUpdateGuest, onAssignGuestTable, onDeleteGuest }: PlannerGuestsModuleProps) {
  const [filters, setFilters, resetFilters] = usePlannerFilterState('wewed:planner:guests:filters', { search: '', side: 'all', status: 'all' })
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null)
  const [editGuest, setEditGuest] = useState<PlannerGuestEditorValue>({ name: '', email: '', phone: '', role: 'guest', roleDetail: '', side: 'neutral', seatingTableId: '' })
  const [editError, setEditError] = useState<string | null>(null)
  const [invitationActions, setInvitationActions] = useState<Record<string, PlannerGuestInvitationActionData>>({})

  const guestRevision = useMemo(
    () => guests.map((guest) => [guest.id, guest.name, guest.email ?? '', guest.phone ?? ''].join(':')).join('|'),
    [guests],
  )

  const loadInvitationActions = useCallback(async () => {
    try {
      const response = await fetch('/api/planner/guests/invitations', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) return
      const next: Record<string, PlannerGuestInvitationActionData> = {}
      for (const row of payload.data as PlannerGuestInvitationActionData[]) next[row.id] = row
      setInvitationActions(next)
    } catch {
      // Guest register remains usable when invitation delivery data is temporarily unavailable.
    }
  }, [])

  useEffect(() => { void loadInvitationActions() }, [guestRevision, loadInvitationActions])

  const filteredGuests = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return guests.filter((guest) => {
      if (filters.side !== 'all' && guest.side !== filters.side) return false
      const attending = guest.rsvp?.attending
      if (filters.status === 'confirmed' && attending !== true) return false
      if (filters.status === 'declined' && attending !== false) return false
      if (filters.status === 'pending' && attending !== null && attending !== undefined) return false
      return !query || [guest.name, guest.email ?? '', guest.phone ?? '', guest.seatingTableName ?? ''].some((value) => value.toLowerCase().includes(query))
    })
  }, [guests, filters])

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
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">{[['Invited', guestStats.total], ['Confirmed', guestStats.confirmed], ['Declined', guestStats.declined], ['Pending', guestStats.pending], ['Plus-ones', guestStats.plusOnes], ['Kids', guestStats.kidsTotal], ['Heads', guestStats.heads], ['Checked-in', guestStats.checkedIn]].map(([label, value]) => <SectionCard key={String(label)} className="p-3 text-center"><p className="font-serif text-xl">{value}</p><p className="font-sans text-[9px] uppercase tracking-wider text-champagne/45">{label}</p></SectionCard>)}</div>

    <SectionCard className="p-4">
      <div className="mb-3"><h2 className="font-serif text-lg">Add guest</h2><p className="font-sans text-xs text-champagne/50">Create the canonical Guest record and optionally assign an initial table.</p></div>
      <form onSubmit={onAddGuest} className="space-y-3">
        <PlannerGuestEditor value={guestForm} tables={tables} onChange={setGuestForm} idPrefix="workspace-guest" tone="dark" disabled={saving} />
        <div className="flex justify-end"><Button type="submit" disabled={saving} className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add guest</Button></div>
      </form>
    </SectionCard>

    <SectionCard className="overflow-hidden">
      <div className="grid gap-3 border-b border-gold/10 p-4 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, email, phone, or table" className="border-gold/20 bg-espresso/70 pl-9" /></div><select value={filters.side} onChange={(event) => setFilters((current) => ({ ...current, side: event.target.value }))} aria-label="Filter guests by side" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All sides</option>{GUEST_SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}</select><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="Filter guests by RSVP" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All RSVP states</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option><option value="pending">Pending</option></select><Button type="button" variant="outline" onClick={resetFilters} className="border-gold/20 bg-transparent text-champagne/60">Reset</Button></div>
      <div className="space-y-2 p-4">{guests.length === 0 ? <EmptyState title="No guests" detail="Add guests here or use the Guests worksheet import." /> : filteredGuests.length === 0 ? <EmptyState title="No guests in this view" detail="Clear the search or filters to see the remaining guest records." /> : filteredGuests.map((guest) => {
        const editing = editingGuestId === guest.id
        return <div key={guest.id} className="rounded-xl border border-gold/10 bg-espresso/45 p-3">
          {editing ? <div className="space-y-3"><PlannerGuestEditor value={editGuest} tables={tables} onChange={(value) => { setEditGuest(value); setEditError(null) }} idPrefix={`guest-edit-${guest.id}`} tone="dark" disabled={saving} />{editError && <p id={`guest-edit-error-${guest.id}`} role="alert" className="font-sans text-xs text-clay-light">{editError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditingGuestId(null)}><X className="size-4" />Cancel</Button><Button type="button" disabled={saving} onClick={() => void saveEdit(guest)} className="bg-gold text-espresso"><Check className="size-4" />Save guest</Button></div></div> : <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem_auto] md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-sans text-sm font-medium">{guest.name}</p><Badge variant="outline" className="border-gold/25 text-[10px] text-champagne/70">{titleCase(guest.role)}</Badge><Badge variant="outline" className="border-gold/25 text-[10px] text-champagne/70">{sideLabel(guest.side)}</Badge>{guest.rsvp?.attending === true ? <Badge className="bg-sage/15 text-sage-light"><CheckCircle2 className="mr-1 size-3" />Confirmed</Badge> : guest.rsvp?.attending === false ? <Badge variant="outline" className="border-clay/40 text-clay-light">Declined</Badge> : <Badge variant="outline" className="border-gold/20 text-champagne/55"><Circle className="mr-1 size-3" />Pending</Badge>}</div><p className="mt-1 truncate font-sans text-xs text-champagne/55">{guest.email || 'No email'} · {guest.phone || 'No phone'}</p>{guest.roleDetail && <p className="mt-1 font-sans text-[11px] text-champagne/45">{guest.roleDetail}</p>}{guest.rsvp && <p className="mt-1 font-sans text-[11px] leading-5 text-champagne/45">Meal choice: {guest.rsvp.mealChoice || 'Not set'} · Plus-one name: {guest.rsvp.plusOneName || 'None'} · Kids count: {guest.rsvp.kidsCount} · Dietary notes: {guest.rsvp.dietaryNotes || 'None'} · Checked in: {guest.rsvp.checkedIn ? 'Yes' : 'No'}</p>}{invitationActions[guest.id] && <PlannerGuestInvitationActions guest={invitationActions[guest.id]} compact disabled={saving} onDeliveryChanged={loadInvitationActions} />}</div><select value={guest.seatingTableId ?? ''} onChange={(event) => void onAssignGuestTable(guest, event.target.value || null)} aria-label={`Assign table for ${guest.name}`} className="h-9 rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs"><option value="">Unassigned</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${guest.name}`} disabled={saving} onClick={() => startEdit(guest)} className="size-9 text-champagne/50 hover:text-gold"><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${guest.name}`} disabled={saving} onClick={() => { if (window.confirm(`Delete guest “${guest.name}”?`)) void onDeleteGuest(guest) }} className="size-9 text-champagne/45 hover:bg-clay/10 hover:text-clay-light"><Trash2 className="size-4" /></Button></div></div>}
        </div>
      })}</div>
    </SectionCard>
  </div>
}
