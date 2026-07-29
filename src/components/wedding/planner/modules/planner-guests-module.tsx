'use client'

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { CheckCircle2, Circle, Plus, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface GuestRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  roleDetail: string | null
  side: string | null
  seatingTableId: string | null
  seatingTableName: string | null
  rsvp: {
    attending: boolean | null
    mealChoice: string | null
    plusOne: boolean
    plusOneName: string | null
    plusOneMeal: string | null
    kidsAttending: boolean
    kidsCount: number
    dietaryNotes: string | null
    checkedIn: boolean
    checkedInAt: string | null
  } | null
}

export interface SeatingTableOption {
  id: string
  name: string
  capacity: number
}

export interface GuestForm {
  name: string
  email: string
  phone: string
  role: string
  side: string
  seatingTableId: string
}

export interface GuestStats {
  total: number
  confirmed: number
  declined: number
  pending: number
  plusOnes: number
  kidsTotal: number
  checkedIn: number
  heads: number
}

interface PlannerGuestsModuleProps {
  guests: GuestRow[]
  tables: SeatingTableOption[]
  guestForm: GuestForm
  setGuestForm: Dispatch<SetStateAction<GuestForm>>
  guestStats: GuestStats
  saving: boolean
  onAddGuest: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onAssignGuestTable: (guest: GuestRow, tableId: string | null) => void | Promise<void>
  onDeleteGuest: (guest: GuestRow) => void | Promise<void>
}

const GUEST_ROLES = [
  { value: 'guest', label: 'Guest' },
  { value: 'bridal_party', label: 'Bridal party' },
  { value: 'family', label: 'Family' },
  { value: 'officiant', label: 'Officiant' },
  { value: 'vip', label: 'VIP' },
]

