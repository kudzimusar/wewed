import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import { summarizeBudgetItems } from '@/lib/budget-summary'

/**
 * Master plan Phase 8 §9 — Budget (read-only in this phase).
 *
 * Real `BudgetItem` rows plus a real mechanical aggregate (`summarizeBudgetItems`). The PWA's
 * funding-attribution/contributions/documents overlay (`/api/planner/budget`,
 * `@/lib/contributions/store`) is intentionally NOT reused here — porting it correctly needs its
 * own adapter, tracked as remaining work rather than re-derived approximately. Writes are
 * UNSUPPORTED for the same reason: the PWA write path reclassifies legacy contribution-funding
 * allocations inside the same transaction, which this phase does not reproduce.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context

  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'budget.view')
  if (!permission.ok) return permission.response

  const items = await db.budgetItem.findMany({
    where: { weddingId: scope.weddingId },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  })

  const totals = summarizeBudgetItems(items)

  return noStoreJson({
    success: true,
    count: items.length,
    data: items.map((item) => ({
      ...item,
      dueDate: item.dueDate?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    totals,
  })
}
