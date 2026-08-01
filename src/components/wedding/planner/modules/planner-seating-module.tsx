'use client'

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { CheckCircle2, Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import type { GuestRow } from '@/components/wedding/planner/modules/planner-guests-module'
import { usePlannerFilterState } from '@/lib/planner-filter-state'

export interface SeatingTableRow {
  id: string
  name: string
  capacity: number
  position: string | null
}

interface TableForm { name: string; capacity: string }
interface TableUpdate { name: string; capacity: number }
interface PlannerSeatingModuleProps {
  tables: SeatingTableRow[]
  guests: GuestRow[]
  tableForm: TableForm
  setTableForm: Dispatch<SetStateAction<TableForm>>
  tableOccupancy: Map<string, number>
  saving: boolean
  onAddTable: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onUpdateTable: (table: SeatingTableRow, updates: TableUpdate) => Promise<boolean>
  onDeleteTable: (table: SeatingTableRow) => Promise<boolean>
  onAssignGuestToTable: (guest: GuestRow, tableId: string | null) => Promise<boolean>
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section>
}
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center"><p className="font-serif text-lg text-champagne">{title}</p><p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">{detail}</p></div>
}
function partySize(guest: GuestRow): number {
  return 1 + (guest.rsvp?.plusOne ? 1 : 0) + (guest.rsvp?.kidsAttending ? guest.rsvp.kidsCount : 0)
}

