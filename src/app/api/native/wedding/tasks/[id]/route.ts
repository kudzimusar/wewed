import { NextRequest } from 'next/server'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import { togglePlannerTaskOperation, updatePlannerTaskOperation } from '@/lib/planner-task-operations'
import { shouldBlockPreviewWrite, PREVIEW_WRITE_BLOCK_MESSAGE } from '@/lib/preview-write-safety'

/**
 * Master plan Phase 8 §9/§5 — one task, scoped to the freshly-resolved grant's wedding, never to a
 * client-supplied weddingId. Native `toggleTask(weddingId, taskId)` is a `status` PATCH through
 * this same route — there is no separate toggle endpoint, matching "do not implement a separate
 * native task schema" (§9). Calls `updatePlannerTaskOperation` — the SAME shared domain operation
 * `/api/planner/tasks/[id]` calls — so a resource-missing 404 here means exactly what it means on
 * the PWA route, never a grant/authorization signal (§11).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return noStoreJson({ success: false, error: 'A valid JSON body is required.' }, 400)

  // `{"toggle": true}` is the one status-flip shortcut native offers (done <-> todo) — the flip
  // itself is computed server-side by togglePlannerTaskOperation, never by the client re-deriving
  // "the opposite of whatever it last saw" (master plan §5: status/toggle mutation is a shared
  // operation, not client business logic).
  const operation = body.toggle === true
    ? await togglePlannerTaskOperation(scope.weddingId, id)
    : await updatePlannerTaskOperation(scope.weddingId, id, body)
  if (!operation.ok) {
    return noStoreJson(
      { success: false, error: operation.error, ...(operation.field ? { field: operation.field } : {}) },
      operation.status,
    )
  }
  return noStoreJson({ success: true, data: operation.value })
}
