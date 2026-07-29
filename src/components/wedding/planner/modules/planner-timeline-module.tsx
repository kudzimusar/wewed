'use client'

import { useState, type FormEvent } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Pencil,
  Plus,
  Printer,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface TimelineRow {
  id: string
  time: string
  event: string
  title: string
  notes: string
  duration: string
  location: string
  order: number
}

export interface TimelineInput {
  time: string
  event: string
  duration: string
  location: string
  notes: string
}

interface PlannerTimelineModuleProps {
  timeline: TimelineRow[]
  saving: boolean
  onCreateTimelineItem: (input: TimelineInput) => Promise<boolean>
  onUpdateTimelineItem: (item: TimelineRow, input: TimelineInput) => Promise<boolean>
  onDeleteTimelineItem: (item: TimelineRow) => Promise<boolean>
  onMoveTimelineItem: (item: TimelineRow, direction: -1 | 1) => Promise<boolean>
  onPrintTimeline: () => void
}

const EMPTY_FORM: TimelineInput = {
  time: '',
  event: '',
  duration: '',
  location: '',
  notes: '',
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
  saving,
  onCreateTimelineItem,
  onUpdateTimelineItem,
  onDeleteTimelineItem,
  onMoveTimelineItem,
  onPrintTimeline,
}: PlannerTimelineModuleProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [timelineForm, setTimelineForm] = useState<TimelineInput>(EMPTY_FORM)

  function startEdit(item: TimelineRow) {
    setEditingId(item.id)
    setTimelineForm({
      time: item.time,
      event: item.event,
      duration: item.duration,
      location: item.location,
      notes: item.notes,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setTimelineForm(EMPTY_FORM)
  }

  async function submitTimeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!timelineForm.time.trim() || !timelineForm.event.trim()) return

    const editingItem = editingId
      ? timeline.find((item) => item.id === editingId) ?? null
      : null
    const succeeded = editingItem
      ? await onUpdateTimelineItem(editingItem, timelineForm)
      : await onCreateTimelineItem(timelineForm)

    if (succeeded) cancelEdit()
  }

  return (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg">
              {editingId ? 'Edit timeline item' : 'Add timeline item'}
            </h2>
            <p className="font-sans text-xs text-champagne/45">
              Maintain the selected wedding’s operational run sheet.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrintTimeline}
            disabled={timeline.length === 0}
            className="border-gold/25 bg-transparent text-gold hover:bg-gold/10"
          >
            <Printer className="size-4" /> Print run sheet
          </Button>
        </div>

        <form
          onSubmit={submitTimeline}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[8rem_1.4fr_0.8fr_1fr_1.4fr_auto]"
        >
          <div>
            <Label htmlFor="workspace-timeline-time">Time</Label>
            <Input
              id="workspace-timeline-time"
              type="time"
              value={timelineForm.time}
              onChange={(event) =>
                setTimelineForm((current) => ({ ...current, time: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label htmlFor="workspace-timeline-event">Event</Label>
            <Input
              id="workspace-timeline-event"
              value={timelineForm.event}
              onChange={(event) =>
                setTimelineForm((current) => ({ ...current, event: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
              placeholder="Ceremony begins"
            />
          </div>
          <div>
            <Label htmlFor="workspace-timeline-duration">Duration</Label>
            <Input
              id="workspace-timeline-duration"
              value={timelineForm.duration}
              onChange={(event) =>
                setTimelineForm((current) => ({ ...current, duration: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
              placeholder="45 min"
            />
          </div>
          <div>
            <Label htmlFor="workspace-timeline-location">Location</Label>
            <Input
              id="workspace-timeline-location"
              value={timelineForm.location}
              onChange={(event) =>
                setTimelineForm((current) => ({ ...current, location: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label htmlFor="workspace-timeline-notes">Notes</Label>
            <Input
              id="workspace-timeline-notes"
              value={timelineForm.notes}
              onChange={(event) =>
                setTimelineForm((current) => ({ ...current, notes: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
              placeholder="Cues, contacts, or dependencies"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-gold text-espresso hover:bg-gold-light"
            >
              {editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
              {editingId ? 'Save' : 'Add'}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={cancelEdit}
                aria-label="Cancel timeline edit"
                className="text-champagne/55"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
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
            timeline.map((item, index) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="flex items-center gap-2 font-serif text-lg text-gold">
                  <Clock3 className="size-4" />
                  {item.time}
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-sm font-medium">{item.event}</p>
                  <p className="text-xs text-champagne/45">
                    {item.location || 'Location not set'}
                    {item.duration ? ` · ${item.duration}` : ''}
                  </p>
                  {item.notes && (
                    <p className="mt-1 font-sans text-xs text-champagne/60">{item.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${item.event} up`}
                    disabled={saving || index === 0}
                    onClick={() => void onMoveTimelineItem(item, -1)}
                    className="size-8 text-champagne/45 hover:text-gold"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${item.event} down`}
                    disabled={saving || index === timeline.length - 1}
                    onClick={() => void onMoveTimelineItem(item, 1)}
                    className="size-8 text-champagne/45 hover:text-gold"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${item.event}`}
                    disabled={saving}
                    onClick={() => startEdit(item)}
                    className="size-8 text-champagne/45 hover:text-gold"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${item.event}`}
                    disabled={saving}
                    onClick={() => {
                      if (window.confirm(`Delete timeline item “${item.event}”?`)) {
                        void onDeleteTimelineItem(item)
                      }
                    }}
                    className="size-8 text-champagne/45 hover:bg-clay/10 hover:text-clay-light"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  )
}
