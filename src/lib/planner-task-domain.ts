/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 §7.
 *
 * Extracted from `src/app/api/planner/tasks/route.ts` and `[id]/route.ts` (previously inline,
 * duplicated in both files) so the native-safe adapter (`/api/native/wedding/tasks`) and the PWA
 * routes share exactly one definition of what a valid PlannerTask looks like. Business logic lives
 * here once; every caller (PWA cookie route, native bearer route) formats/validates the same way.
 */

export const PLANNER_TASK_CATEGORIES = [
  'timeline_12_18',
  'timeline_9_12',
  'timeline_6_9',
  'timeline_3_6',
  'timeline_2mo',
  'timeline_1mo',
  'timeline_2wk',
  'timeline_1wk',
  'wedding_day',
  'spiritual',
  'venue',
  'catering',
  'attire',
  'roora',
  'magumo',
  'transport',
  'stationery',
  'decor',
  'photo_video',
  'music',
  'other',
] as const
export const PLANNER_TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked'] as const
export const PLANNER_TASK_PRIORITIES = ['low', 'medium', 'high'] as const

export type PlannerTaskCategory = (typeof PLANNER_TASK_CATEGORIES)[number]
export type PlannerTaskStatus = (typeof PLANNER_TASK_STATUSES)[number]
export type PlannerTaskPriority = (typeof PLANNER_TASK_PRIORITIES)[number]

export interface PlannerTaskRow {
  id: string
  title: string
  description: string | null
  category: string
  status: string
  priority: string
  dueDate: Date | null
  assignee: string | null
  assigneeUserId: string | null
  order: number
  weddingId: string
  createdAt: Date
  updatedAt: Date
}

export function formatPlannerTask(task: PlannerTaskRow) {
  return {
    ...task,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export function normalizeTaskCategory(value: unknown): PlannerTaskCategory {
  return PLANNER_TASK_CATEGORIES.includes(value as PlannerTaskCategory)
    ? (value as PlannerTaskCategory)
    : 'other'
}

export function normalizeTaskStatus(value: unknown): PlannerTaskStatus {
  return PLANNER_TASK_STATUSES.includes(value as PlannerTaskStatus)
    ? (value as PlannerTaskStatus)
    : 'todo'
}

export function normalizeTaskPriority(value: unknown): PlannerTaskPriority {
  return PLANNER_TASK_PRIORITIES.includes(value as PlannerTaskPriority)
    ? (value as PlannerTaskPriority)
    : 'medium'
}

export function isValidTaskCategory(value: unknown): value is PlannerTaskCategory {
  return PLANNER_TASK_CATEGORIES.includes(value as PlannerTaskCategory)
}

export function isValidTaskStatus(value: unknown): value is PlannerTaskStatus {
  return PLANNER_TASK_STATUSES.includes(value as PlannerTaskStatus)
}

export function isValidTaskPriority(value: unknown): value is PlannerTaskPriority {
  return PLANNER_TASK_PRIORITIES.includes(value as PlannerTaskPriority)
}
