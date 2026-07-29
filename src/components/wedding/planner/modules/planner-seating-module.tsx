'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

interface SeatingTableRow {
  id: string
  name: string
  capacity: number
  position: string | null
}

interface TableForm {
  name: string
  capacity: string
}

interface PlannerSeatingModuleProps {
  tables: SeatingTableRow[]
  tableForm: TableForm
  setTableForm: Dispatch<SetStateAction<TableForm>>
  tableOccupancy: Map<string, number>
  saving: boolean
  onAddTable: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
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

export function PlannerSeatingModule({
  tables,
  tableForm,
  setTableForm,
  tableOccupancy,
  saving,
  onAddTable,
}: PlannerSeatingModuleProps) {
  return (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <form onSubmit={onAddTable} className="grid gap-3 md:grid-cols-[2fr_9rem_auto]">
          <div>
            <Label>Table name</Label>
            <Input
              value={tableForm.name}
              onChange={(event) =>
                setTableForm((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
              placeholder="Family Table 1"
            />
          </div>
          <div>
            <Label>Capacity</Label>
            <Input
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
            const occupied = tableOccupancy.get(table.id) ?? 0
            return (
              <SectionCard key={table.id} className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg">{table.name}</h3>
                  <Badge
                    variant="outline"
                    className={
                      occupied > table.capacity
                        ? 'border-clay/40 text-clay-light'
                        : 'border-gold/20 text-gold'
                    }
                  >
                    {occupied}/{table.capacity}
                  </Badge>
                </div>
                <Progress
                  value={Math.min(100, table.capacity ? (occupied / table.capacity) * 100 : 0)}
                  className="mt-3 h-1.5 bg-champagne/10 [&>div]:bg-gold"
                />
                <p className="mt-2 text-xs text-champagne/45">
                  {table.position || 'Position not set'}
                </p>
              </SectionCard>
            )
          })
        )}
      </div>
    </div>
  )
}
