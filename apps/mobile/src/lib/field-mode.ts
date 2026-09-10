import AsyncStorage from '@react-native-async-storage/async-storage'
import type { PlannerBudgetSummary, PlannerTask, PlannerTimelineItem } from '@/lib/types'

const FIELD_MODE_PREFIX = 'wewed.native.field-mode.v1'

export interface FieldModeSnapshot {
  version: 1
  userId: string
  weddingId: string
  savedAt: string
  pulse?: {
    tasks: PlannerTask[]
    budget: PlannerBudgetSummary | null
  }
  timeline?: PlannerTimelineItem[]
  counts?: {
    guests?: number
    vendors?: number
    conversations?: number
  }
}

function key(userId: string, weddingId: string) {
  return `${FIELD_MODE_PREFIX}:${userId}:${weddingId}`
}

async function mergeSnapshot(userId: string, weddingId: string, patch: Partial<FieldModeSnapshot>) {
  const current = await readFieldModeSnapshot(userId, weddingId)
  const next: FieldModeSnapshot = {
    ...(current ?? {
      version: 1 as const,
      userId,
      weddingId,
      savedAt: new Date().toISOString(),
    }),
    ...patch,
    version: 1,
    userId,
    weddingId,
    savedAt: new Date().toISOString(),
  }
  await AsyncStorage.setItem(key(userId, weddingId), JSON.stringify(next))
  return next
}

export async function savePulseFieldSnapshot(userId: string, weddingId: string, pulse: FieldModeSnapshot['pulse']) {
  if (!pulse) return
  const safeTasks = pulse.tasks.slice(0, 100).map((task) => ({
    id: task.id,
    title: task.title,
    description: null,
    category: task.category,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    assignee: task.assignee,
  }))
  await mergeSnapshot(userId, weddingId, { pulse: { tasks: safeTasks, budget: pulse.budget } })
}

export async function saveTimelineFieldSnapshot(userId: string, weddingId: string, timeline: PlannerTimelineItem[]) {
  const safeTimeline = timeline.slice(0, 150).map((item) => ({
    ...item,
    description: null,
    responsible: null,
  }))
  await mergeSnapshot(userId, weddingId, { timeline: safeTimeline })
}

export async function readFieldModeSnapshot(userId: string, weddingId: string): Promise<FieldModeSnapshot | null> {
  const raw = await AsyncStorage.getItem(key(userId, weddingId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as FieldModeSnapshot
    if (parsed.version !== 1 || parsed.userId !== userId || parsed.weddingId !== weddingId) return null
    return parsed
  } catch {
    return null
  }
}

export async function clearFieldModeSnapshotsForUser(userId: string) {
  const keys = await AsyncStorage.getAllKeys()
  const owned = keys.filter((value) => value.startsWith(`${FIELD_MODE_PREFIX}:${userId}:`))
  if (owned.length) await AsyncStorage.multiRemove(owned)
}
