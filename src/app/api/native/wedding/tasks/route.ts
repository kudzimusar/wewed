import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import { formatPlannerTask } from '@/lib/planner-task-domain'
import { createPlannerTaskOperation } from '@/lib/planner-task-operations'
import { shouldBlockPreviewWrite, PREVIEW_WRITE_BLOCK_MESSAGE } from '@/lib/preview-write-safety'

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 §9/§5 — Planner core (Tasks).
 *
 * Shared by Couple/Planner/Coordinator: the wedding scope and edit permission come from the
 * freshly-resolved grant (`resolveNativeGrantContext`), never from a client-supplied weddingId or
 * an assumed workspaceKind. `planner.view`/`planner.edit` are the SAME strings `/api/planner/tasks`
 * checks via `requireWeddingPermission` — a coordinator's grant already carries a narrower
 * permission set than a planner/owner's (`resolveWeddingPermissions`, wedding-access.ts), so no
 * separate coordinator branch is needed here. Task creation itself calls
 * `createPlannerTaskOperation` — the SAME shared domain operation `/api/planner/tasks` calls — so
 * this route is a transport adapter, not a second implementation of Planner business logic.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context

  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'planner.view')
  if (!permission.ok) return permission.response

  const tasks = await db.plannerTask.findMany({
    where: { weddingId: scope.weddingId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })

  return noStoreJson({ success: true, count: tasks.length, data: tasks.map(formatPlannerTask) })
}

export async function POST(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context

  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'planner.edit')
  if (!permission.ok) return permission.response

  if (shouldBlockPreviewWrite({ method: request.method, weddingId: scope.weddingId })) {
    return noStoreJson({ success: false, code: 'PREVIEW_WRITE_BLOCKED', error: PREVIEW_WRITE_BLOCK_MESSAGE }, 423)
  }

  const body = await request.json().catch(() => null)
  if (!body) return noStoreJson({ success: false, error: 'A valid JSON body is required.' }, 400)

  const operation = await createPlannerTaskOperation(scope.weddingId, body)
  if (!operation.ok) {
    return noStoreJson(
      { success: false, error: operation.error, ...(operation.field ? { field: operation.field } : {}) },
      operation.status,
    )
  }
  return noStoreJson({ success: true, data: operation.value }, 201)
}
