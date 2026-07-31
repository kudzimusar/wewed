'use client'

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Check, CheckCircle2, Circle, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePlannerFilterState } from '@/lib/planner-filter-state'

export interface GuestRow {
  id: string; name: string; email: string | null; phone: string | null; role: string; roleDetail: string | null; side: string | null; seatingTableId: string | null; seatingTableName: string | null
  rsvp: { attending: boolean | null; mealChoice: string | null; plusOne: boolean; plusOneName: string | null; plusOneMeal: string | null; kidsAttending: boolean; kidsCount: number; dietaryNotes: string | null; checkedIn: boolean; checkedInAt: string | null } | null
}
export interface SeatingTableOption { id: string; name: string; capacity: number }
export interface GuestForm { name: string; email: string; phone: string; role: string; side: string; seatingTableId: string }
export interface GuestStats { total: number; confirmed: number; declined: number; pending: number; plusOnes: number; kidsTotal: number; checkedIn: number; heads: number }
export interface GuestUpdate { name: string; email: string | null; phone: string | null; role: string; side: string }
interface PlannerGuestsModuleProps {
  guests: GuestRow[]; tables: SeatingTableOption[]; guestForm: GuestForm; setGuestForm: Dispatch<SetStateAction<GuestForm>>; guestStats: GuestStats; saving: boolean
  onAddGuest: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onUpdateGuest: (guest: GuestRow, updates: GuestUpdate) => Promise<{ success: boolean; error?: string; field?: string }>
  onAssignGuestTable: (guest: GuestRow, tableId: string | null) => void | Promise<void>
  onDeleteGuest: (guest: GuestRow) => void | Promise<void>
}
const GUEST_ROLES = [{ value: 'guest', label: 'Guest' }, { value: 'bridal_party', label: 'Bridal party' }, { value: 'family', label: 'Family' }, { value: 'officiant', label: 'Officiant' }, { value: 'vip', label: 'VIP' }]
const GUEST_SIDES = [{ value: 'bride', label: "Bride's side" }, { value: 'groom', label: "Groom's side" }, { value: 'family', label: 'Shared family' }, { value: 'neutral', label: 'Neutral / shared' }]
function titleCase(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function sideLabel(value: string | null): string { return GUEST_SIDES.find((side) => side.value === value)?.label ?? (value ? titleCase(value) : 'No side') }
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section> }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center"><p className="font-serif text-lg text-champagne">{title}</p><p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">{detail}</p></div> }
function validEmail(value: string): boolean { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) }

