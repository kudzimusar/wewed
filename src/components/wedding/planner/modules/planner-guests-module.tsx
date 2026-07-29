'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface GuestRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  side: string | null
  seatingTableId: string | null
  seatingTableName: string | null
  rsvp: {
    attending: boolean | null
    plusOne: boolean
    kidsAttending: boolean
    kidsCount: number
    checkedIn: boolean
  } | null
}

interface GuestForm {
  name: string
  email: string
}

interface GuestStats {
  confirmed: number
  pending: number
  heads: number
}

interface PlannerGuestsModuleProps {
  guests: GuestRow[]
  guestForm: GuestForm
  setGuestForm: Dispatch<SetStateAction<GuestForm>>
  guestStats: GuestStats
  saving: boolean
  onAddGuest: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
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
  guestForm,
  setGuestForm,
  guestStats,
  saving,
  onAddGuest,
}: PlannerGuestsModuleProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SectionCard className="p-4">
          <p className="text-xs text-champagne/45">Guest records</p>
          <p className="mt-1 font-serif text-2xl">{guests.length}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-xs text-champagne/45">Confirmed</p>
          <p className="mt-1 font-serif text-2xl">{guestStats.confirmed}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <p className="text-xs text-champagne/45">Confirmed seats</p>
          <p className="mt-1 font-serif text-2xl">{guestStats.heads}</p>
        </SectionCard>
      </div>

      <SectionCard className="p-4">
        <form onSubmit={onAddGuest} className="grid gap-3 md:grid-cols-[2fr_2fr_auto]">
          <div>
            <Label>Name</Label>
            <Input
              value={guestForm.name}
              onChange={(event) =>
                setGuestForm((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={guestForm.email}
              onChange={(event) =>
                setGuestForm((current) => ({ ...current, email: event.target.value }))
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
            Add
          </Button>
        </form>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="space-y-2 p-4">
          {guests.length === 0 ? (
            <EmptyState
              title="No guests yet"
              detail="Add guests manually or import the guest worksheet. Invitation and reminder tools use these records."
            />
          ) : (
            guests.map((guest) => (
              <div
                key={guest.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3"
              >
                <div>
                  <p className="font-sans text-sm font-medium">{guest.name}</p>
                  <p className="text-xs text-champagne/45">
                    {guest.email || guest.phone || 'No contact'} ·{' '}
                    {guest.side ? titleCase(guest.side) : 'No side'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-gold/20">
                    {guest.rsvp?.attending === true
                      ? 'Confirmed'
                      : guest.rsvp?.attending === false
                        ? 'Declined'
                        : 'Pending'}
                  </Badge>
                  {guest.seatingTableName && (
                    <Badge variant="outline" className="border-gold/20 text-gold">
                      {guest.seatingTableName}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  )
}
