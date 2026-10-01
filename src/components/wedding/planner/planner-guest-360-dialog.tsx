'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, RotateCw, UserRoundSearch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Guest360Data {
  guestId: string
  identity: {
    name: string
    role: string
    roleDetail: string | null
    relationshipSide: string | null
    attendanceAllocation: string
    serviceProvider: null | {
      teamId: string
      teamName: string
      company: string
      vendorId: string
      vendorName: string
      serviceCategory: string
      function: string
      isLeader: boolean
      rosterStatus: string
      submitted: boolean
      approved: boolean
    }
  }
  contact: { email: string | null; phone: string | null; missing: boolean }
  invitation: {
    url: string | null
    deliveryStatus: string
    deliveryChannel: string | null
    deliveredAt: string | null
    deliveredBy: string | null
    openedAt: string | null
  }
  rsvp: {
    status: string
    attending: boolean | null
    mealChoice: string | null
    dietaryNotes: string | null
    message: string | null
    plusOne: boolean
    plusOneName: string | null
    kidsAttending: boolean
    kidsCount: number
    updatedAt: string | null
  }
  nativeActivation: {
    active: boolean
    platforms: string[]
    lastSeenAt: string | null
    clients: Array<{
      platform: string
      appVersion: string | null
      buildVersion: string | null
      firstActivatedAt: string
      lastSeenAt: string
      lastInvitationOpenAt: string | null
    }>
  }
  seating: {
    tableId: string | null
    tableName: string | null
    tableNumber: number | null
    tableCapacity: number | null
  }
  weddingPass: { state: string }
  checkIn: {
    checkedIn: boolean
    count: number
    records: Array<{
      id: string
      attendeeKey: string
      attendeeKind: string
      attendeeName: string
      source: string
      admittedAt: string
      gate: { id: string; name: string }
      admittedBy: { id: string; name: string | null; email: string }
    }>
  }
}

function text(value: string | null | undefined, fallback = 'Not set') {
  return value && value.trim() ? value : fallback
}

