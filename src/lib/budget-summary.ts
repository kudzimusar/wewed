/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8.
 *
 * A minimal, mechanical aggregate over real `BudgetItem` rows (sum + group by category). This is
 * NOT a port of `/api/planner/budget`'s funding-attribution/contributions/documents overlay — that
 * logic stays untouched and unduplicated (`src/app/api/planner/budget/route.ts`, `@/lib/contributions/store`).
 * The native Budget surface is intentionally narrower in this phase: real per-item rows plus this
 * real aggregate, with funding attribution classified UNSUPPORTED until a dedicated adapter reuses
 * that engine directly rather than re-deriving it.
 */

export interface BudgetItemLike {
  category: string
  estimatedCost: number
  actualCost: number | null
  paidAmount: number
  currency: string
}

export interface BudgetCategoryTotal {
  category: string
  estimated: number
  actual: number
  paid: number
  count: number
}

export interface BudgetTotals {
  currency: string
  totalEstimated: number
  totalActual: number
  totalPaid: number
  categories: BudgetCategoryTotal[]
}

export function summarizeBudgetItems(items: BudgetItemLike[]): BudgetTotals {
  const totalEstimated = items.reduce((sum, item) => sum + item.estimatedCost, 0)
  const totalActual = items.reduce((sum, item) => sum + (item.actualCost ?? item.estimatedCost), 0)
  const totalPaid = items.reduce((sum, item) => sum + item.paidAmount, 0)

  const byCategory = new Map<string, BudgetCategoryTotal>()
  for (const item of items) {
    const current = byCategory.get(item.category) ?? {
      category: item.category,
      estimated: 0,
      actual: 0,
      paid: 0,
      count: 0,
    }
    current.estimated += item.estimatedCost
    current.actual += item.actualCost ?? item.estimatedCost
    current.paid += item.paidAmount
    current.count += 1
    byCategory.set(item.category, current)
  }

  return {
    currency: items[0]?.currency ?? 'USD',
    totalEstimated,
    totalActual,
    totalPaid,
    categories: Array.from(byCategory.values()).sort((a, b) => b.estimated - a.estimated),
  }
}
