'use client'

import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  LayoutGrid,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import type { GuestRow } from '@/components/wedding/planner/modules/planner-guests-module'
import { useToast } from '@/hooks/use-toast'
import {
  plannedSeatsForGuest,
  seatingTableTypeLabel,
  type SeatingTableType,
} from '@/lib/planner-seating-metadata'
import { usePlannerFilterState } from '@/lib/planner-filter-state'

export interface SeatingTableRow {
  id: string
  name: string
  capacity: number
  position: string | null
  tableType?: SeatingTableType
  zone?: string | null
  notes?: string | null
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

type TableStatus = 'available' | 'full' | 'over'
type OperationalTableForm = {
  name: string
  capacity: string
  tableType: SeatingTableType
  zone: string
  notes: string
}

const TYPE_OPTIONS: Array<{ value: SeatingTableType; label: string }> = [
  { value: 'high', label: 'High table' },
  { value: 'vip_parents', label: 'VIP — parents' },
  { value: 'vip_friends', label: 'VIP — friends' },
  { value: 'ordinary', label: 'Ordinary seating' },
  { value: 'other', label: 'Other' },
]
const TYPE_ORDER: Record<SeatingTableType, number> = {
  high: 0,
  vip_parents: 1,
  vip_friends: 2,
  ordinary: 3,
  other: 4,
}
const EMPTY_FORM: OperationalTableForm = {
  name: '',
  capacity: '10',
  tableType: 'ordinary',
  zone: '',
  notes: '',
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center"><p className="font-serif text-lg text-champagne">{title}</p><p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">{detail}</p></div>
}

async function seatingApi<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'The seating change could not be saved.')
  return payload
}

function statusFor(occupied: number, capacity: number): TableStatus {
  if (occupied > capacity) return 'over'
  if (occupied === capacity) return 'full'
  return 'available'
}

function statusLabel(status: TableStatus): string {
  if (status === 'over') return 'Over capacity'
  if (status === 'full') return 'Full'
  return 'Available'
}

function typeOf(table: SeatingTableRow): SeatingTableType {
  return table.tableType ?? 'ordinary'
}

