import { NextRequest } from 'next/server'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import { loadContributionWorkspace } from '@/lib/contributions/store'

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §6 — Contributions
 * (read-only). Calls `loadContributionWorkspace` directly — the SAME mature engine
 * `/api/planner/contributions` uses — rather than re-deriving funding-attribution truth. This is
 * the one authoritative source for couple-funded / contributor-funded / cash / in-kind /
 * direct-to-vendor / linked-budget-attribution state; Android/iOS must never recompute any of it.
 * Writes (allocate/mark-thanked/mark-verified/etc.) remain UNSUPPORTED in this phase — each is its
 * own state-machine action with side effects (task creation, payment reconciliation) that need
 * their own dedicated audit, not a blanket passthrough.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context

  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'budget.view')
  if (!permission.ok) return permission.response

  const workspace = await loadContributionWorkspace(scope.weddingId)
  return noStoreJson({
    success: true,
    count: workspace.data.length,
    data: workspace.data,
    contributors: workspace.contributors,
    campaigns: workspace.campaigns,
    summaryByCurrency: workspace.summaryByCurrency,
    counts: workspace.counts,
  })
}
