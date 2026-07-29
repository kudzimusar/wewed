'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  LayoutGrid,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Store,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'

type WorkspaceTab =
  | 'overview'
  | 'tasks'
  | 'budget'
  | 'vendors'
  | 'guests'
  | 'timeline'
  | 'seating'

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

interface BudgetRow {
  id: string
  category: string
  description: string
  estimatedCost: number
  actualCost: number | null
  paidAmount: number
  currency: string
  dueDate: string | null
}

interface BudgetSummary {
  totalEstimated: number
  totalActual: number
  totalPaid: number
  totalOutstanding: number
  currency: string
  percentPaid: number
}

interface VendorRow {
  id: string
  name: string
  category: string
  contact: string
  contractStatus: string
  paymentStatus: string
  notes: string
  phone: string | null
  website: string | null
}

interface GuestRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  side: string | null
  seatingTableId: string | null
  seatingTableName: string | null
  rsvp: {
    attending: boolean | null
    plusOne: boolean
    kidsAttending: boolean
    kidsCount: number
    checkedIn: boolean
  } | null
}

interface TimelineRow {
  id: string
  time: string
  event: string
  title: string
  notes: string
  duration: string
  location: string
  order: number
}

interface SeatingTableRow {
  id: string
  name: string
  capacity: number
  position: string | null
}

const TABS: Array<{ value: WorkspaceTab; label: string; icon: ReactNode }> = [
  { value: 'overview', label: 'Overview', icon: <CheckCircle2 className="size-3.5" /> },
  { value: 'tasks', label: 'Tasks', icon: <ListChecks className="size-3.5" /> },
  { value: 'budget', label: 'Budget', icon: <CircleDollarSign className="size-3.5" /> },
  { value: 'vendors', label: 'Vendors', icon: <Store className="size-3.5" /> },
  { value: 'guests', label: 'Guests', icon: <Users className="size-3.5" /> },
  { value: 'timeline', label: 'Timeline', icon: <CalendarDays className="size-3.5" /> },
  { value: 'seating', label: 'Seating', icon: <LayoutGrid className="size-3.5" /> },
]

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

const BUDGET_CATEGORIES = [
  'venue',
  'catering',
  'attire',
  'decor',
  'photo_video',
  'music',
  'transport',
  'stationery',
  'miscellaneous',
]

const VENDOR_CATEGORIES = [
  'venue',
  'caterer',
  'photographer',
  'videographer',
  'florist',
  'dj',
  'decor',
  'transport',
  'stationery',
  'other',
]

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Request failed.')
  return payload
}

function money(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
}

