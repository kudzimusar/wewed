'use client'

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Check, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { usePlannerFilterState } from '@/lib/planner-filter-state'
import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'

export interface TaskRow {
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
  assignee: string
}

export interface TaskUpdate {
  title: string
  description: string | null
  category: string
  priority: string
  dueDate: string | null
  assignee: string | null
}

interface PlannerTasksModuleProps {
  tasks: TaskRow[]
  taskForm: TaskForm
  setTaskForm: Dispatch<SetStateAction<TaskForm>>
  saving: boolean
  taskProgressPercent: number
  onAddTask: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onUpdateTask: (task: TaskRow, updates: TaskUpdate) => Promise<boolean>
  onUpdateTaskStatus: (task: TaskRow, status: string) => void | Promise<void>
  onDeleteTask: (task: TaskRow) => void | Promise<void>
}

const TASK_CATEGORIES = [
  { value: 'all', label: 'All categories' },
  { value: 'timeline_12_18', label: '12–18 Months Before' },
  { value: 'timeline_9_12', label: '9–12 Months Before' },
  { value: 'timeline_6_9', label: '6–9 Months Before' },
  { value: 'timeline_3_6', label: '3–6 Months Before' },
  { value: 'timeline_2mo', label: '2 Months Before' },
  { value: 'timeline_1mo', label: '1 Month Before' },
  { value: 'timeline_2wk', label: '2 Weeks Before' },
  { value: 'timeline_1wk', label: '1 Week Before' },
  { value: 'wedding_day', label: 'Wedding Day' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'roora', label: 'Roora' },
  { value: 'magumo', label: 'Magumo' },
  { value: 'venue', label: 'Venue' },
  { value: 'catering', label: 'Catering' },
  { value: 'attire', label: 'Attire' },
  { value: 'transport', label: 'Transport' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'decor', label: 'Decor' },
  { value: 'photo_video', label: 'Photo/Video' },
  { value: 'music', label: 'Music' },
  { value: 'other', label: 'Other' },
] as const

const TASK_STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
] as const

