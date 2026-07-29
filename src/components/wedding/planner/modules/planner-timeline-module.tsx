'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Clock3, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TimelineRow {
  id: string
  time: string
  event: string
  title: string
  notes: string
  duration: string
  location: string
  order: number
}

interface TimelineForm {
  time: string
  event: string
  location: string
}

interface PlannerTimelineModuleProps {
  timeline: TimelineRow[]
  timelineForm: TimelineForm
  setTimelineForm: Dispatch<SetStateAction<TimelineForm>>
  saving: boolean
  onAddTimelineItem: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
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

export function PlannerTimelineModule({
  timeline,
  timelineForm,
  setTimelineForm,
  saving,
  onAddTimelineItem,
}: PlannerTimelineModuleProps) {
  return (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <form onSubmit={onAddTimelineItem} className="grid gap-3 md:grid-cols-[9rem_2fr_2fr_auto]">
          <div>
            <Label>Time</Label>
            <Input
              type="time"
              value={timelineForm.time}
              onChange={(event) =>
                setTimelineForm((current) => ({ ...current, time: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label>Activity</Label>
            <Input
              value={timelineForm.event}
              onChange={(event) =>
                setTimelineForm((current) => ({ ...current, event: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
              placeholder="Ceremony begins"
            />
          </div>
          <div>
            <Label>Location</Label>
            <Input
              value={timelineForm.location}
              onChange={(event) =>
                setTimelineForm((current) => ({ ...current, location: event.target.value }))
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
          {timeline.length === 0 ? (
            <EmptyState
              title="No timeline items"
              detail="Build the wedding-day run sheet manually or import the timeline worksheet."
            />
          ) : (
            timeline.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3 sm:grid-cols-[7rem_1fr] sm:items-center"
              >
                <div className="flex items-center gap-2 font-serif text-lg text-gold">
                  <Clock3 className="size-4" />
                  {item.time}
                </div>
                <div>
                  <p className="font-sans text-sm font-medium">{item.event}</p>
                  <p className="text-xs text-champagne/45">
                    {item.location || 'Location not set'}
                    {item.duration ? ` · ${item.duration}` : ''}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  )
}
