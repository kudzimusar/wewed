'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

interface TaskRow {
  id: string
  title: string
  description: string | null
  category: string
  status: string
  priority: string
  dueDate: string | null
  assignee: string | null
}

interface TaskForm {
  title: string
  category: string
  priority: string
  dueDate: string
}

interface PlannerTasksModuleProps {
  tasks: TaskRow[]
  taskForm: TaskForm
  setTaskForm: Dispatch<SetStateAction<TaskForm>>
  saving: boolean
  taskProgressPercent: number
  onAddTask: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onUpdateTaskStatus: (task: TaskRow, status: string) => void | Promise<void>
}

const TASK_CATEGORIES = [
  'venue',
  'catering',
  'attire',
  'decor',
  'photo_video',
  'music',
  'transport',
  'stationery',
  'wedding_day',
  'other',
]

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
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
      <p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">{detail}</p>
    </div>
  )
}

export function PlannerTasksModule({
  tasks,
  taskForm,
  setTaskForm,
  saving,
  taskProgressPercent,
  onAddTask,
  onUpdateTaskStatus,
}: PlannerTasksModuleProps) {
  return (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <form onSubmit={onAddTask} className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div>
            <Label htmlFor="workspace-task-title">Task</Label>
            <Input
              id="workspace-task-title"
              value={taskForm.title}
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Confirm supplier arrival times"
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <div>
            <Label>Category</Label>
            <select
              value={taskForm.category}
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, category: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
            >
              {TASK_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {titleCase(category)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Priority</Label>
            <select
              value={taskForm.priority}
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, priority: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <Label>Due date</Label>
            <Input
              type="date"
              value={taskForm.dueDate}
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
              }
              className="mt-1 border-gold/20 bg-espresso/70"
            />
          </div>
          <Button type="submit" disabled={saving} className="self-end bg-gold text-espresso hover:bg-gold-light">
            <Plus className="size-4" />
            Add
          </Button>
        </form>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-gold/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl">Planning checklist</h2>
              <p className="font-sans text-xs text-champagne/45">
                Track ownership, deadlines, and completion for this wedding.
              </p>
            </div>
            <Badge variant="outline" className="border-gold/25 text-gold">
              {taskProgressPercent}% complete
            </Badge>
          </div>
          <Progress value={taskProgressPercent} className="mt-3 h-1.5 bg-champagne/10 [&>div]:bg-gold" />
        </div>
        <div className="space-y-2 p-4">
          {tasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              detail="Add the first task manually or apply one of your saved plan templates. No couple-specific sample data is inserted automatically."
            />
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="grid gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-sans text-sm font-medium">{task.title}</h3>
                    <Badge variant="outline" className="border-gold/20 text-[10px] text-champagne/55">
                      {titleCase(task.category)}
                    </Badge>
                    <Badge variant="outline" className="border-gold/20 text-[10px] text-champagne/55">
                      {titleCase(task.priority)}
                    </Badge>
                  </div>
                  <p className="mt-1 font-sans text-xs text-champagne/45">
                    {task.assignee || 'Unassigned'} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US') : 'No due date'}
                  </p>
                </div>
                <select
                  value={task.status}
                  onChange={(event) => void onUpdateTaskStatus(task, event.target.value)}
                  className="h-9 rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs"
                >
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  )
}
