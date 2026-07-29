'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BudgetRow {
  id: string
  category: string
  description: string
  estimatedCost: number
  actualCost: number | null
  paidAmount: number
  currency: string
  dueDate: string | null
}

interface BudgetSummary {
  totalEstimated: number
  totalActual: number
  totalPaid: number
  totalOutstanding: number
  currency: string
  percentPaid: number
}

interface BudgetForm {
  description: string
  category: string
  estimatedCost: string
}

interface PlannerBudgetModuleProps {
  budget: BudgetRow[]
  budgetSummary: BudgetSummary | null
  budgetForm: BudgetForm
  setBudgetForm: Dispatch<SetStateAction<BudgetForm>>
  saving: boolean
  onAddBudgetItem: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onUpdateBudgetItem: (
    item: BudgetRow,
    field: 'actualCost' | 'paidAmount',
    value: string,
  ) => void | Promise<void>
}

const BUDGET_CATEGORIES = [
  'venue',
  'catering',
  'attire',
  'decor',
  'photo_video',
  'music',
  'transport',
  'stationery',
  'miscellaneous',
]

function money(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
}

function dateText(value: string | null): string {
  if (!value) return 'No due date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
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

export function PlannerBudgetModule({
  budget,
  budgetSummary,
  budgetForm,
  setBudgetForm,
  saving,
  onAddBudgetItem,
  onUpdateBudgetItem,
}: PlannerBudgetModuleProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Estimated', budgetSummary?.totalEstimated ?? 0],
          ['Actual', budgetSummary?.totalActual ?? 0],
          ['Paid', budgetSummary?.totalPaid ?? 0],
          ['Outstanding', budgetSummary?.totalOutstanding ?? 0],
        ].map(([label, value]) => (
          <SectionCard key={String(label)} className="p-4">
            <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-gold/65">
              {label}
            </p>
            <p className="mt-2 font-serif text-2xl">
              {money(Number(value), budgetSummary?.currency)}
            </p>
          </SectionCard>
        ))}
      </div>

      <SectionCard className="p-4">
        <form onSubmit={onAddBudgetItem} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <div>
            <Label>Description</Label>
            <Input
              value={budgetForm.description}
              onChange={(event) =>
                setBudgetForm((current) => ({ ...current, description: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
              placeholder="Venue hire"
            />
          </div>
          <div>
            <Label>Category</Label>
            <select
              value={budgetForm.category}
              onChange={(event) =>
                setBudgetForm((current) => ({ ...current, category: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
            >
              {BUDGET_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {titleCase(category)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Estimate</Label>
            <Input
              type="number"
              min="0"
              value={budgetForm.estimatedCost}
              onChange={(event) =>
                setBudgetForm((current) => ({ ...current, estimatedCost: event.target.value }))
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
          {budget.length === 0 ? (
            <EmptyState
              title="No budget items"
              detail="Add your first estimate or import the wedding budget worksheet."
            />
          ) : (
            budget.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3 lg:grid-cols-[1fr_8rem_8rem] lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap gap-2">
                    <p className="font-sans text-sm font-medium">{item.description}</p>
                    <Badge variant="outline" className="border-gold/20 text-[10px]">
                      {titleCase(item.category)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-champagne/45">
                    Estimated {money(item.estimatedCost, item.currency)} · {dateText(item.dueDate)}
                  </p>
                </div>
                <div>
                  <Label className="text-[10px]">Actual</Label>
                  <Input
                    type="number"
                    min="0"
                    defaultValue={item.actualCost ?? ''}
                    onBlur={(event) =>
                      void onUpdateBudgetItem(item, 'actualCost', event.target.value)
                    }
                    className="mt-1 h-8 border-gold/20 bg-espresso/70 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Paid</Label>
                  <Input
                    type="number"
                    min="0"
                    defaultValue={item.paidAmount}
                    onBlur={(event) =>
                      void onUpdateBudgetItem(item, 'paidAmount', event.target.value)
                    }
                    className="mt-1 h-8 border-gold/20 bg-espresso/70 text-xs"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  )
}