export function PlannerGuestsModule({ guests, tables, guestForm, setGuestForm, guestStats, saving, onAddGuest, onUpdateGuest, onAssignGuestTable, onDeleteGuest }: PlannerGuestsModuleProps) {
  const [filters, setFilters, resetFilters] = usePlannerFilterState('wewed:planner:guests:filters', { search: '', side: 'all', status: 'all' })
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null)
  const [editGuest, setEditGuest] = useState<GuestUpdate>({ name: '', email: null, phone: null, role: 'guest', side: 'neutral' })
  const [editError, setEditError] = useState<string | null>(null)

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
    setEditGuest({ name: guest.name, email: guest.email, phone: guest.phone, role: guest.role, side: guest.side ?? 'neutral' })
  }
  async function saveEdit(guest: GuestRow) {
    const name = editGuest.name.trim()
    const email = editGuest.email?.trim().toLowerCase() || null
    if (!name) { setEditError('Enter the guest name.'); return }
    if (email && !validEmail(email)) { setEditError('Enter a valid email address.'); return }
    const result = await onUpdateGuest(guest, { ...editGuest, name, email, phone: editGuest.phone?.trim() || null })
    if (result.success) {
      setEditingGuestId(null)
      setEditError(null)
    } else {
      setEditError(result.error ?? 'The guest could not be saved.')
    }
  }

  return <div className="space-y-4">
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">{[['Invited', guestStats.total], ['Confirmed', guestStats.confirmed], ['Declined', guestStats.declined], ['Pending', guestStats.pending], ['Plus-ones', guestStats.plusOnes], ['Kids', guestStats.kidsTotal], ['Heads', guestStats.heads], ['Checked-in', guestStats.checkedIn]].map(([label, value]) => <SectionCard key={String(label)} className="p-3 text-center"><p className="font-serif text-xl">{value}</p><p className="font-sans text-[9px] uppercase tracking-wider text-champagne/45">{label}</p></SectionCard>)}</div>

    <SectionCard className="p-4"><div className="mb-3"><h2 className="font-serif text-lg">Add guest</h2><p className="font-sans text-xs text-champagne/50">Create the invitation record and optionally assign an initial table.</p></div><form onSubmit={onAddGuest} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_1.25fr_auto]">
      <div><Label htmlFor="workspace-guest-name">Name</Label><Input id="workspace-guest-name" value={guestForm.name} onChange={(event) => setGuestForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
      <div><Label htmlFor="workspace-guest-email">Email</Label><Input id="workspace-guest-email" type="email" value={guestForm.email} onChange={(event) => setGuestForm((current) => ({ ...current, email: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
      <div><Label htmlFor="workspace-guest-phone">Phone</Label><Input id="workspace-guest-phone" value={guestForm.phone} onChange={(event) => setGuestForm((current) => ({ ...current, phone: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
      <div><Label htmlFor="workspace-guest-role">Role</Label><select id="workspace-guest-role" value={guestForm.role} onChange={(event) => setGuestForm((current) => ({ ...current, role: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{GUEST_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></div>
      <div><Label htmlFor="workspace-guest-side">Side</Label><select id="workspace-guest-side" value={guestForm.side} onChange={(event) => setGuestForm((current) => ({ ...current, side: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{GUEST_SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}</select></div>
      <div><Label htmlFor="workspace-guest-table">Table</Label><select id="workspace-guest-table" value={guestForm.seatingTableId} onChange={(event) => setGuestForm((current) => ({ ...current, seatingTableId: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Unassigned</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select></div>
      <Button type="submit" disabled={saving} className="self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button>
    </form></SectionCard>

    <SectionCard className="overflow-hidden">
      <div className="grid gap-3 border-b border-gold/10 p-4 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, email, phone, or table" className="border-gold/20 bg-espresso/70 pl-9" /></div><select value={filters.side} onChange={(event) => setFilters((current) => ({ ...current, side: event.target.value }))} aria-label="Filter guests by side" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All sides</option>{GUEST_SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}</select><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="Filter guests by RSVP" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All RSVP states</option><option value="confirmed">Confirmed</option><option value="declined">Declined</option><option value="pending">Pending</option></select><Button type="button" variant="outline" onClick={resetFilters} className="border-gold/20 bg-transparent text-champagne/60">Reset</Button></div>
      <div className="space-y-2 p-4">{guests.length === 0 ? <EmptyState title="No guests" detail="Add guests here or use the Guests worksheet import." /> : filteredGuests.length === 0 ? <EmptyState title="No guests in this view" detail="Clear the search or filters to see the remaining guest records." /> : filteredGuests.map((guest) => {
        const editing = editingGuestId === guest.id
        return <div key={guest.id} className="rounded-xl border border-gold/10 bg-espresso/45 p-3">
          {editing ? <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div><Label>Name</Label><Input aria-label={`Edit name for ${guest.name}`} value={editGuest.name} onChange={(event) => setEditGuest((current) => ({ ...current, name: event.target.value }))} aria-invalid={Boolean(editError && !editGuest.name.trim())} className="mt-1 border-gold/20 bg-espresso/70" /></div><div><Label>Email</Label><Input type="email" aria-label={`Edit email for ${guest.name}`} value={editGuest.email ?? ''} onChange={(event) => { setEditGuest((current) => ({ ...current, email: event.target.value })); setEditError(null) }} aria-invalid={Boolean(editError)} aria-describedby={editError ? `guest-edit-error-${guest.id}` : undefined} className="mt-1 border-gold/20 bg-espresso/70" /></div><div><Label>Phone</Label><Input aria-label={`Edit phone for ${guest.name}`} value={editGuest.phone ?? ''} onChange={(event) => setEditGuest((current) => ({ ...current, phone: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div><div><Label>Role</Label><select value={editGuest.role} aria-label={`Edit role for ${guest.name}`} onChange={(event) => setEditGuest((current) => ({ ...current, role: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{GUEST_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></div><div><Label>Side</Label><select value={editGuest.side} aria-label={`Edit side for ${guest.name}`} onChange={(event) => setEditGuest((current) => ({ ...current, side: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{GUEST_SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}</select></div></div>{editError && <p id={`guest-edit-error-${guest.id}`} role="alert" className="font-sans text-xs text-clay-light">{editError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditingGuestId(null)}><X className="size-4" />Cancel</Button><Button type="button" disabled={saving} onClick={() => void saveEdit(guest)} className="bg-gold text-espresso"><Check className="size-4" />Save guest</Button></div></div> : <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem_auto] md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-sans text-sm font-medium">{guest.name}</p><Badge variant="outline" className="border-gold/25 text-[10px] text-champagne/70">{titleCase(guest.role)}</Badge><Badge variant="outline" className="border-gold/25 text-[10px] text-champagne/70">{sideLabel(guest.side)}</Badge>{guest.rsvp?.attending === true ? <Badge className="bg-sage/15 text-sage-light"><CheckCircle2 className="mr-1 size-3" />Confirmed</Badge> : guest.rsvp?.attending === false ? <Badge variant="outline" className="border-clay/40 text-clay-light">Declined</Badge> : <Badge variant="outline" className="border-gold/20 text-champagne/55"><Circle className="mr-1 size-3" />Pending</Badge>}</div><p className="mt-1 truncate font-sans text-xs text-champagne/55">{guest.email || 'No email'} · {guest.phone || 'No phone'}</p>{guest.rsvp && <p className="mt-1 font-sans text-[11px] leading-5 text-champagne/45">Meal choice: {guest.rsvp.mealChoice || 'Not set'} · Plus-one name: {guest.rsvp.plusOneName || 'None'} · Dietary notes: {guest.rsvp.dietaryNotes || 'None'} · Checked in: {guest.rsvp.checkedIn ? 'Yes' : 'No'}</p>}</div><select value={guest.seatingTableId ?? ''} onChange={(event) => void onAssignGuestTable(guest, event.target.value || null)} aria-label={`Assign table for ${guest.name}`} className="h-9 rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs"><option value="">Unassigned</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${guest.name}`} disabled={saving} onClick={() => startEdit(guest)} className="size-9 text-champagne/50 hover:text-gold"><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${guest.name}`} disabled={saving} onClick={() => { if (window.confirm(`Delete guest “${guest.name}”?`)) void onDeleteGuest(guest) }} className="size-9 text-champagne/45 hover:bg-clay/10 hover:text-clay-light"><Trash2 className="size-4" /></Button></div></div>}
        </div>
      })}</div>
    </SectionCard>
  </div>
}
