'use client'

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { CheckCircle2, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import type { GuestRow } from '@/components/wedding/planner/modules/planner-guests-module'

export interface SeatingTableRow {
  id: string
  name: string
  capacity: number
  position: string | null
}

interface TableForm {
  name: string
  capacity: string
}

interface TableUpdate {
  name: string
  capacity: number
}

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

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>
      {children}
    </section>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center">
      <p className="font-serif text-lg text-champagne">{title}</p>
      <p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">
        {detail}
      </p>
    </div>
  )
}

function partySize(guest: GuestRow): number {
  return (
    1 +
    (guest.rsvp?.plusOne ? 1 : 0) +
    (guest.rsvp?.kidsAttending ? guest.rsvp.kidsCount : 0)
  )
}

export function PlannerSeatingModule({
  tables,
  guests,
  tableForm,
  setTableForm,
  tableOccupancy,
  saving,
  onAddTable,
  onUpdateTable,
  onDeleteTable,
  onAssignGuestToTable,
}: PlannerSeatingModuleProps) {
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editTable, setEditTable] = useState<TableForm>({ name: '', capacity: '8' })

  const guestsByTable = useMemo(() => {
    const grouped = new Map<string, GuestRow[]>()
    for (const guest of guests) {
      if (!guest.seatingTableId) continue
      const current = grouped.get(guest.seatingTableId) ?? []
      current.push(guest)
      grouped.set(guest.seatingTableId, current)
    }
    return grouped
  }, [guests])

  const assignedOccupancy = useMemo(() => {
    const counts = new Map<string, number>()
    for (const guest of guests) {
      if (!guest.seatingTableId) continue
      counts.set(
        guest.seatingTableId,
        (counts.get(guest.seatingTableId) ?? 0) + partySize(guest),
      )
    }
    return counts
  }, [guests])

  const occupancyFor = (tableId: string) =>
    Math.max(tableOccupancy.get(tableId) ?? 0, assignedOccupancy.get(tableId) ?? 0)

  const unassignedGuests = useMemo(
    () => guests.filter((guest) => !guest.seatingTableId),
    [guests],
  )

  function startTableEdit(table: SeatingTableRow) {
    setEditingTableId(table.id)
    setEditTable({ name: table.name, capacity: String(table.capacity) })
  }

  async function saveTable(table: SeatingTableRow) {
    const capacity = Number(editTable.capacity)
    if (!editTable.name.trim() || !Number.isFinite(capacity) || capacity <= 0) return
    const succeeded = await onUpdateTable(table, {
      name: editTable.name.trim(),
      capacity: Math.min(50, Math.floor(capacity)),
    })
    if (succeeded) setEditingTableId(null)
  }

  return (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg">Seating chart</h2>
            <p className="font-sans text-xs text-champagne/45">
              {tables.length} table{tables.length === 1 ? '' : 's'} ·{' '}
              {unassignedGuests.length} unassigned guest
              {unassignedGuests.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <form onSubmit={onAddTable} className="grid gap-3 md:grid-cols-[2fr_9rem_auto]">
          <div>
            <Label htmlFor="workspace-new-table-name">Table name</Label>
            <Input
              id="workspace-new-table-name"
              value={tableForm.name}
              onChange={(event) =>
                setTableForm((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
              placeholder="Family Table 1"
            />
          </div>
          <div>
            <Label htmlFor="workspace-new-table-capacity">Capacity</Label>
            <Input
              id="workspace-new-table-capacity"
              type="number"
              min="1"
              max="50"
              value={tableForm.capacity}
              onChange={(event) =>
                setTableForm((current) => ({ ...current, capacity: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="self-end bg-gold text-espresso hover:bg-gold-light"
          >
            <Plus className="size-4" />
            Add table
          </Button>
        </form>
      </SectionCard>

      {unassignedGuests.length > 0 && tables.length > 0 && (
        <SectionCard className="p-4">
          <h3 className="font-serif text-lg">Unassigned guests</h3>
          <p className="mt-1 font-sans text-xs text-champagne/45">
            Assign guest records directly to a table. Full tables are unavailable.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {unassignedGuests.map((guest) => (
              <div
                key={guest.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-sans text-sm">{guest.name}</p>
                  <p className="font-sans text-[10px] text-champagne/40">
                    {partySize(guest)} planned seat{partySize(guest) === 1 ? '' : 's'}
                  </p>
                </div>
                <select
                  value=""
                  aria-label={`Assign guest ${guest.name}`}
                  onChange={(event) => {
                    if (event.target.value) void onAssignGuestToTable(guest, event.target.value)
                  }}
                  className="h-8 max-w-[11rem] rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs text-gold"
                >
                  <option value="">Assign guest</option>
                  {tables.map((table) => {
                    const occupied = occupancyFor(table.id)
                    const seats = partySize(guest)
                    const full = occupied + seats > table.capacity
                    return (
                      <option key={table.id} value={table.id} disabled={full}>
                        {table.name} ({occupied}/{table.capacity}){full ? ' — full' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tables.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              title="No seating tables"
              detail="Create tables here, then use the seating workflow to assign confirmed guests."
            />
          </div>
        ) : (
          tables.map((table) => {
            const occupied = occupancyFor(table.id)
            const assignedGuests = guestsByTable.get(table.id) ?? []
            const overCapacity = occupied > table.capacity
            const isEditing = editingTableId === table.id

            return (
              <SectionCard key={table.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  {isEditing ? (
                    <div className="grid flex-1 gap-2 grid-cols-[minmax(0,1fr)_6rem]">
                      <div>
                        <Label htmlFor={`workspace-table-name-${table.id}`}>Table name</Label>
                        <Input
                          id={`workspace-table-name-${table.id}`}
                          value={editTable.name}
                          onChange={(event) =>
                            setEditTable((current) => ({ ...current, name: event.target.value }))
                          }
                          className="mt-1 h-8 border-gold/20 bg-espresso/70 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`workspace-table-capacity-${table.id}`}>Capacity</Label>
                        <Input
                          id={`workspace-table-capacity-${table.id}`}
                          type="number"
                          min="1"
                          max="50"
                          value={editTable.capacity}
                          onChange={(event) =>
                            setEditTable((current) => ({ ...current, capacity: event.target.value }))
                          }
                          className="mt-1 h-8 border-gold/20 bg-espresso/70 text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-serif text-lg">{table.name}</h3>
                      <p className="font-sans text-xs text-champagne/45">
                        {table.position || 'Position not set'}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Save ${table.name}`}
                          disabled={saving}
                          onClick={() => void saveTable(table)}
                          className="size-8 text-sage-light"
                        >
                          <CheckCircle2 className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Cancel editing ${table.name}`}
                          onClick={() => setEditingTableId(null)}
                          className="size-8 text-champagne/45"
                        >
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${table.name}`}
                          disabled={saving}
                          onClick={() => startTableEdit(table)}
                          className="size-8 text-champagne/45 hover:text-gold"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${table.name}`}
                          disabled={saving}
                          onClick={() => {
                            const consequence = assignedGuests.length
                              ? ` ${assignedGuests.length} assigned guest record${assignedGuests.length === 1 ? '' : 's'} will become unassigned.`
                              : ''
                            if (window.confirm(`Delete table “${table.name}”?${consequence}`)) {
                              void onDeleteTable(table)
                            }
                          }}
                          className="size-8 text-champagne/45 hover:bg-clay/10 hover:text-clay-light"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <Badge
                    variant="outline"
                    className={
                      overCapacity
                        ? 'border-clay/40 text-clay-light'
                        : 'border-gold/20 text-gold'
                    }
                  >
                    {occupied}/{table.capacity} seats
                  </Badge>
                  {overCapacity && (
                    <span className="font-sans text-[10px] uppercase tracking-wider text-clay-light">
                      Over capacity
                    </span>
                  )}
                </div>
                <Progress
                  value={Math.min(100, table.capacity ? (occupied / table.capacity) * 100 : 0)}
                  className="mt-2 h-1.5 bg-champagne/10 [&>div]:bg-gold"
                />

                <div className="mt-3 space-y-2">
                  {assignedGuests.length === 0 ? (
                    <p className="font-sans text-xs italic text-champagne/40">No guests assigned</p>
                  ) : (
                    assignedGuests.map((guest) => (
                      <div
                        key={guest.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-gold/10 bg-espresso/45 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-sans text-xs">{guest.name}</p>
                          <p className="font-sans text-[9px] text-champagne/35">
                            {partySize(guest)} planned seat{partySize(guest) === 1 ? '' : 's'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Unassign guest ${guest.name}`}
                          disabled={saving}
                          onClick={() => void onAssignGuestToTable(guest, null)}
                          className="h-7 px-2 text-[10px] text-champagne/45 hover:text-clay-light"
                        >
                          <X className="size-3" /> Unassign guest
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {unassignedGuests.length > 0 && occupied < table.capacity && (
                  <div className="mt-3 flex items-center gap-2">
                    <UserPlus className="size-4 text-gold" />
                    <select
                      value=""
                      aria-label={`Assign guest to ${table.name}`}
                      onChange={(event) => {
                        const guest = unassignedGuests.find((candidate) => candidate.id === event.target.value)
                        if (guest) void onAssignGuestToTable(guest, table.id)
                      }}
                      className="h-8 min-w-0 flex-1 rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs text-gold"
                    >
                      <option value="">Assign guest</option>
                      {unassignedGuests.map((guest) => {
                        const seats = partySize(guest)
                        const full = occupied + seats > table.capacity
                        return (
                          <option key={guest.id} value={guest.id} disabled={full}>
                            {guest.name}{full ? ' — no capacity' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                )}
              </SectionCard>
            )
          })
        )}
      </div>
    </div>
  )
}