export function PlannerSeatingModule({ tables, guests, tableForm, setTableForm, tableOccupancy, saving, onAddTable, onUpdateTable, onDeleteTable, onAssignGuestToTable }: PlannerSeatingModuleProps) {
  const [filters, setFilters, resetFilters] = usePlannerFilterState('wewed:planner:seating:filters', {
    search: '', assignment: 'all', capacity: 'all', occupancy: 'all',
  })
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editTable, setEditTable] = useState<TableForm>({ name: '', capacity: '8' })

  const guestsByTable = useMemo(() => {
    const grouped = new Map<string, GuestRow[]>()
    for (const guest of guests) {
      if (!guest.seatingTableId) continue
      grouped.set(guest.seatingTableId, [...(grouped.get(guest.seatingTableId) ?? []), guest])
    }
    return grouped
  }, [guests])

  const assignedOccupancy = useMemo(() => {
    const counts = new Map<string, number>()
    for (const guest of guests) {
      if (!guest.seatingTableId) continue
      counts.set(guest.seatingTableId, (counts.get(guest.seatingTableId) ?? 0) + partySize(guest))
    }
    return counts
  }, [guests])

  const occupancyFor = (tableId: string) => Math.max(tableOccupancy.get(tableId) ?? 0, assignedOccupancy.get(tableId) ?? 0)
  const query = filters.search.trim().toLowerCase()
  const unassignedGuests = useMemo(() => guests.filter((guest) => !guest.seatingTableId && (!query || [guest.name, guest.email ?? '', guest.phone ?? ''].some((value) => value.toLowerCase().includes(query)))), [guests, query])

  const filteredTables = useMemo(() => tables.filter((table) => {
    const assigned = guestsByTable.get(table.id) ?? []
    const occupied = occupancyFor(table.id)
    const isFull = occupied >= table.capacity
    if (filters.assignment === 'assigned' && assigned.length === 0) return false
    if (filters.assignment === 'unassigned') return false
    if (filters.capacity === 'available' && isFull) return false
    if (filters.capacity === 'full' && !isFull) return false
    if (filters.occupancy === 'empty' && occupied !== 0) return false
    if (filters.occupancy === 'partial' && !(occupied > 0 && occupied < table.capacity)) return false
    if (filters.occupancy === 'full' && occupied !== table.capacity) return false
    if (filters.occupancy === 'over' && occupied <= table.capacity) return false
    return !query || table.name.toLowerCase().includes(query) || assigned.some((guest) => guest.name.toLowerCase().includes(query))
  }), [tables, guestsByTable, filters, query, tableOccupancy, assignedOccupancy])

  const showUnassigned = filters.assignment !== 'assigned' && filters.capacity === 'all' && filters.occupancy === 'all'

  function startTableEdit(table: SeatingTableRow) {
    setEditingTableId(table.id)
    setEditTable({ name: table.name, capacity: String(table.capacity) })
  }
  async function saveTable(table: SeatingTableRow) {
    const capacity = Number(editTable.capacity)
    if (!editTable.name.trim() || !Number.isFinite(capacity) || capacity <= 0) return
    if (await onUpdateTable(table, { name: editTable.name.trim(), capacity: Math.min(50, Math.floor(capacity)) })) setEditingTableId(null)
  }

  return <div className="space-y-4">
    <SectionCard className="p-4">
      <div className="mb-3"><h2 className="font-serif text-lg">Seating chart</h2><p className="font-sans text-xs text-champagne/45">{tables.length} table{tables.length === 1 ? '' : 's'} · {guests.filter((guest) => !guest.seatingTableId).length} unassigned guest{guests.filter((guest) => !guest.seatingTableId).length === 1 ? '' : 's'}</p></div>
      <form onSubmit={onAddTable} className="grid gap-3 md:grid-cols-[2fr_9rem_auto]">
        <div><Label htmlFor="workspace-new-table-name">Table name</Label><Input id="workspace-new-table-name" value={tableForm.name} onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="Family Table 1" /></div>
        <div><Label htmlFor="workspace-new-table-capacity">Capacity</Label><Input id="workspace-new-table-capacity" type="number" min="1" max="50" value={tableForm.capacity} onChange={(event) => setTableForm((current) => ({ ...current, capacity: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
        <Button type="submit" disabled={saving} className="min-h-11 self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add table</Button>
      </form>
    </SectionCard>

    <SectionCard className="p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_12rem_12rem_12rem_auto]">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search table or guest" className="border-gold/20 bg-espresso/70 pl-9" /></div>
        <select value={filters.assignment} onChange={(event) => setFilters((current) => ({ ...current, assignment: event.target.value, ...(event.target.value === 'unassigned' ? { capacity: 'all', occupancy: 'all' } : {}) }))} aria-label="Filter seating by assignment" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All assignments</option><option value="assigned">Tables with guests</option><option value="unassigned">Unassigned guests</option></select>
        <select value={filters.capacity} disabled={filters.assignment === 'unassigned'} onChange={(event) => setFilters((current) => ({ ...current, capacity: event.target.value }))} aria-label="Filter seating by capacity" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm disabled:opacity-45"><option value="all">Any capacity</option><option value="available">Available</option><option value="full">Full / over</option></select>
        <select value={filters.occupancy} disabled={filters.assignment === 'unassigned'} onChange={(event) => setFilters((current) => ({ ...current, occupancy: event.target.value }))} aria-label="Filter seating by occupancy" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm disabled:opacity-45"><option value="all">Any occupancy</option><option value="empty">Empty</option><option value="partial">Partially occupied</option><option value="full">Exactly full</option><option value="over">Over capacity</option></select>
        <Button type="button" variant="outline" onClick={resetFilters} className="border-gold/20 bg-transparent text-champagne/60">Reset</Button>
      </div>
    </SectionCard>

    {showUnassigned && unassignedGuests.length > 0 && <SectionCard className="p-4">
      <h3 className="font-serif text-lg">Unassigned guests</h3><p className="mt-1 font-sans text-xs text-champagne/45">Assign guest records directly to a table. Full tables are unavailable.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{unassignedGuests.map((guest) => <div key={guest.id} className="flex items-center justify-between gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3"><div className="min-w-0"><p className="truncate font-sans text-sm">{guest.name}</p><p className="font-sans text-[10px] text-champagne/40">{partySize(guest)} planned seat{partySize(guest) === 1 ? '' : 's'}</p></div><select value="" aria-label={`Assign guest ${guest.name}`} onChange={(event) => { if (event.target.value) void onAssignGuestToTable(guest, event.target.value) }} className="h-9 max-w-[11rem] rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs text-gold"><option value="">Assign guest</option>{tables.map((table) => { const occupied = occupancyFor(table.id); const full = occupied + partySize(guest) > table.capacity; return <option key={table.id} value={table.id} disabled={full}>{table.name} ({occupied}/{table.capacity}){full ? ' — full' : ''}</option> })}</select></div>)}</div>
    </SectionCard>}

    {filters.assignment === 'unassigned' ? (unassignedGuests.length ? null : <EmptyState title="No unassigned guests" detail="Clear the search or assignment filter to review the seating chart." />) : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {tables.length === 0 ? <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No seating tables" detail="Create tables here, then assign confirmed guests." /></div> : filteredTables.length === 0 ? <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No seating results" detail="Clear or adjust the filters. Assignments have not been changed." /></div> : filteredTables.map((table) => {
        const occupied = occupancyFor(table.id)
        const assignedGuests = guestsByTable.get(table.id) ?? []
        const overCapacity = occupied > table.capacity
        const isEditing = editingTableId === table.id
        return <SectionCard key={table.id} className="p-4">
          <div className="flex items-start justify-between gap-3">{isEditing ? <div className="grid flex-1 grid-cols-[minmax(0,1fr)_6rem] gap-2"><div><Label htmlFor={`workspace-table-name-${table.id}`}>Table name</Label><Input id={`workspace-table-name-${table.id}`} value={editTable.name} onChange={(event) => setEditTable((current) => ({ ...current, name: event.target.value }))} className="mt-1 h-9 border-gold/20 bg-espresso/70 text-xs" /></div><div><Label htmlFor={`workspace-table-capacity-${table.id}`}>Capacity</Label><Input id={`workspace-table-capacity-${table.id}`} type="number" min="1" max="50" value={editTable.capacity} onChange={(event) => setEditTable((current) => ({ ...current, capacity: event.target.value }))} className="mt-1 h-9 border-gold/20 bg-espresso/70 text-xs" /></div></div> : <div><h3 className="font-serif text-lg">{table.name}</h3><p className="font-sans text-xs text-champagne/45">{table.position || 'Position not set'}</p></div>}
          <div className="flex items-center gap-1">{isEditing ? <><Button type="button" variant="ghost" size="icon" aria-label={`Save ${table.name}`} disabled={saving} onClick={() => void saveTable(table)} className="size-10 text-sage-light"><CheckCircle2 className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Cancel editing ${table.name}`} onClick={() => setEditingTableId(null)} className="size-10 text-champagne/45"><X className="size-4" /></Button></> : <><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${table.name}`} disabled={saving} onClick={() => startTableEdit(table)} className="size-10 text-champagne/45 hover:text-gold"><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${table.name}`} disabled={saving} onClick={() => { const consequence = assignedGuests.length ? ` ${assignedGuests.length} assigned guest record${assignedGuests.length === 1 ? '' : 's'} will become unassigned.` : ''; if (window.confirm(`Delete table “${table.name}”?${consequence}`)) void onDeleteTable(table) }} className="size-10 text-champagne/45 hover:bg-clay/10 hover:text-clay-light"><Trash2 className="size-4" /></Button></>}</div></div>
          <div className="mt-3 flex items-center justify-between gap-3"><Badge variant="outline" className={overCapacity ? 'border-clay/40 text-clay-light' : 'border-gold/20 text-gold'}>{occupied}/{table.capacity} seats</Badge>{overCapacity && <span className="font-sans text-[10px] uppercase tracking-wider text-clay-light">Over capacity</span>}</div><Progress value={Math.min(100, table.capacity ? (occupied / table.capacity) * 100 : 0)} className="mt-2 h-1.5 bg-champagne/10 [&>div]:bg-gold" />
          <div className="mt-3 space-y-2">{assignedGuests.length === 0 ? <p className="font-sans text-xs italic text-champagne/40">No guests assigned</p> : assignedGuests.map((guest) => <div key={guest.id} className="flex items-center justify-between gap-2 rounded-lg border border-gold/10 bg-espresso/45 px-3 py-2"><div className="min-w-0"><p className="truncate font-sans text-xs">{guest.name}</p><p className="font-sans text-[9px] text-champagne/35">{partySize(guest)} planned seat{partySize(guest) === 1 ? '' : 's'}</p></div><Button type="button" variant="ghost" size="sm" aria-label={`Unassign guest ${guest.name}`} disabled={saving} onClick={() => void onAssignGuestToTable(guest, null)} className="min-h-9 px-2 text-[10px] text-champagne/45 hover:text-clay-light"><X className="size-3" />Unassign</Button></div>)}</div>
          {unassignedGuests.length > 0 && occupied < table.capacity && <div className="mt-3 flex items-center gap-2"><UserPlus className="size-4 text-gold" /><select value="" aria-label={`Assign guest to ${table.name}`} onChange={(event) => { const guest = unassignedGuests.find((candidate) => candidate.id === event.target.value); if (guest) void onAssignGuestToTable(guest, table.id) }} className="h-9 min-w-0 flex-1 rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs text-gold"><option value="">Assign guest</option>{unassignedGuests.map((guest) => <option key={guest.id} value={guest.id} disabled={occupied + partySize(guest) > table.capacity}>{guest.name}{occupied + partySize(guest) > table.capacity ? ' — no capacity' : ''}</option>)}</select></div>}
        </SectionCard>
      })}
    </div>}
  </div>
}