const GUEST_SIDES = [
  { value: 'bride', label: "Bride's side" },
  { value: 'groom', label: "Groom's side" },
  { value: 'family', label: 'Shared family' },
  { value: 'neutral', label: 'Neutral / shared' },
]

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function sideLabel(value: string | null): string {
  return GUEST_SIDES.find((side) => side.value === value)?.label ?? (value ? titleCase(value) : 'No side')
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

export function PlannerGuestsModule({
  guests,
  tables,
  guestForm,
  setGuestForm,
  guestStats,
  saving,
  onAddGuest,
  onAssignGuestTable,
  onDeleteGuest,
}: PlannerGuestsModuleProps) {
  const [guestSearch, setGuestSearch] = useState('')
  const [guestSideFilter, setGuestSideFilter] = useState('all')
  const [guestStatusFilter, setGuestStatusFilter] = useState('all')

  const filteredGuests = useMemo(() => {
    const query = guestSearch.trim().toLowerCase()
    return guests.filter((guest) => {
      if (guestSideFilter !== 'all' && guest.side !== guestSideFilter) return false
      const attending = guest.rsvp?.attending
      if (guestStatusFilter === 'confirmed' && attending !== true) return false
      if (guestStatusFilter === 'declined' && attending !== false) return false
      if (guestStatusFilter === 'pending' && attending !== null && attending !== undefined) return false
      if (!query) return true
      return [guest.name, guest.email ?? ''].some((value) => value.toLowerCase().includes(query))
    })
  }, [guests, guestSearch, guestSideFilter, guestStatusFilter])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
        {[
          ['Invited', guestStats.total],
          ['Confirmed', guestStats.confirmed],
          ['Declined', guestStats.declined],
          ['Pending', guestStats.pending],
          ['Plus-ones', guestStats.plusOnes],
          ['Kids', guestStats.kidsTotal],
          ['Heads', guestStats.heads],
          ['Checked-in', guestStats.checkedIn],
        ].map(([label, value]) => (
          <SectionCard key={String(label)} className="p-3 text-center">
            <p className="font-serif text-xl">{value}</p>
            <p className="font-sans text-[9px] uppercase tracking-wider text-champagne/40">{label}</p>
          </SectionCard>
        ))}
      </div>

      <SectionCard className="p-4">
        <div className="mb-3">
          <h2 className="font-serif text-lg">Add guest</h2>
          <p className="font-sans text-xs text-champagne/45">
            Create the full invitation record and optionally assign an initial table.
          </p>
        </div>
        <form onSubmit={onAddGuest} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_1.25fr_auto]">
          <div>
            <Label htmlFor="workspace-guest-name">Name</Label>
            <Input
              id="workspace-guest-name"
              value={guestForm.name}
              onChange={(event) =>
                setGuestForm((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label htmlFor="workspace-guest-email">Email</Label>
            <Input
              id="workspace-guest-email"
              type="email"
              value={guestForm.email}
              onChange={(event) =>
                setGuestForm((current) => ({ ...current, email: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label htmlFor="workspace-guest-phone">Phone</Label>
            <Input
              id="workspace-guest-phone"
              value={guestForm.phone}
              onChange={(event) =>
                setGuestForm((current) => ({ ...current, phone: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label htmlFor="workspace-guest-role">Role</Label>
            <select
              id="workspace-guest-role"
              value={guestForm.role}
              onChange={(event) =>
                setGuestForm((current) => ({ ...current, role: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
            >
              {GUEST_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="workspace-guest-side">Side</Label>
            <select
              id="workspace-guest-side"
              value={guestForm.side}
              onChange={(event) =>
                setGuestForm((current) => ({ ...current, side: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
            >
              {GUEST_SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="workspace-guest-table">Initial table</Label>
            <select
              id="workspace-guest-table"
              value={guestForm.seatingTableId}
              onChange={(event) =>
                setGuestForm((current) => ({ ...current, seatingTableId: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
            >
              <option value="">Unassigned</option>
              {tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}
            </select>
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="self-end bg-gold text-espresso hover:bg-gold-light"
          >
            <Plus className="size-4" />
            Add
          </Button>
        </form>
      </SectionCard>

      <SectionCard className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" />
            <Input
              value={guestSearch}
              onChange={(event) => setGuestSearch(event.target.value)}
              placeholder="Search by name or email"
              className="border-gold/20 bg-espresso/70 pl-9"
            />
          </div>
          <select
            value={guestSideFilter}
            onChange={(event) => setGuestSideFilter(event.target.value)}
            aria-label="Filter guests by side"
            className="h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
          >
            <option value="all">All sides</option>
            {GUEST_SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}
          </select>
          <select
            value={guestStatusFilter}
            onChange={(event) => setGuestStatusFilter(event.target.value)}
            aria-label="Filter guests by RSVP status"
            className="h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
          >
            <option value="all">All RSVP statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="declined">Declined</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="space-y-3 p-4">
          {guests.length === 0 ? (
            <EmptyState
              title="No guests yet"
              detail="Add guests manually or import the guest worksheet. Invitation and reminder tools use these records."
            />
          ) : filteredGuests.length === 0 ? (
            <EmptyState
              title="No guests in this view"
              detail="Clear the search or filters to see the rest of the guest list."
            />
          ) : (
            filteredGuests.map((guest) => {
              const rsvpStatus =
                guest.rsvp?.attending === true
                  ? 'Confirmed'
                  : guest.rsvp?.attending === false
                    ? 'Declined'
                    : 'Pending'
              return (
                <article key={guest.id} className="rounded-xl border border-gold/10 bg-espresso/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-sans text-sm font-medium">{guest.name}</h3>
                        <Badge variant="outline" className="border-gold/20">{rsvpStatus}</Badge>
                        <Badge variant="outline" className="border-gold/20 text-champagne/55">
                          {titleCase(guest.role)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-champagne/45">
                        {guest.email || guest.phone || 'No contact'} · {sideLabel(guest.side)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={guest.seatingTableId ?? ''}
                        onChange={(event) => void onAssignGuestTable(guest, event.target.value || null)}
                        aria-label={`Assign table for ${guest.name}`}
                        className="h-9 rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs"
                      >
                        <option value="">Unassigned</option>
                        {tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${guest.name}`}
                        disabled={saving}
                        onClick={() => {
                          if (window.confirm(`Delete guest “${guest.name}”?`)) void onDeleteGuest(guest)
                        }}
                        className="size-9 text-champagne/40 hover:bg-clay/10 hover:text-clay-light"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-6">
                    <div className="rounded-lg border border-gold/10 px-3 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-champagne/35">Meal choice</p>
                      <p className="mt-1 text-champagne/70">{guest.rsvp?.mealChoice || 'Not selected'}</p>
                    </div>
                    <div className="rounded-lg border border-gold/10 px-3 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-champagne/35">Plus-one name</p>
                      <p className="mt-1 text-champagne/70">
                        {guest.rsvp?.plusOne ? guest.rsvp.plusOneName || 'Name pending' : 'No plus-one'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gold/10 px-3 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-champagne/35">Kids count</p>
                      <p className="mt-1 text-champagne/70">
                        {guest.rsvp?.kidsAttending ? guest.rsvp.kidsCount : 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gold/10 px-3 py-2 sm:col-span-2 xl:col-span-2">
                      <p className="text-[9px] uppercase tracking-wider text-champagne/35">Dietary notes</p>
                      <p className="mt-1 text-champagne/70">{guest.rsvp?.dietaryNotes || 'None recorded'}</p>
                    </div>
                    <div className="rounded-lg border border-gold/10 px-3 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-champagne/35">Checked in</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-champagne/70">
                        {guest.rsvp?.checkedIn ? (
                          <><CheckCircle2 className="size-3.5 text-sage-light" /> Yes</>
                        ) : (
                          <><Circle className="size-3.5 text-champagne/25" /> No</>
                        )}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </SectionCard>
    </div>
  )
}
