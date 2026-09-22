import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import {
  formatPlannerTask,
  normalizeTaskCategory,
  normalizeTaskPriority,
  normalizeTaskStatus,
} from '@/lib/planner-task-domain'
import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'
import { shouldBlockPreviewWrite, PREVIEW_WRITE_BLOCK_MESSAGE } from '@/lib/preview-write-safety'

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 §9 — Planner core (Tasks).
 *
 * Shared by Couple/Planner/Coordinator: the wedding scope and edit permission come from the
 * freshly-resolved grant (`resolveNativeGrantContext`), never from a client-supplied weddingId or
 * an assumed workspaceKind. `planner.view`/`planner.edit` are the SAME strings `/api/planner/tasks`
 * checks via `requireWeddingPermission` — a coordinator's grant already carries a narrower
 * permission set than a planner/owner's (`resolveWeddingPermissions`, wedding-access.ts), so no
 * separate coordinator branch is needed here.
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

interface CreateTaskPayload {
  title?: string
  description?: string
  category?: string
  status?: string
  priority?: string
  dueDate?: string | null
  assignee?: string
  order?: number
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

  const body = (await request.json().catch(() => null)) as CreateTaskPayload | null
  if (!body) return noStoreJson({ success: false, error: 'A valid JSON body is required.' }, 400)

  const titleError = plannerTitleError(body.title)
  if (titleError) return noStoreJson({ success: false, error: titleError, field: 'title' }, 400)

  let dueDate: Date | null = null
  if (body.dueDate) {
    const parsed = new Date(body.dueDate)
    if (Number.isNaN(parsed.getTime())) return noStoreJson({ success: false, error: 'Invalid dueDate' }, 400)
    dueDate = parsed
  }

  let order = body.order
  if (typeof order !== 'number' || !Number.isFinite(order)) {
    const lastTask = await db.plannerTask.findFirst({
      where: { weddingId: scope.weddingId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    order = (lastTask?.order ?? 0) + 1
  }

  const task = await db.plannerTask.create({
    data: {
      title: normalizePlannerTitle(body.title),
      description: body.description?.trim() || null,
      category: normalizeTaskCategory(body.category),
      status: normalizeTaskStatus(body.status),
      priority: normalizeTaskPriority(body.priority),
      dueDate,
      assignee: body.assignee?.trim() || null,
      order,
      weddingId: scope.weddingId,
    },
  })

  return NextResponse.json({ success: true, data: formatPlannerTask(task) }, { status: 201, headers: { 'cache-control': 'no-store' } })
}