function dateText(value: string | null): string {
  if (!value) return 'No due date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
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

export function PlannerWorkspace() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [budget, setBudget] = useState<BudgetRow[]>([])
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [tables, setTables] = useState<SeatingTableRow[]>([])
  const [timeline, setTimeline] = useState<TimelineRow[]>([])

  const [taskForm, setTaskForm] = useState({
    title: '',
    category: 'other',
    priority: 'medium',
    dueDate: '',
  })
  const [budgetForm, setBudgetForm] = useState({
    description: '',
    category: 'miscellaneous',
    estimatedCost: '',
  })
  const [vendorForm, setVendorForm] = useState({
    name: '',
    category: 'other',
    contact: '',
  })
  const [guestForm, setGuestForm] = useState({ name: '', email: '' })
  const [timelineForm, setTimelineForm] = useState({ time: '', event: '', location: '' })
  const [tableForm, setTableForm] = useState({ name: '', capacity: '8' })

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const [taskPayload, budgetPayload, vendorPayload, guestPayload, timelinePayload] =
        await Promise.all([
          api<{ data: TaskRow[] }>('/api/planner/tasks'),
          api<{ data: BudgetRow[]; summary: BudgetSummary }>('/api/planner/budget'),
          api<{ data: VendorRow[] }>('/api/planner/vendors'),
          api<{ data: GuestRow[]; tables: SeatingTableRow[] }>('/api/planner/guests'),
          api<{ data: TimelineRow[] }>('/api/planner/timeline'),
        ])

      setTasks(taskPayload.data ?? [])
      setBudget(budgetPayload.data ?? [])
      setBudgetSummary(budgetPayload.summary ?? null)
      setVendors(vendorPayload.data ?? [])
      setGuests(guestPayload.data ?? [])
      setTables(guestPayload.tables ?? [])
      setTimeline((timelinePayload.data ?? []).sort((a, b) => a.order - b.order))
      setLastUpdated(new Date())
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load planner data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh(true)
    const timer = window.setInterval(() => void refresh(false), 30_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function mutate(
    action: () => Promise<unknown>,
    successTitle: string,
    reset?: () => void,
  ) {
    setSaving(true)
    setError(null)
    try {
      await action()
      reset?.()
      await refresh(false)
      toast({ title: successTitle })
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : 'The change could not be saved.'
      setError(message)
      toast({ title: 'Save failed', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!taskForm.title.trim()) return
    await mutate(
      () =>
        api('/api/planner/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...taskForm,
            title: taskForm.title.trim(),
            dueDate: taskForm.dueDate || null,
            status: 'todo',
          }),
        }),
      'Task added',
      () => setTaskForm({ title: '', category: 'other', priority: 'medium', dueDate: '' }),
    )
  }

  async function updateTaskStatus(task: TaskRow, status: string) {
    const previous = task.status
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status } : item)))
    try {
      await api(`/api/planner/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      toast({ title: 'Task updated', description: task.title })
    } catch (statusError) {
      setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: previous } : item)))
      toast({
        title: 'Update failed',
        description: statusError instanceof Error ? statusError.message : undefined,
        variant: 'destructive',
      })
    }
  }

  async function addBudgetItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!budgetForm.description.trim()) return
    await mutate(
      () =>
        api('/api/planner/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: budgetForm.description.trim(),
            category: budgetForm.category,
            estimatedCost: Number(budgetForm.estimatedCost || 0),
            currency: 'USD',
          }),
        }),
      'Budget item added',
      () => setBudgetForm({ description: '', category: 'miscellaneous', estimatedCost: '' }),
    )
  }

  async function updateBudgetItem(item: BudgetRow, field: 'actualCost' | 'paidAmount', value: string) {
    const parsed = Number(value || 0)
    if (!Number.isFinite(parsed) || parsed < 0) return
    await mutate(
      () =>
        api(`/api/planner/budget/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: parsed }),
        }),
      field === 'paidAmount' ? 'Payment updated' : 'Actual cost updated',
    )
  }

  async function addVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!vendorForm.name.trim()) return
    await mutate(
      () =>
        api('/api/planner/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: vendorForm.name.trim(),
            category: vendorForm.category,
            contact: vendorForm.contact.trim(),
          }),
        }),
      'Vendor added',
      () => setVendorForm({ name: '', category: 'other', contact: '' }),
    )
  }

  async function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!guestForm.name.trim()) return
    await mutate(
      () =>
        api('/api/planner/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'guest',
            name: guestForm.name.trim(),
            email: guestForm.email.trim() || null,
          }),
        }),
      'Guest added',
      () => setGuestForm({ name: '', email: '' }),
    )
  }

  async function addTimelineItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!timelineForm.time || !timelineForm.event.trim()) return
    await mutate(
      () =>
        api('/api/planner/timeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            time: timelineForm.time,
            event: timelineForm.event.trim(),
            location: timelineForm.location.trim(),
          }),
        }),
      'Timeline item added',
      () => setTimelineForm({ time: '', event: '', location: '' }),
    )
  }

  async function addTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tableForm.name.trim()) return
    await mutate(
      () =>
        api('/api/planner/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'table',
            tableName: tableForm.name.trim(),
            capacity: Number(tableForm.capacity || 8),
          }),
        }),
      'Seating table added',
      () => setTableForm({ name: '', capacity: '8' }),
    )
  }

  const taskStats = useMemo(() => {
    const done = tasks.filter((task) => task.status === 'done').length
    const blocked = tasks.filter((task) => task.status === 'blocked').length
    const overdue = tasks.filter((task) => {
      if (!task.dueDate || task.status === 'done') return false
      return new Date(task.dueDate).getTime() < Date.now()
    }).length
    return {
      done,
      blocked,
      overdue,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    }
  }, [tasks])

  const guestStats = useMemo(() => {
    const confirmed = guests.filter((guest) => guest.rsvp?.attending === true).length
    const pending = guests.filter((guest) => guest.rsvp?.attending == null).length
    const heads = guests.reduce((total, guest) => {
      if (guest.rsvp?.attending !== true) return total
      return total + 1 + (guest.rsvp.plusOne ? 1 : 0) + (guest.rsvp.kidsAttending ? guest.rsvp.kidsCount : 0)
    }, 0)
    return { confirmed, pending, heads }
  }, [guests])

  const tableOccupancy = useMemo(() => {
    const counts = new Map<string, number>()
    for (const guest of guests) {
      if (!guest.seatingTableId || guest.rsvp?.attending !== true) continue
      const party = 1 + (guest.rsvp.plusOne ? 1 : 0) + (guest.rsvp.kidsAttending ? guest.rsvp.kidsCount : 0)
      counts.set(guest.seatingTableId, (counts.get(guest.seatingTableId) ?? 0) + party)
    }
    return counts
  }, [guests])

  return (
    <div className="flex h-full min-h-0 flex-col bg-espresso text-champagne">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gold/15 bg-espresso/95 px-3 py-2 sm:px-5">
        <div className="min-w-0 overflow-x-auto">
          <nav className="flex min-w-max items-center gap-1" aria-label="Planner workspace sections">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-sans text-[11px] transition-colors ${
                  activeTab === tab.value
                    ? 'border-gold/35 bg-gold/12 text-gold'
                    : 'border-transparent text-champagne/55 hover:border-gold/15 hover:text-champagne'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh(true)}
          disabled={loading}
          className="shrink-0 border-gold/25 bg-transparent text-champagne/65 hover:bg-gold/10 hover:text-gold"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-7xl space-y-5 pb-28">
          {error && (
            <div className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 font-sans text-sm text-clay-light">
              {error}
            </div>
          )}

          {loading && !lastUpdated ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <Loader2 className="size-7 animate-spin text-gold" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Task progress', `${taskStats.percent}%`, `${taskStats.done} of ${tasks.length} complete`],
                      ['Budget outstanding', money(budgetSummary?.totalOutstanding ?? 0, budgetSummary?.currency), `${money(budgetSummary?.totalPaid ?? 0, budgetSummary?.currency)} paid`],
                      ['Confirmed guests', String(guestStats.confirmed), `${guestStats.heads} confirmed seats`],
                      ['Vendor pipeline', String(vendors.length), `${vendors.filter((vendor) => vendor.contractStatus === 'signed').length} signed`],
                    ].map(([label, value, detail]) => (
                      <SectionCard key={label} className="p-4">
                        <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-gold/65">{label}</p>
                        <p className="mt-2 font-serif text-3xl text-champagne">{value}</p>
                        <p className="mt-1 font-sans text-xs text-champagne/45">{detail}</p>
                      </SectionCard>
                    ))}
                  </div>

                  <SectionCard className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-serif text-xl">Planning readiness</h2>
                        <p className="mt-1 font-sans text-xs text-champagne/50">
                          This workspace uses only the selected wedding’s saved records. Empty weddings stay empty until a planner adds data, imports a file, or applies a template.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-gold/25 bg-gold/5 text-gold">
                        {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Not synced'}
                      </Badge>
                    </div>
                    <Progress value={taskStats.percent} className="mt-5 h-2 bg-champagne/10 [&>div]:bg-gold" />
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-gold/10 p-3">
                        <p className="font-sans text-xs text-champagne/50">Overdue tasks</p>
                        <p className="mt-1 font-serif text-2xl">{taskStats.overdue}</p>
                      </div>
                      <div className="rounded-xl border border-gold/10 p-3">
                        <p className="font-sans text-xs text-champagne/50">Blocked tasks</p>
                        <p className="mt-1 font-serif text-2xl">{taskStats.blocked}</p>
                      </div>
                      <div className="rounded-xl border border-gold/10 p-3">
                        <p className="font-sans text-xs text-champagne/50">Pending RSVPs</p>
                        <p className="mt-1 font-serif text-2xl">{guestStats.pending}</p>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  <SectionCard className="p-4">
                    <form onSubmit={addTask} className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                      <div>
                        <Label htmlFor="workspace-task-title">Task</Label>
                        <Input id="workspace-task-title" value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="Confirm supplier arrival times" className="mt-1 border-gold/20 bg-espresso/70" />
                      </div>
                      <div>
                        <Label>Category</Label>
                        <select value={taskForm.category} onChange={(event) => setTaskForm((current) => ({ ...current, category: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">
                          {TASK_CATEGORIES.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <select value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">
                          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="workspace-task-date">Due date</Label>
                        <Input id="workspace-task-date" type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" />
                      </div>
                      <Button type="submit" disabled={saving || !taskForm.title.trim()} className="self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button>
                    </form>
                  </SectionCard>

                  {tasks.length === 0 ? <EmptyState title="No tasks yet" detail="Apply a planner template in Daily Ops, import a checklist, or add the first task above. No couple-specific sample data is inserted automatically." /> : (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <SectionCard key={task.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={`font-sans text-sm ${task.status === 'done' ? 'text-champagne/45 line-through' : 'text-champagne'}`}>{task.title}</p>
                              <Badge variant="outline" className="border-gold/20 text-gold/80">{titleCase(task.priority)}</Badge>
                            </div>
                            <p className="mt-1 font-sans text-xs text-champagne/45">{titleCase(task.category)} · {dateText(task.dueDate)}{task.assignee ? ` · ${task.assignee}` : ''}</p>
                          </div>
                          <select value={task.status} onChange={(event) => void updateTaskStatus(task, event.target.value)} className="h-9 rounded-md border border-gold/20 bg-espresso px-3 font-sans text-xs">
                            <option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option>
                          </select>
                        </SectionCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'budget' && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Estimated', budgetSummary?.totalEstimated ?? 0],
                      ['Actual', budgetSummary?.totalActual ?? 0],
                      ['Paid', budgetSummary?.totalPaid ?? 0],
                      ['Outstanding', budgetSummary?.totalOutstanding ?? 0],
                    ].map(([label, value]) => (
                      <SectionCard key={String(label)} className="p-4"><p className="font-sans text-[10px] uppercase tracking-[0.15em] text-gold/65">{label}</p><p className="mt-2 font-serif text-2xl">{money(Number(value), budgetSummary?.currency)}</p></SectionCard>
                    ))}
                  </div>
                  <SectionCard className="p-4">
                    <form onSubmit={addBudgetItem} className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]">
                      <div><Label>Description</Label><Input value={budgetForm.description} onChange={(event) => setBudgetForm((current) => ({ ...current, description: event.target.value }))} placeholder="Venue deposit" className="mt-1 border-gold/20 bg-espresso/70" /></div>
                      <div><Label>Category</Label><select value={budgetForm.category} onChange={(event) => setBudgetForm((current) => ({ ...current, category: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{BUDGET_CATEGORIES.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}</select></div>
                      <div><Label>Estimate (USD)</Label><Input type="number" min="0" step="0.01" value={budgetForm.estimatedCost} onChange={(event) => setBudgetForm((current) => ({ ...current, estimatedCost: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
                      <Button type="submit" disabled={saving || !budgetForm.description.trim()} className="self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button>
                    </form>
                  </SectionCard>
                  {budget.length === 0 ? <EmptyState title="No budget items" detail="Add the working budget manually or import it. The planner no longer creates a sample budget for another couple." /> : (
                    <div className="overflow-x-auto rounded-2xl border border-gold/15">
                      <table className="w-full min-w-[760px] text-left font-sans text-sm">
                        <thead className="bg-gold/[0.06] text-[10px] uppercase tracking-[0.14em] text-gold/70"><tr><th className="p-3">Item</th><th className="p-3">Estimate</th><th className="p-3">Actual</th><th className="p-3">Paid</th><th className="p-3">Due</th></tr></thead>
                        <tbody>{budget.map((item) => <tr key={item.id} className="border-t border-gold/10"><td className="p-3"><p className="text-champagne">{item.description}</p><p className="text-xs text-champagne/40">{titleCase(item.category)}</p></td><td className="p-3">{money(item.estimatedCost, item.currency)}</td><td className="p-3"><Input key={`${item.id}-actual-${item.actualCost}`} type="number" min="0" defaultValue={item.actualCost ?? ''} placeholder="0" onBlur={(event) => void updateBudgetItem(item, 'actualCost', event.target.value)} className="w-28 border-gold/20 bg-espresso/70" /></td><td className="p-3"><Input key={`${item.id}-paid-${item.paidAmount}`} type="number" min="0" defaultValue={item.paidAmount} onBlur={(event) => void updateBudgetItem(item, 'paidAmount', event.target.value)} className="w-28 border-gold/20 bg-espresso/70" /></td><td className="p-3 text-xs text-champagne/50">{dateText(item.dueDate)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'vendors' && (
                <div className="space-y-4">
                  <SectionCard className="p-4"><form onSubmit={addVendor} className="grid gap-3 lg:grid-cols-[2fr_1fr_1.5fr_auto]"><div><Label>Name</Label><Input value={vendorForm.name} onChange={(event) => setVendorForm((current) => ({ ...current, name: event.target.value }))} placeholder="Supplier name" className="mt-1 border-gold/20 bg-espresso/70" /></div><div><Label>Category</Label><select value={vendorForm.category} onChange={(event) => setVendorForm((current) => ({ ...current, category: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{VENDOR_CATEGORIES.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}</select></div><div><Label>Contact</Label><Input value={vendorForm.contact} onChange={(event) => setVendorForm((current) => ({ ...current, contact: event.target.value }))} placeholder="Name or email" className="mt-1 border-gold/20 bg-espresso/70" /></div><Button type="submit" disabled={saving || !vendorForm.name.trim()} className="self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button></form></SectionCard>
                  {vendors.length === 0 ? <EmptyState title="No vendors yet" detail="Add a supplier here, import a vendor list, or use Team Hub to manage procurement and approvals." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{vendors.map((vendor) => <SectionCard key={vendor.id} className="p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-serif text-lg">{vendor.name}</p><p className="mt-1 font-sans text-xs text-champagne/45">{titleCase(vendor.category)}</p></div><Badge variant="outline" className="border-gold/20 text-gold/80">{titleCase(vendor.contractStatus || 'pending')}</Badge></div><p className="mt-3 font-sans text-xs text-champagne/55">{vendor.contact || vendor.phone || vendor.website || 'No contact recorded'}</p><p className="mt-2 font-sans text-xs text-champagne/40">Payment: {titleCase(vendor.paymentStatus || 'unpaid')}</p></SectionCard>)}</div>}
                </div>
              )}

              {activeTab === 'guests' && (
                <div className="space-y-4">
                  <SectionCard className="p-4"><form onSubmit={addGuest} className="grid gap-3 lg:grid-cols-[2fr_2fr_auto]"><div><Label>Name</Label><Input value={guestForm.name} onChange={(event) => setGuestForm((current) => ({ ...current, name: event.target.value }))} placeholder="Guest name" className="mt-1 border-gold/20 bg-espresso/70" /></div><div><Label>Email</Label><Input type="email" value={guestForm.email} onChange={(event) => setGuestForm((current) => ({ ...current, email: event.target.value }))} placeholder="guest@example.com" className="mt-1 border-gold/20 bg-espresso/70" /></div><Button type="submit" disabled={saving || !guestForm.name.trim()} className="self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button></form></SectionCard>
                  {guests.length === 0 ? <EmptyState title="No guests yet" detail="Add guests, import a guest list, or export RSVP links after records are created." /> : <div className="overflow-x-auto rounded-2xl border border-gold/15"><table className="w-full min-w-[700px] text-left font-sans text-sm"><thead className="bg-gold/[0.06] text-[10px] uppercase tracking-[0.14em] text-gold/70"><tr><th className="p-3">Guest</th><th className="p-3">RSVP</th><th className="p-3">Side</th><th className="p-3">Table</th><th className="p-3">Check-in</th></tr></thead><tbody>{guests.map((guest) => <tr key={guest.id} className="border-t border-gold/10"><td className="p-3"><p>{guest.name}</p><p className="text-xs text-champagne/40">{guest.email || guest.phone || 'No contact'}</p></td><td className="p-3">{guest.rsvp?.attending === true ? <Badge className="bg-sage/20 text-sage-light">Attending</Badge> : guest.rsvp?.attending === false ? <Badge className="bg-clay/20 text-clay-light">Declined</Badge> : <Badge variant="outline" className="border-gold/20 text-gold/70">Pending</Badge>}</td><td className="p-3 text-champagne/55">{titleCase(guest.side || 'neutral')}</td><td className="p-3 text-champagne/55">{guest.seatingTableName || 'Unassigned'}</td><td className="p-3 text-champagne/55">{guest.rsvp?.checkedIn ? 'Checked in' : 'Not checked in'}</td></tr>)}</tbody></table></div>}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <SectionCard className="p-4"><form onSubmit={addTimelineItem} className="grid gap-3 lg:grid-cols-[1fr_2fr_2fr_auto]"><div><Label>Time</Label><Input type="time" value={timelineForm.time} onChange={(event) => setTimelineForm((current) => ({ ...current, time: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div><div><Label>Event</Label><Input value={timelineForm.event} onChange={(event) => setTimelineForm((current) => ({ ...current, event: event.target.value }))} placeholder="Ceremony begins" className="mt-1 border-gold/20 bg-espresso/70" /></div><div><Label>Location</Label><Input value={timelineForm.location} onChange={(event) => setTimelineForm((current) => ({ ...current, location: event.target.value }))} placeholder="Main ceremony space" className="mt-1 border-gold/20 bg-espresso/70" /></div><Button type="submit" disabled={saving || !timelineForm.time || !timelineForm.event.trim()} className="self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button></form></SectionCard>
                  {timeline.length === 0 ? <EmptyState title="No timeline items" detail="Build the day-of run sheet here or apply the Wedding Day Run Sheet template in Daily Ops." /> : <div className="space-y-2">{timeline.map((item) => <SectionCard key={item.id} className="flex gap-4 p-4"><div className="w-20 shrink-0 font-serif text-xl text-gold">{item.time}</div><div><p className="font-sans text-sm">{item.event}</p><p className="mt-1 font-sans text-xs text-champagne/45">{[item.location, item.duration, item.notes].filter(Boolean).join(' · ') || 'No additional details'}</p></div></SectionCard>)}</div>}
                </div>
              )}

              {activeTab === 'seating' && (
                <div className="space-y-4">
                  <SectionCard className="p-4"><form onSubmit={addTable} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]"><div><Label>Table name</Label><Input value={tableForm.name} onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))} placeholder="Table 1" className="mt-1 border-gold/20 bg-espresso/70" /></div><div><Label>Capacity</Label><Input type="number" min="1" max="50" value={tableForm.capacity} onChange={(event) => setTableForm((current) => ({ ...current, capacity: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div><Button type="submit" disabled={saving || !tableForm.name.trim()} className="self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button></form></SectionCard>
                  {tables.length === 0 ? <EmptyState title="No seating tables" detail="Add tables manually or use Daily Ops to preview and apply automatic assignments for confirmed guests." /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{tables.map((table) => { const occupied = tableOccupancy.get(table.id) ?? 0; const percent = table.capacity ? Math.min(100, Math.round((occupied / table.capacity) * 100)) : 0; return <SectionCard key={table.id} className="p-4"><div className="flex items-center justify-between gap-2"><p className="font-serif text-lg">{table.name}</p><Badge variant="outline" className={occupied > table.capacity ? 'border-clay/40 text-clay-light' : 'border-gold/20 text-gold/80'}>{occupied}/{table.capacity}</Badge></div><Progress value={percent} className="mt-4 h-1.5 bg-champagne/10 [&>div]:bg-gold" /><p className="mt-3 font-sans text-xs text-champagne/45">{table.position || 'Position not set'}</p></SectionCard> })}</div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