function when(value: string | null) {
  if (!value) return 'Not yet'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function title(value: string | null | undefined) {
  return text(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-espresso/40">{label}</p>
      <div className="mt-1 text-sm text-espresso/75">{value}</div>
    </div>
  )
}

function Section({
  title: heading,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-gold/15 bg-white/70 p-4">
      <h3 className="font-serif text-base text-espresso">{heading}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function PlannerGuest360Dialog({
  guestId,
  guestName,
  compact = false,
}: {
  guestId: string
  guestName: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Guest360Data | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/planner/guests/${encodeURIComponent(guestId)}/360`, {
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load Guest 360°.')
      }
      setData(payload.data as Guest360Data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Guest 360°.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && !data && !busy) void load()
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className="border-gold/20"
          aria-label={`Open 360 degree view for ${guestName}`}
        >
          <UserRoundSearch className="size-4" />
          360°
        </Button>
      </DialogTrigger>
      <DialogContent
        data-testid="planner-guest-360"
        className="border-gold/20 bg-champagne sm:max-w-4xl"
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Guest 360°</DialogTitle>
          <DialogDescription>
            One operational projection of this canonical Guest identity. No data is duplicated here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 border-y border-gold/10 py-3">
          <div>
            <p className="font-serif text-xl text-espresso">{data?.identity.name ?? guestName}</p>
            {data && (
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="outline">{title(data.identity.role)}</Badge>
                <Badge variant="outline">Allocation: {title(data.identity.attendanceAllocation)}</Badge>
                <Badge variant="outline">RSVP: {title(data.rsvp.status)}</Badge>
                <Badge variant="outline">Pass: {title(data.weddingPass.state)}</Badge>
              </div>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void load()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
            Refresh
          </Button>
        </div>

        {error && <p role="alert" className="rounded-xl border border-clay/25 bg-clay/10 p-3 text-sm text-clay">{error}</p>}
        {busy && !data && <div className="flex min-h-52 items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>}

        {data && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Section title="Identity & classification">
              <Field label="Participant type" value={title(data.identity.role)} />
              <Field label="Role / relationship detail" value={text(data.identity.roleDetail)} />
              <Field label="Relationship side" value={title(data.identity.relationshipSide)} />
              <Field label="Capacity allocation" value={title(data.identity.attendanceAllocation)} />
              {data.identity.serviceProvider && (
                <>
                  <Field label="Service company" value={data.identity.serviceProvider.company} />
                  <Field label="Service category" value={data.identity.serviceProvider.serviceCategory} />
                  <Field label="Team / function" value={`${data.identity.serviceProvider.teamName} · ${data.identity.serviceProvider.function}`} />
                  <Field label="Roster approval" value={data.identity.serviceProvider.approved ? 'Approved' : title(data.identity.serviceProvider.rosterStatus)} />
                </>
              )}
            </Section>

            <Section title="Contact">
              <Field label="Email" value={text(data.contact.email, 'Missing')} />
              <Field label="Phone" value={text(data.contact.phone, 'Missing')} />
              <Field label="Contact state" value={data.contact.missing ? 'Missing contact' : 'Contact available'} />
            </Section>

            <Section title="Invitation">
              <Field label="Delivery" value={title(data.invitation.deliveryStatus)} />
              <Field label="Channel" value={title(data.invitation.deliveryChannel)} />
              <Field label="Sent at" value={when(data.invitation.deliveredAt)} />
              <Field label="Opened at" value={when(data.invitation.openedAt)} />
              <Field label="Sent by" value={text(data.invitation.deliveredBy)} />
              <Field
                label="Personal invitation"
                value={data.invitation.url ? (
                  <a href={data.invitation.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold-dark underline">
                    Open <ExternalLink className="size-3" />
                  </a>
                ) : 'Link unavailable'}
              />
            </Section>

            <Section title="RSVP">
              <Field label="Status" value={title(data.rsvp.status)} />
              <Field label="Meal" value={text(data.rsvp.mealChoice)} />
              <Field label="Dietary notes" value={text(data.rsvp.dietaryNotes)} />
              <Field label="Message" value={text(data.rsvp.message)} />
              {data.identity.role !== 'service_provider' && (
                <>
                  <Field label="Historical +1" value={data.rsvp.plusOne ? text(data.rsvp.plusOneName, 'Recorded') : 'None attending'} />
                  <Field label="Children" value={data.rsvp.kidsAttending ? `${data.rsvp.kidsCount} attending` : 'None attending'} />
                </>
              )}
            </Section>

            <Section title="Native activation">
              <Field label="State" value={data.nativeActivation.active ? 'Confirmed native activation' : 'No confirmed app activation'} />
              <Field label="Platforms" value={data.nativeActivation.platforms.length ? data.nativeActivation.platforms.join(' + ') : 'None'} />
              <Field label="Last seen" value={when(data.nativeActivation.lastSeenAt)} />
              <Field
                label="Clients"
                value={data.nativeActivation.clients.length
                  ? data.nativeActivation.clients.map((client) =>
                      `${client.platform} ${client.appVersion ?? ''} · last ${when(client.lastSeenAt)}`,
                    ).join(' | ')
                  : 'None'}
              />
            </Section>

            <Section title="Seating">
              <Field label="Table" value={text(data.seating.tableName, 'Unassigned')} />
              <Field label="Table number" value={data.seating.tableNumber ?? 'Not set'} />
              <Field label="Table capacity" value={data.seating.tableCapacity ?? 'Not set'} />
            </Section>

            <Section title="Wedding Pass">
              <Field label="Canonical state" value={title(data.weddingPass.state)} />
              <Field label="Credential authority" value="WW2 Wedding Pass" />
            </Section>

            <Section title="Gate & arrival">
              <Field label="Arrival" value={data.checkIn.checkedIn ? 'Checked in' : 'Not checked in'} />
              <Field label="Admission records" value={data.checkIn.count} />
              {data.checkIn.records.map((record) => (
                <div key={record.id} className="sm:col-span-2 rounded-lg border border-gold/10 bg-champagne/55 p-2 text-xs">
                  <strong>{record.attendeeName}</strong> · {title(record.attendeeKind)} · {record.gate.name} · {when(record.admittedAt)} · {record.source}
                </div>
              ))}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
