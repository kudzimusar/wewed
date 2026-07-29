'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

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

interface CategoryBreakdown {
  category: string
  estimated: number
  actual: number
  paid: number
  outstanding: number
  count: number
}

interface BudgetForm {
  description: string
  category: string
  estimatedCost: string
  actualCost: string
  paidAmount: string
  dueDate: string
}

interface PlannerBudgetModuleProps {
  budget: BudgetRow[]
  budgetSummary: BudgetSummary | null
  budgetByCategory: CategoryBreakdown[]
  budgetForm: BudgetForm
  setBudgetForm: Dispatch<SetStateAction<BudgetForm>>
  saving: boolean
  onAddBudgetItem: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onUpdateBudgetItem: (
    item: BudgetRow,
    field: 'actualCost' | 'paidAmount',
    value: string,
  ) => void | Promise<void>
  onDeleteBudgetItem: (item: BudgetRow) => void | Promise<void>
}

const BUDGET_CATEGORIES = [
  { value: 'venue', label: 'Venue' },
  { value: 'catering', label: 'Catering' },
  { value: 'attire', label: 'Attire' },
  { value: 'roora', label: 'Roora' },
  { value: 'decor', label: 'Decor' },
  { value: 'photo_video', label: 'Photo/Video' },
  { value: 'music', label: 'Music' },
  { value: 'transport', label: 'Transport' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
] as const

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

function categoryLabel(value: string): string {
  return BUDGET_CATEGORIES.find((category) => category.value === value)?.label ?? titleCase(value)
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
  budgetByCategory,
  budgetForm,
  setBudgetForm,
  saving,
  onAddBudgetItem,
  onUpdateBudgetItem,
  onDeleteBudgetItem,
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

      {budgetSummary && (
        <SectionCard className="p-4">
          <div className="flex items-center justify-between gap-3 font-sans text-xs text-champagne/55">
            <span>Payment progress</span>
            <span className="text-gold">{budgetSummary.percentPaid}% paid</span>
          </div>
          <Progress
            value={budgetSummary.percentPaid}
            className="mt-2 h-1.5 bg-champagne/10 [&>div]:bg-gold"
          />
        </SectionCard>
      )}

      {budgetByCategory.length > 0 && (
        <SectionCard className="p-4">
          <div className="mb-3">
            <h2 className="font-serif text-lg">Budget category breakdown</h2>
            <p className="font-sans text-xs text-champagne/45">
              Paid progress against the estimate for each category.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {budgetByCategory.map((category) => {
              const percent =
                category.estimated > 0
                  ? Math.min(100, Math.round((category.paid / category.estimated) * 100))
                  : 0
              return (
                <div key={category.category} className="rounded-xl border border-gold/10 bg-espresso/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-sans text-sm font-medium">
                        {categoryLabel(category.category)}
                      </p>
                      <p className="font-sans text-[10px] text-champagne/40">
                        {category.count} {category.count === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                    <p className="font-sans text-xs text-gold">
                      {money(category.paid, budgetSummary?.currency)} /{' '}
                      {money(category.estimated, budgetSummary?.currency)}
                    </p>
                  </div>
                  <Progress
                    value={percent}
                    className="mt-2 h-1 bg-champagne/10 [&>div]:bg-gold"
                  />
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard className="p-4">
        <form
          onSubmit={onAddBudgetItem}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr_1fr_auto]"
        >
          <div>
            <Label htmlFor="workspace-budget-description">Description</Label>
            <Input
              id="workspace-budget-description"
              value={budgetForm.description}
              onChange={(event) =>
                setBudgetForm((current) => ({ ...current, description: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
              placeholder="Venue hire"
            />
          </div>
          <div>
            <Label htmlFor="workspace-budget-category">Category</Label>
            <select
              id="workspace-budget-category"
              value={budgetForm.category}
              onChange={(event) =>
                setBudgetForm((current) => ({ ...current, category: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
            >
              {BUDGET_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="workspace-budget-estimated-cost">Estimate</Label>
            <Input
              id="workspace-budget-estimated-cost"
              type="number"
              min="0"
              value={budgetForm.estimatedCost}
              onChange={(event) =>
                setBudgetForm((current) => ({ ...current, estimatedCost: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label htmlFor="workspace-budget-actual-cost">Actual</Label>
            <Input
              id="workspace-budget-actual-cost"
              type="number"
              min="0"
              value={budgetForm.actualCost}
              onChange={(event) =>
                setBudgetForm((current) => ({ ...current, actualCost: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label htmlFor="workspace-budget-paid-amount">Paid</Label>
            <Input
              id="workspace-budget-paid-amount"
              type="number"
              min="0"
              value={budgetForm.paidAmount}
              onChange={(event) =>
                setBudgetForm((current) => ({ ...current, paidAmount: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label htmlFor="workspace-budget-due-date">Due date</Label>
            <Input
              id="workspace-budget-due-date"
              type="date"
              value={budgetForm.dueDate}
              onChange={(event) =>
                setBudgetForm((current) => ({ ...current, dueDate: event.target.value }))
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
            budget.map((item) => {
              const actual = item.actualCost ?? item.estimatedCost
              const outstanding = Math.max(0, actual - item.paidAmount)
              const isPaid = actual > 0 && item.paidAmount >= actual
              return (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3 lg:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans text-sm font-medium">{item.description}</p>
                      <Badge variant="outline" className="border-gold/20 text-[10px]">
                        {categoryLabel(item.category)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          isPaid
                            ? 'border-sage/30 text-sage-light'
                            : 'border-gold/20 text-champagne/55'
                        }
                      >
                        {isPaid ? 'Paid' : `${money(outstanding, item.currency)} outstanding`}
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${item.description}`}
                    disabled={saving}
                    onClick={() => {
                      if (window.confirm(`Delete budget item “${item.description}”?`)) {
                        void onDeleteBudgetItem(item)
                      }
                    }}
                    className="size-9 text-champagne/45 hover:bg-clay/10 hover:text-clay-light"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </SectionCard>
    </div>
  )
}