function categoryLabel(value: string): string {
  return TASK_CATEGORIES.find((category) => category.value === value)?.label ?? titleCase(value)
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function dateText(value: string | null): string {
  if (!value) return 'No due date'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US')
}

function dateInput(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center"><p className="font-serif text-lg text-champagne">{title}</p><p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">{detail}</p></div>
}

export function PlannerTasksModule({
  tasks,
  taskForm,
  setTaskForm,
  saving,
  taskProgressPercent,
  onAddTask,
  onUpdateTask,
  onUpdateTaskStatus,
  onDeleteTask,
}: PlannerTasksModuleProps) {
  const [filters, setFilters, resetFilters] = usePlannerFilterState('wewed:planner:tasks:filters', {
    search: '', category: 'all', status: 'all',
  })
  const [titleError, setTitleError] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTask, setEditTask] = useState<TaskUpdate>({
    title: '', description: null, category: 'venue', priority: 'medium', dueDate: null, assignee: null,
  })
  const [editError, setEditError] = useState<string | null>(null)

  const filteredTasks = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return tasks.filter((task) => {
      if (filters.category !== 'all' && task.category !== filters.category) return false
      if (filters.status !== 'all' && task.status !== filters.status) return false
      return !query || [task.title, task.description ?? '', task.assignee ?? ''].some((value) => value.toLowerCase().includes(query))
    })
  }, [tasks, filters])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) counts.set(task.category, (counts.get(task.category) ?? 0) + 1)
    return counts
  }, [tasks])

  function submitTask(event: FormEvent<HTMLFormElement>) {
    const error = plannerTitleError(taskForm.title)
    if (error) {
      event.preventDefault()
      setTitleError(error)
      return
    }
    setTitleError(null)
    void onAddTask(event)
  }

  function startEdit(task: TaskRow) {
    setEditingTaskId(task.id)
    setEditError(null)
    setEditTask({
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      dueDate: dateInput(task.dueDate) || null,
      assignee: task.assignee,
    })
  }

  async function saveEdit(task: TaskRow) {
    const error = plannerTitleError(editTask.title)
    if (error) {
      setEditError(error)
      return
    }
    const saved = await onUpdateTask(task, {
      ...editTask,
      title: normalizePlannerTitle(editTask.title),
      description: editTask.description?.trim() || null,
      dueDate: editTask.dueDate || null,
      assignee: editTask.assignee?.trim() || null,
    })
    if (saved) {
      setEditingTaskId(null)
      setEditError(null)
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <form onSubmit={submitTask} className="grid gap-3 lg:grid-cols-[2fr_1.25fr_1fr_1fr_1.25fr_auto]">
          <div>
            <Label htmlFor="workspace-task-title">Task</Label>
            <Input
              id="workspace-task-title"
              value={taskForm.title}
              onChange={(event) => { setTaskForm((current) => ({ ...current, title: event.target.value })); if (titleError) setTitleError(plannerTitleError(event.target.value)) }}
              placeholder="Confirm supplier arrival times"
              aria-invalid={Boolean(titleError)}
              aria-describedby={titleError ? 'workspace-task-title-error' : undefined}
              className="mt-1 border-gold/20 bg-espresso/70"
            />
            {titleError && <p id="workspace-task-title-error" role="alert" className="mt-1 font-sans text-xs text-clay-light">{titleError}</p>}
          </div>
          <div><Label htmlFor="workspace-task-category">Category</Label><select id="workspace-task-category" value={taskForm.category} onChange={(event) => setTaskForm((current) => ({ ...current, category: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{TASK_CATEGORIES.filter((category) => category.value !== 'all').map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
          <div><Label htmlFor="workspace-task-priority">Priority</Label><select id="workspace-task-priority" value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          <div><Label htmlFor="workspace-task-due-date">Due date</Label><Input id="workspace-task-due-date" type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
          <div><Label htmlFor="workspace-task-assignee">Assignee</Label><Input id="workspace-task-assignee" value={taskForm.assignee} onChange={(event) => setTaskForm((current) => ({ ...current, assignee: event.target.value }))} placeholder="Couple, family, coordinator…" className="mt-1 border-gold/20 bg-espresso/70" /></div>
          <Button type="submit" disabled={saving} className="self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button>
        </form>
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="border-b border-gold/10 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-xl">Planning checklist</h2><p className="font-sans text-xs text-champagne/45">Track ownership, deadlines, and completion for this wedding.</p></div><Badge variant="outline" className="border-gold/25 text-gold">{taskProgressPercent}% complete</Badge></div><Progress value={taskProgressPercent} className="mt-3 h-1.5 bg-champagne/10 [&>div]:bg-gold" /></div>
        <div className="grid gap-3 border-b border-gold/10 p-4 lg:grid-cols-[minmax(0,1fr)_14rem_12rem_auto]">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search tasks, descriptions, or assignees" className="border-gold/20 bg-espresso/70 pl-9" /></div>
          <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} aria-label="Filter tasks by category" className="h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{TASK_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}{category.value === 'all' ? ` (${tasks.length})` : ` (${categoryCounts.get(category.value) ?? 0})`}</option>)}</select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="Filter tasks by status" className="h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{TASK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
          <Button type="button" variant="outline" onClick={resetFilters} className="border-gold/20 bg-transparent text-champagne/60">Reset</Button>
        </div>

        <div className="space-y-2 p-4">
          {tasks.length === 0 ? <EmptyState title="No tasks yet" detail="Add the first task manually or apply one of your saved plan templates. No couple-specific sample data is inserted automatically." /> : filteredTasks.length === 0 ? <EmptyState title="No tasks in this view" detail="Clear the search or filters to see the rest of the checklist." /> : filteredTasks.map((task) => {
            const editing = editingTaskId === task.id
            return <div key={task.id} className="rounded-xl border border-gold/10 bg-espresso/45 p-3">
              {editing ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1.3fr_1fr_1fr_1.3fr]">
                    <div><Label htmlFor={`task-edit-title-${task.id}`}>Task</Label><Input id={`task-edit-title-${task.id}`} value={editTask.title} onChange={(event) => { setEditTask((current) => ({ ...current, title: event.target.value })); setEditError(plannerTitleError(event.target.value)) }} aria-invalid={Boolean(editError)} className="mt-1 border-gold/20 bg-espresso/70" /></div>
                    <div><Label>Category</Label><select value={editTask.category} aria-label={`Edit category for ${task.title}`} onChange={(event) => setEditTask((current) => ({ ...current, category: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{TASK_CATEGORIES.filter((category) => category.value !== 'all').map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
                    <div><Label>Priority</Label><select value={editTask.priority} aria-label={`Edit priority for ${task.title}`} onChange={(event) => setEditTask((current) => ({ ...current, priority: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                    <div><Label>Due date</Label><Input type="date" aria-label={`Edit due date for ${task.title}`} value={editTask.dueDate ?? ''} onChange={(event) => setEditTask((current) => ({ ...current, dueDate: event.target.value || null }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
                    <div><Label>Assignee</Label><Input aria-label={`Edit assignee for ${task.title}`} value={editTask.assignee ?? ''} onChange={(event) => setEditTask((current) => ({ ...current, assignee: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
                  </div>
                  <div><Label>Description</Label><Input aria-label={`Edit description for ${task.title}`} value={editTask.description ?? ''} onChange={(event) => setEditTask((current) => ({ ...current, description: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
                  {editError && <p role="alert" className="font-sans text-xs text-clay-light">{editError}</p>}
                  <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditingTaskId(null)}><X className="size-4" />Cancel</Button><Button type="button" disabled={saving} onClick={() => void saveEdit(task)} className="bg-gold text-espresso"><Check className="size-4" />Save task</Button></div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-sans text-sm font-medium">{task.title}</h3><Badge variant="outline" className="border-gold/20 text-[10px] text-champagne/55">{categoryLabel(task.category)}</Badge><Badge variant="outline" className="border-gold/20 text-[10px] text-champagne/55">{titleCase(task.priority)}</Badge></div>{task.description && <p className="mt-1 font-sans text-xs text-champagne/55">{task.description}</p>}<div className="mt-1 flex flex-wrap items-center gap-2 font-sans text-xs text-champagne/45"><span className="inline-flex items-center gap-1"><UserRound className="size-3" />{task.assignee || 'Unassigned'}</span><span>· {dateText(task.dueDate)}</span></div></div><div className="flex items-center gap-2"><select value={task.status} onChange={(event) => void onUpdateTaskStatus(task, event.target.value)} aria-label={`Update status for ${task.title}`} className="h-9 rounded-md border border-gold/20 bg-espresso px-2 font-sans text-xs"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option></select><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${task.title}`} disabled={saving} onClick={() => startEdit(task)} className="size-9 text-champagne/50 hover:text-gold"><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${task.title}`} disabled={saving} onClick={() => { if (window.confirm(`Delete task “${task.title}”?`)) void onDeleteTask(task) }} className="size-9 text-champagne/45 hover:bg-clay/10 hover:text-clay-light"><Trash2 className="size-4" /></Button></div></div>
              )}
            </div>
          })}
        </div>
      </SectionCard>
    </div>
  )
}