export function PlannerSeatingModule(props: PlannerSeatingModuleProps) {
  const { toast } = useToast()
  const { tables, guests, saving, onAssignGuestToTable } = props
  const [viewTables, setViewTables] = useState(tables)
  const [viewGuests, setViewGuests] = useState(guests)
  const [operationPending, setOperationPending] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTable, setNewTable] = useState<OperationalTableForm>(EMPTY_FORM)
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editTable, setEditTable] = useState<OperationalTableForm>(EMPTY_FORM)
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set())
  const [bulkDestination, setBulkDestination] = useState('')
  const [filters, setFilters, resetFilters] = usePlannerFilterState('wewed:planner:seating:filters:v2', {
    search: '', assignment: 'all', capacity: 'all', occupancy: 'all', tableType: 'all',
  })

  useEffect(() => setViewTables(tables), [tables])
  useEffect(() => setViewGuests(guests), [guests])

  const busy = saving || operationPending
  const guestsByTable = useMemo(() => {
    const grouped = new Map<string, GuestRow[]>()
    for (const guest of viewGuests) {
      if (!guest.seatingTableId) continue
      grouped.set(guest.seatingTableId, [...(grouped.get(guest.seatingTableId) ?? []), guest])
    }
    return grouped
  }, [viewGuests])

  const occupancy = useMemo(() => {
    const counts = new Map<string, number>()
    for (const guest of viewGuests) {
      if (!guest.seatingTableId) continue
      counts.set(guest.seatingTableId, (counts.get(guest.seatingTableId) ?? 0) + plannedSeatsForGuest(guest))
    }
    return counts
  }, [viewGuests])

  const orderedTables = useMemo(() => [...viewTables].sort((a, b) => {
    const typeDifference = TYPE_ORDER[typeOf(a)] - TYPE_ORDER[typeOf(b)]
    if (typeDifference) return typeDifference
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  }), [viewTables])

  const query = filters.search.trim().toLowerCase()
  const unassignedGuests = useMemo(() => viewGuests.filter((guest) => {
    if (guest.seatingTableId) return false
    return !query || [guest.name, guest.email ?? '', guest.phone ?? ''].some((value) => value.toLowerCase().includes(query))
  }), [viewGuests, query])

  const filteredTables = useMemo(() => orderedTables.filter((table) => {
    const assigned = guestsByTable.get(table.id) ?? []
    const occupied = occupancy.get(table.id) ?? 0
    const status = statusFor(occupied, table.capacity)
    if (filters.assignment === 'assigned' && assigned.length === 0) return false
    if (filters.assignment === 'unassigned') return false
    if (filters.capacity === 'available' && status !== 'available') return false
    if (filters.capacity === 'full' && status === 'available') return false
    if (filters.occupancy === 'empty' && occupied !== 0) return false
    if (filters.occupancy === 'partial' && !(occupied > 0 && occupied < table.capacity)) return false
    if (filters.occupancy === 'full' && occupied !== table.capacity) return false
    if (filters.occupancy === 'over' && occupied <= table.capacity) return false
    if (filters.tableType !== 'all' && typeOf(table) !== filters.tableType) return false
    return !query || [table.name, table.zone ?? '', table.notes ?? '', seatingTableTypeLabel(typeOf(table))]
      .some((value) => value.toLowerCase().includes(query)) || assigned.some((guest) => guest.name.toLowerCase().includes(query))
  }), [orderedTables, guestsByTable, occupancy, filters, query])

  const totalCapacity = viewTables.reduce((sum, table) => sum + table.capacity, 0)
  const assignedHeads = viewGuests.reduce((sum, guest) => sum + (guest.seatingTableId ? plannedSeatsForGuest(guest) : 0), 0)
  const unassignedHeads = viewGuests.reduce((sum, guest) => sum + (!guest.seatingTableId ? plannedSeatsForGuest(guest) : 0), 0)
  const availableSeats = Math.max(0, totalCapacity - assignedHeads)
  const fullOrOverTables = viewTables.filter((table) => statusFor(occupancy.get(table.id) ?? 0, table.capacity) !== 'available').length
  const selectedGuests = viewGuests.filter((guest) => selectedGuestIds.has(guest.id))
  const selectedSeats = selectedGuests.reduce((sum, guest) => sum + plannedSeatsForGuest(guest), 0)

  function setGuestSelection(guestId: string, selected: boolean) {
    setSelectedGuestIds((current) => {
      const next = new Set(current)
      if (selected) next.add(guestId)
      else next.delete(guestId)
      return next
    })
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const capacity = Number(newTable.capacity)
    if (!newTable.name.trim() || !Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
      toast({ title: 'Check the table details', description: 'Enter a name and a whole-number capacity from 1 to 50.', variant: 'destructive' })
      return
    }
    setOperationPending(true)
    try {
      const payload = await seatingApi<{ data: SeatingTableRow }>('/api/planner/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'table',
          tableName: newTable.name.trim(),
          capacity,
          tableType: newTable.tableType,
          zone: newTable.zone.trim() || null,
          notes: newTable.notes.trim() || null,
        }),
      })
      setViewTables((current) => [...current, payload.data])
      setNewTable(EMPTY_FORM)
      setShowAddForm(false)
      toast({ title: 'Seating table added' })
    } catch (error) {
      toast({ title: 'Table creation failed', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setOperationPending(false)
    }
  }

  function startTableEdit(table: SeatingTableRow) {
    setEditingTableId(table.id)
    setEditTable({
      name: table.name,
      capacity: String(table.capacity),
      tableType: typeOf(table),
      zone: table.zone ?? '',
      notes: table.notes ?? '',
    })
  }

  async function saveTable(table: SeatingTableRow) {
    const capacity = Number(editTable.capacity)
    if (!editTable.name.trim() || !Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
      toast({ title: 'Check the table details', description: 'Enter a name and a whole-number capacity from 1 to 50.', variant: 'destructive' })
      return
    }
    setOperationPending(true)
    try {
      const payload = await seatingApi<{ data: SeatingTableRow }>(`/api/planner/guests/${table.id}?kind=table`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTable.name.trim(),
          capacity,
          tableType: editTable.tableType,
          zone: editTable.zone.trim() || null,
          notes: editTable.notes.trim() || null,
        }),
      })
      setViewTables((current) => current.map((candidate) => candidate.id === table.id ? payload.data : candidate))
      setEditingTableId(null)
      toast({ title: 'Seating table updated' })
    } catch (error) {
      toast({ title: 'Table update failed', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setOperationPending(false)
    }
  }

  async function deleteTable(table: SeatingTableRow) {
    const assigned = guestsByTable.get(table.id) ?? []
    const consequence = assigned.length ? ` ${assigned.length} assigned guest record${assigned.length === 1 ? '' : 's'} will become unassigned.` : ''
    if (!window.confirm(`Delete table “${table.name}”?${consequence}`)) return
    setOperationPending(true)
    try {
      await seatingApi(`/api/planner/guests/${table.id}?kind=table`, { method: 'DELETE' })
      setViewTables((current) => current.filter((candidate) => candidate.id !== table.id))
      setViewGuests((current) => current.map((guest) => guest.seatingTableId === table.id
        ? { ...guest, seatingTableId: null, seatingTableName: null }
        : guest))
      setSelectedGuestIds(new Set())
      toast({ title: 'Seating table removed', description: assigned.length ? 'Assigned Guests were safely returned to the unassigned list.' : undefined })
    } catch (error) {
      toast({ title: 'Table deletion failed', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setOperationPending(false)
    }
  }

  async function assignOneGuest(guest: GuestRow, tableId: string | null) {
    const success = await onAssignGuestToTable(guest, tableId)
    if (!success) return
    const tableName = viewTables.find((table) => table.id === tableId)?.name ?? null
    setViewGuests((current) => current.map((candidate) => candidate.id === guest.id
      ? { ...candidate, seatingTableId: tableId, seatingTableName: tableName }
      : candidate))
  }

  async function moveSelectedGuests() {
    if (!selectedGuestIds.size) return
    const destination = bulkDestination || null
    setOperationPending(true)
    try {
      const payload = await seatingApi<{ data: GuestRow[] }>('/api/planner/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'bulk_assignment',
          guestIds: [...selectedGuestIds],
          seatingTableId: destination,
        }),
      })
      const replacements = new Map(payload.data.map((guest) => [guest.id, guest]))
      setViewGuests((current) => current.map((guest) => replacements.get(guest.id) ?? guest))
      setSelectedGuestIds(new Set())
      setBulkDestination('')
      toast({ title: destination ? 'Selected Guests moved' : 'Selected Guests unassigned', description: `${payload.data.length} guest record${payload.data.length === 1 ? '' : 's'} updated.` })
    } catch (error) {
      toast({ title: 'Bulk seating move failed', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setOperationPending(false)
    }
  }

  function printSeatingPlan() {
    const printWindow = window.open('', '_blank', 'width=1100,height=900')
    if (!printWindow) {
      toast({ title: 'Pop-up blocked', variant: 'destructive' })
      return
    }
    const tableRows = orderedTables.map((table) => {
      const assigned = guestsByTable.get(table.id) ?? []
      const occupied = occupancy.get(table.id) ?? 0
      return `<section><h2>${table.name}</h2><p>${seatingTableTypeLabel(typeOf(table))} · ${table.zone || 'Zone not set'} · ${occupied}/${table.capacity} seats</p><ul>${assigned.map((guest) => `<li>${guest.name} (${plannedSeatsForGuest(guest)} seat${plannedSeatsForGuest(guest) === 1 ? '' : 's'})</li>`).join('') || '<li>No Guests assigned</li>'}</ul></section>`
    }).join('')
    printWindow.document.write(`<!doctype html><html><head><title>Imba Manor Seating Plan</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#1f1a16}header{border-bottom:2px solid #9b7b42;margin-bottom:20px}section{break-inside:avoid;border:1px solid #d8cec0;border-radius:12px;padding:14px;margin:10px 0}h1,h2{font-family:Georgia,serif}h2{margin:0 0 4px}p,li{font-size:12px;line-height:1.5}.summary{display:flex;gap:18px;flex-wrap:wrap}</style></head><body><header><h1>Imba Manor Seating Plan</h1><div class="summary"><p>${viewTables.length} tables</p><p>${totalCapacity} planned seats</p><p>${assignedHeads} assigned seats</p><p>${unassignedHeads} unassigned seats</p></div></header>${tableRows}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return <div className="space-y-4" data-seating-operations>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {[
        ['Tables', viewTables.length, 'Configured room plan'],
        ['Capacity', totalCapacity, 'Total planned seats'],
        ['Assigned', assignedHeads, 'Seats placed'],
        ['Available', availableSeats, 'Open seats'],
        ['Unassigned', unassignedHeads, 'Seats to place'],
        ['Full / red', fullOrOverTables, 'Tables needing attention'],
      ].map(([label, value, detail]) => <SectionCard key={String(label)} className="p-3 text-center"><p className="font-serif text-2xl">{value}</p><p className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-gold/70">{label}</p><p className="mt-1 hidden font-sans text-[9px] text-champagne/35 sm:block">{detail}</p></SectionCard>)}
    </div>

    <SectionCard className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><h2 className="font-serif text-xl">Live seating operations</h2><p className="mt-1 font-sans text-xs text-champagne/45">Green tables have capacity. Red tables are full or over capacity. Move Guests individually or in a selected group.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={printSeatingPlan} className="border-gold/20 bg-transparent text-champagne/70"><Printer className="size-4" />Print plan</Button><Button type="button" onClick={() => setShowAddForm((current) => !current)} className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add table{showAddForm ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</Button></div>
      </div>
      {showAddForm && <form onSubmit={createTable} className="grid gap-3 border-t border-gold/10 p-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_12rem_7rem_1fr_1.4fr_auto]">
        <div><Label htmlFor="seating-new-name">Table name</Label><Input id="seating-new-name" value={newTable.name} onChange={(event) => setNewTable((current) => ({ ...current, name: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="Ordinary Table 01" /></div>
        <div><Label htmlFor="seating-new-type">Table type</Label><select id="seating-new-type" value={newTable.tableType} onChange={(event) => setNewTable((current) => ({ ...current, tableType: event.target.value as SeatingTableType }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div><Label htmlFor="seating-new-capacity">Seats</Label><Input id="seating-new-capacity" type="number" min="1" max="50" step="1" value={newTable.capacity} onChange={(event) => setNewTable((current) => ({ ...current, capacity: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
        <div><Label htmlFor="seating-new-zone">Zone / position</Label><Input id="seating-new-zone" value={newTable.zone} onChange={(event) => setNewTable((current) => ({ ...current, zone: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="Front left" /></div>
        <div><Label htmlFor="seating-new-notes">Operational notes</Label><Input id="seating-new-notes" value={newTable.notes} onChange={(event) => setNewTable((current) => ({ ...current, notes: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="Parents and guardians" /></div>
        <Button type="submit" disabled={busy} className="min-h-10 self-end bg-gold text-espresso">Create</Button>
      </form>}
    </SectionCard>

    <SectionCard className="p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_11rem_11rem_11rem_12rem_auto]">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search table, zone, note, or Guest" className="border-gold/20 bg-espresso/70 pl-9" /></div>
        <select value={filters.tableType} onChange={(event) => setFilters((current) => ({ ...current, tableType: event.target.value }))} aria-label="Filter seating by table type" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All table types</option>{TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <select value={filters.assignment} onChange={(event) => setFilters((current) => ({ ...current, assignment: event.target.value, ...(event.target.value === 'unassigned' ? { capacity: 'all', occupancy: 'all' } : {}) }))} aria-label="Filter seating by assignment" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All assignments</option><option value="assigned">Tables with Guests</option><option value="unassigned">Unassigned Guests</option></select>
        <select value={filters.capacity} disabled={filters.assignment === 'unassigned'} onChange={(event) => setFilters((current) => ({ ...current, capacity: event.target.value }))} aria-label="Filter seating by capacity" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm disabled:opacity-45"><option value="all">Any capacity</option><option value="available">Green / available</option><option value="full">Red / full</option></select>
        <select value={filters.occupancy} disabled={filters.assignment === 'unassigned'} onChange={(event) => setFilters((current) => ({ ...current, occupancy: event.target.value }))} aria-label="Filter seating by occupancy" className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm disabled:opacity-45"><option value="all">Any occupancy</option><option value="empty">Empty</option><option value="partial">Partially occupied</option><option value="full">Exactly full</option><option value="over">Over capacity</option></select>
        <Button type="button" variant="outline" onClick={resetFilters} className="border-gold/20 bg-transparent text-champagne/60">Reset</Button>
      </div>
    </SectionCard>

    {selectedGuestIds.size > 0 && <SectionCard className="sticky top-0 z-20 border-gold/30 bg-espresso/98 p-3 shadow-xl" data-seating-bulk-bar>
      <div className="flex flex-wrap items-center gap-3"><div className="mr-auto"><p className="font-sans text-sm text-champagne">{selectedGuestIds.size} guest record{selectedGuestIds.size === 1 ? '' : 's'} selected</p><p className="font-sans text-[10px] text-champagne/45">{selectedSeats} planned seat{selectedSeats === 1 ? '' : 's'}</p></div><select aria-label="Bulk seating destination" value={bulkDestination} onChange={(event) => setBulkDestination(event.target.value)} className="h-10 min-w-[14rem] rounded-md border border-gold/25 bg-espresso px-3 text-sm"><option value="">Unassign selected Guests</option>{orderedTables.map((table) => { const occupied = occupancy.get(table.id) ?? 0; const selectedAlreadyHere = selectedGuests.filter((guest) => guest.seatingTableId === table.id).reduce((sum, guest) => sum + plannedSeatsForGuest(guest), 0); const available = table.capacity - occupied + selectedAlreadyHere; return <option key={table.id} value={table.id} disabled={available < selectedSeats}>{table.name} ({Math.max(0, available)} available){available < selectedSeats ? ' — insufficient capacity' : ''}</option> })}</select><Button type="button" disabled={busy} onClick={() => void moveSelectedGuests()} className="bg-gold text-espresso"><UsersRound className="size-4" />Move selected</Button><Button type="button" variant="ghost" onClick={() => setSelectedGuestIds(new Set())}><X className="size-4" />Clear</Button></div>
    </SectionCard>}

    {filters.assignment !== 'assigned' && filters.capacity === 'all' && filters.occupancy === 'all' && unassignedGuests.length > 0 && <SectionCard className="p-4">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-serif text-lg">Unassigned Guests</h3><p className="mt-1 font-sans text-xs text-champagne/45">Select several parties to place them together. Tables without enough capacity are disabled.</p></div><Badge variant="outline" className="border-clay/35 text-clay-light">{unassignedHeads} seats to place</Badge></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{unassignedGuests.map((guest) => <div key={guest.id} className="flex items-center gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3"><input type="checkbox" aria-label={`Select guest ${guest.name}`} checked={selectedGuestIds.has(guest.id)} readOnly onClick={(event) => setGuestSelection(guest.id, event.currentTarget.checked)} className="size-4 accent-[#bf9b5f]" /><div className="min-w-0 flex-1"><p className="truncate font-sans text-sm">{guest.name}</p><p className="font-sans text-[10px] text-champagne/40">{plannedSeatsForGuest(guest)} planned seat{plannedSeatsForGuest(guest) === 1 ? '' : 's'}</p></div><select value="" aria-label={`Assign guest ${guest.name}`} disabled={busy} onChange={(event) => { if (event.target.value) void assignOneGuest(guest, event.target.value) }} className="h-9 max-w-[11rem] rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs text-gold"><option value="">Assign</option>{orderedTables.map((table) => { const occupied = occupancy.get(table.id) ?? 0; const full = occupied + plannedSeatsForGuest(guest) > table.capacity; return <option key={table.id} value={table.id} disabled={full}>{table.name} ({occupied}/{table.capacity}){full ? ' — full' : ''}</option> })}</select></div>)}</div>
    </SectionCard>}

    {filters.assignment === 'unassigned' ? (unassignedGuests.length ? null : <EmptyState title="No unassigned Guests" detail="Clear the search or assignment filter to review the seating chart." />) : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {viewTables.length === 0 ? <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No seating tables" detail="Create the high table, VIP tables, and ordinary room layout before assigning Guests." /></div> : filteredTables.length === 0 ? <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No seating results" detail="Clear or adjust the filters. Seating data has not been changed." /></div> : filteredTables.map((table) => {
        const occupied = occupancy.get(table.id) ?? 0
        const assignedGuests = guestsByTable.get(table.id) ?? []
        const status = statusFor(occupied, table.capacity)
        const editing = editingTableId === table.id
        const available = Math.max(0, table.capacity - occupied)
        const statusClasses = status === 'available'
          ? 'border-emerald-400/35 bg-emerald-500/[0.045]'
          : 'border-red-400/40 bg-red-500/[0.055]'
        const badgeClasses = status === 'available'
          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
          : 'border-red-400/45 bg-red-500/10 text-red-300'
        const progressClasses = status === 'available' ? '[&>div]:bg-emerald-400' : '[&>div]:bg-red-400'
        return <SectionCard key={table.id} className={`p-4 ${statusClasses}`}>
          <article data-seating-table-id={table.id} data-seating-status={status} data-seating-type={typeOf(table)}>
            {editing ? <div className="space-y-3"><div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2"><div><Label htmlFor={`seating-edit-name-${table.id}`}>Table name</Label><Input id={`seating-edit-name-${table.id}`} value={editTable.name} onChange={(event) => setEditTable((current) => ({ ...current, name: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div><div><Label htmlFor={`seating-edit-capacity-${table.id}`}>Seats</Label><Input id={`seating-edit-capacity-${table.id}`} type="number" min="1" max="50" step="1" value={editTable.capacity} onChange={(event) => setEditTable((current) => ({ ...current, capacity: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div></div><div className="grid gap-2 sm:grid-cols-2"><div><Label htmlFor={`seating-edit-type-${table.id}`}>Table type</Label><select id={`seating-edit-type-${table.id}`} value={editTable.tableType} onChange={(event) => setEditTable((current) => ({ ...current, tableType: event.target.value as SeatingTableType }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div><Label htmlFor={`seating-edit-zone-${table.id}`}>Zone / position</Label><Input id={`seating-edit-zone-${table.id}`} value={editTable.zone} onChange={(event) => setEditTable((current) => ({ ...current, zone: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div></div><div><Label htmlFor={`seating-edit-notes-${table.id}`}>Operational notes</Label><Input id={`seating-edit-notes-${table.id}`} value={editTable.notes} onChange={(event) => setEditTable((current) => ({ ...current, notes: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditingTableId(null)}><X className="size-4" />Cancel</Button><Button type="button" disabled={busy} onClick={() => void saveTable(table)} className="bg-gold text-espresso"><CheckCircle2 className="size-4" />Save table</Button></div></div> : <><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-serif text-xl">{table.name}</h3><Badge variant="outline" className="border-gold/25 text-gold">{seatingTableTypeLabel(typeOf(table))}</Badge></div><p className="mt-1 font-sans text-xs text-champagne/50">{table.zone || 'Zone not set'}</p>{table.notes && <p className="mt-2 font-sans text-xs leading-5 text-champagne/60">{table.notes}</p>}</div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${table.name}`} disabled={busy} onClick={() => startTableEdit(table)} className="size-10 text-champagne/50 hover:text-gold"><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${table.name}`} disabled={busy} onClick={() => void deleteTable(table)} className="size-10 text-champagne/50 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="size-4" /></Button></div></div>
            <div className="mt-3 flex items-center justify-between gap-3"><Badge variant="outline" className={badgeClasses}>{status === 'available' ? <UserRoundCheck className="mr-1 size-3" /> : <CircleAlert className="mr-1 size-3" />}{statusLabel(status)} · {occupied}/{table.capacity}</Badge><span className="font-sans text-[10px] uppercase tracking-wider text-champagne/45">{status === 'available' ? `${available} open` : statusLabel(status)}</span></div><Progress value={Math.min(100, table.capacity ? (occupied / table.capacity) * 100 : 0)} className={`mt-2 h-2 bg-champagne/10 ${progressClasses}`} />
            <div className="mt-3 space-y-2">{assignedGuests.length === 0 ? <p className="font-sans text-xs italic text-champagne/40">No Guests assigned</p> : assignedGuests.map((guest) => <div key={guest.id} className="flex items-center gap-2 rounded-lg border border-gold/10 bg-espresso/45 px-3 py-2"><input type="checkbox" aria-label={`Select guest ${guest.name}`} checked={selectedGuestIds.has(guest.id)} readOnly onClick={(event) => setGuestSelection(guest.id, event.currentTarget.checked)} className="size-4 accent-[#bf9b5f]" /><div className="min-w-0 flex-1"><p className="truncate font-sans text-xs">{guest.name}</p><p className="font-sans text-[9px] text-champagne/35">{plannedSeatsForGuest(guest)} planned seat{plannedSeatsForGuest(guest) === 1 ? '' : 's'}</p></div><Button type="button" variant="ghost" size="sm" aria-label={`Unassign guest ${guest.name}`} disabled={busy} onClick={() => void assignOneGuest(guest, null)} className="min-h-9 px-2 text-[10px] text-champagne/45 hover:text-red-300"><X className="size-3" />Unassign</Button></div>)}</div>
            {unassignedGuests.length > 0 && status === 'available' && <div className="mt-3 flex items-center gap-2"><LayoutGrid className="size-4 text-gold" /><select value="" aria-label={`Assign guest to ${table.name}`} disabled={busy} onChange={(event) => { const guest = unassignedGuests.find((candidate) => candidate.id === event.target.value); if (guest) void assignOneGuest(guest, table.id) }} className="h-9 min-w-0 flex-1 rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs text-gold"><option value="">Assign a Guest</option>{unassignedGuests.map((guest) => <option key={guest.id} value={guest.id} disabled={occupied + plannedSeatsForGuest(guest) > table.capacity}>{guest.name}{occupied + plannedSeatsForGuest(guest) > table.capacity ? ' — no capacity' : ''}</option>)}</select></div>}</>}
          </article>
        </SectionCard>
      })}
    </div>}
  </div>
}
