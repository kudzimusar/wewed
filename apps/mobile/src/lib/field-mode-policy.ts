import type { PlannerBudgetSummary, PlannerTask } from '@/lib/types'

export interface FieldTimelineItem {
  id: string
  time: string
  title: string
  notes: string
  duration: string
  location: string
  order: number
}

export interface FieldPulseSnapshot {
  tasks: PlannerTask[]
  budget: PlannerBudgetSummary | null
}

export function sanitizePulseFieldSnapshot(pulse: FieldPulseSnapshot): FieldPulseSnapshot {
  return {
    tasks: pulse.tasks.slice(0, 100).map((task) => ({
      id: task.id,
      title: task.title,
      description: null,
      category: task.category,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      assignee: task.assignee,
    })),
    budget: pulse.budget,
  }
}

export function sanitizeTimelineFieldSnapshot(timeline: FieldTimelineItem[]): FieldTimelineItem[] {
  return timeline.slice(0, 150).map((item) => ({
    ...item,
    notes: '',
  }))
}
