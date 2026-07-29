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
  LayoutGrid,
  ListChecks,
  Loader2,
  RefreshCw,
  Store,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PlannerBudgetModule } from '@/components/wedding/planner/modules/planner-budget-module'
import { PlannerGuestsModule } from '@/components/wedding/planner/modules/planner-guests-module'
import { PlannerSeatingModule } from '@/components/wedding/planner/modules/planner-seating-module'
import { PlannerTasksModule } from '@/components/wedding/planner/modules/planner-tasks-module'
import { PlannerTimelineModule } from '@/components/wedding/planner/modules/planner-timeline-module'
import { PlannerVendorsModule } from '@/components/wedding/planner/modules/planner-vendors-module'
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

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>
      {children}
    </section>
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
      const message =
        mutationError instanceof Error ? mutationError.message : 'The change could not be saved.'
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
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status } : item)),
    )
    try {
      await api(`/api/planner/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      toast({ title: 'Task updated', description: task.title })
    } catch (statusError) {
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, status: previous } : item)),
      )
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
      () =>
        setBudgetForm({ description: '', category: 'miscellaneous', estimatedCost: '' }),
    )
  }

  async function updateBudgetItem(
    item: BudgetRow,
    field: 'actualCost' | 'paidAmount',
    value: string,
  ) {
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
      return (
        total +
        1 +
        (guest.rsvp.plusOne ? 1 : 0) +
        (guest.rsvp.kidsAttending ? guest.rsvp.kidsCount : 0)
      )
    }, 0)
    return { confirmed, pending, heads }
  }, [guests])

  const tableOccupancy = useMemo(() => {
    const counts = new Map<string, number>()
    for (const guest of guests) {
      if (!guest.seatingTableId || guest.rsvp?.attending !== true) continue
      const party =
        1 +
        (guest.rsvp.plusOne ? 1 : 0) +
        (guest.rsvp.kidsAttending ? guest.rsvp.kidsCount : 0)
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
                      [
                        'Task progress',
                        `${taskStats.percent}%`,
                        `${taskStats.done} of ${tasks.length} complete`,
                      ],
                      [
                        'Budget outstanding',
                        money(
                          budgetSummary?.totalOutstanding ?? 0,
                          budgetSummary?.currency,
                        ),
                        `${money(
                          budgetSummary?.totalPaid ?? 0,
                          budgetSummary?.currency,
                        )} paid`,
                      ],
                      [
                        'Confirmed guests',
                        String(guestStats.confirmed),
                        `${guestStats.heads} confirmed seats`,
                      ],
                      [
                        'Vendor pipeline',
                        String(vendors.length),
                        `${vendors.filter((vendor) => vendor.contractStatus === 'signed').length} signed`,
                      ],
                    ].map(([label, value, detail]) => (
                      <SectionCard key={label} className="p-4">
                        <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-gold/65">
                          {label}
                        </p>
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
                          This workspace uses only the selected wedding’s saved records. Empty
                          weddings stay empty until a planner adds data, imports a file, or applies
                          a template.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-gold/25 bg-gold/5 text-gold">
                        {lastUpdated
                          ? `Updated ${lastUpdated.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}`
                          : 'Not synced'}
                      </Badge>
                    </div>
                    <Progress
                      value={taskStats.percent}
                      className="mt-5 h-2 bg-champagne/10 [&>div]:bg-gold"
                    />
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
                <PlannerTasksModule
                  tasks={tasks}
                  taskForm={taskForm}
                  setTaskForm={setTaskForm}
                  saving={saving}
                  taskProgressPercent={taskStats.percent}
                  onAddTask={addTask}
                  onUpdateTaskStatus={updateTaskStatus}
                />
              )}

              {activeTab === 'budget' && (
                <PlannerBudgetModule
                  budget={budget}
                  budgetSummary={budgetSummary}
                  budgetForm={budgetForm}
                  setBudgetForm={setBudgetForm}
                  saving={saving}
                  onAddBudgetItem={addBudgetItem}
                  onUpdateBudgetItem={updateBudgetItem}
                />
              )}

              {activeTab === 'vendors' && (
                <PlannerVendorsModule
                  vendors={vendors}
                  vendorForm={vendorForm}
                  setVendorForm={setVendorForm}
                  saving={saving}
                  onAddVendor={addVendor}
                />
              )}

              {activeTab === 'guests' && (
                <PlannerGuestsModule
                  guests={guests}
                  guestForm={guestForm}
                  setGuestForm={setGuestForm}
                  guestStats={guestStats}
                  saving={saving}
                  onAddGuest={addGuest}
                />
              )}

              {activeTab === 'timeline' && (
                <PlannerTimelineModule
                  timeline={timeline}
                  timelineForm={timelineForm}
                  setTimelineForm={setTimelineForm}
                  saving={saving}
                  onAddTimelineItem={addTimelineItem}
                />
              )}

              {activeTab === 'seating' && (
                <PlannerSeatingModule
                  tables={tables}
                  tableForm={tableForm}
                  setTableForm={setTableForm}
                  tableOccupancy={tableOccupancy}
                  saving={saving}
                  onAddTable={addTable}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
