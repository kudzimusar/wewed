'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  HandHeart,
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
import { PlannerContributionsWorkspace } from '@/components/wedding/planner/planner-contributions-workspace'
import {
  PlannerGuestsModule,
  type GuestForm,
  type GuestRow,
  type GuestStats,
  type GuestUpdate,
} from '@/components/wedding/planner/modules/planner-guests-module'
import {
  PlannerSeatingModule,
  type SeatingTableRow,
} from '@/components/wedding/planner/modules/planner-seating-module'
import { PlannerTasksModule, type TaskUpdate } from '@/components/wedding/planner/modules/planner-tasks-module'
import {
  PlannerTimelineModule,
  type TimelineInput,
  type TimelineRow,
} from '@/components/wedding/planner/modules/planner-timeline-module'
import {
  PlannerVendorsModule,
  type VendorForm,
  type VendorRow,
  type VendorUpdate,
} from '@/components/wedding/planner/modules/planner-vendors-module'
import { useToast } from '@/hooks/use-toast'
import { normalizePlannerTitle, plannerTitleError } from '@/lib/planner-task-validation'
import { PLANNER_REFRESH_EVENT } from '@/lib/planner-workspace-events'

export type WorkspaceTab =
  | 'overview'
  | 'tasks'
  | 'budget'
  | 'vendors'
  | 'guests'
  | 'timeline'
  | 'seating'
  | 'contributions'

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
  vendorId: string | null
  vendorName: string | null
  notes: string | null
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

interface CategoryBreakdown {
  category: string
  estimated: number
  actual: number
  paid: number
  outstanding: number
  count: number
}

interface ContributionOverviewSummary {
  currency: string
  cashReceived: number
  directVendorPaid: number
  inKindValue: number
  pledged: number
  availableCash: number
}

interface ContributionOverviewCounts {
  contributors: number
  pledged: number
  overdue: number
  unverified: number
  toThank: number
}

const TABS: Array<{ value: WorkspaceTab; label: string; icon: ReactNode }> = [
  { value: 'overview', label: 'Overview', icon: <CheckCircle2 className="size-3.5" /> },
  { value: 'tasks', label: 'Tasks', icon: <ListChecks className="size-3.5" /> },
  { value: 'budget', label: 'Budget', icon: <CircleDollarSign className="size-3.5" /> },
  { value: 'contributions', label: 'Contributions', icon: <HandHeart className="size-3.5" /> },
  { value: 'vendors', label: 'Vendors', icon: <Store className="size-3.5" /> },
  { value: 'guests', label: 'Guests', icon: <Users className="size-3.5" /> },
  { value: 'timeline', label: 'Timeline', icon: <CalendarDays className="size-3.5" /> },
  { value: 'seating', label: 'Seating', icon: <LayoutGrid className="size-3.5" /> },
]

class PlannerApiError extends Error {
  field?: string
  constructor(message: string, field?: string) {
    super(message)
    this.name = 'PlannerApiError'
    this.field = field
  }
}

function isRequestCancellation(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true
  return error instanceof DOMException && error.name === 'AbortError'
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = (await response.json().catch(() => null)) as (T & { error?: string; field?: string }) | null
  if (!payload) {
    throw new PlannerApiError(
      response.ok ? 'Wewed returned an unexpected response. Please retry.' : `Request failed (${response.status}).`,
    )
  }
  if (!response.ok) throw new PlannerApiError(payload.error || 'Request failed.', payload.field)
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>
      {children}
    </section>
  )
}

const EMPTY_VENDOR_FORM: VendorForm = {
  name: '',
  category: 'photographer',
  contact: '',
  phone: '',
  email: '',
  website: '',
  contractStatus: 'pending',
  paymentStatus: 'unpaid',
  rating: '4',
  notes: '',
}

const EMPTY_GUEST_FORM: GuestForm = {
  name: '',
  email: '',
  phone: '',
  role: 'guest',
  side: 'neutral',
  seatingTableId: '',
}

interface PlannerWorkspaceProps {
  activeTab?: WorkspaceTab
  onActiveTabChange?: (tab: WorkspaceTab) => void
}

export function PlannerWorkspace({ activeTab: controlledTab, onActiveTabChange }: PlannerWorkspaceProps = {}) {
  const { toast } = useToast()
  const [internalTab, setInternalTab] = useState<WorkspaceTab>('overview')
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = useCallback((tab: WorkspaceTab) => {
    if (controlledTab === undefined) setInternalTab(tab)
    onActiveTabChange?.(tab)
  }, [controlledTab, onActiveTabChange])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const refreshControllerRef = useRef<AbortController | null>(null)

  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [budget, setBudget] = useState<BudgetRow[]>([])
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [budgetByCategory, setBudgetByCategory] = useState<CategoryBreakdown[]>([])
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [guests, setGuests] = useState<GuestRow[]>([])
  const [tables, setTables] = useState<SeatingTableRow[]>([])
  const [timeline, setTimeline] = useState<TimelineRow[]>([])
  const [contributionSummary, setContributionSummary] = useState<ContributionOverviewSummary[]>([])
  const [contributionCounts, setContributionCounts] = useState<ContributionOverviewCounts>({ contributors: 0, pledged: 0, overdue: 0, unverified: 0, toThank: 0 })

  const [taskForm, setTaskForm] = useState({
    title: '',
    category: 'venue',
    priority: 'medium',
    dueDate: '',
    assignee: '',
  })
  const [budgetForm, setBudgetForm] = useState({
    description: '',
    category: 'venue',
    estimatedCost: '',
    actualCost: '',
    paidAmount: '',
    vendorId: '',
    vendorName: '',
    notes: '',
    dueDate: '',
  })
  const [vendorForm, setVendorForm] = useState<VendorForm>(EMPTY_VENDOR_FORM)
  const [guestForm, setGuestForm] = useState<GuestForm>(EMPTY_GUEST_FORM)
  const [tableForm, setTableForm] = useState({ name: '', capacity: '8' })

  const refresh = useCallback(async (showSpinner = false) => {
    refreshControllerRef.current?.abort()
    const controller = new AbortController()
    refreshControllerRef.current = controller

    if (showSpinner) setLoading(true)
    setError(null)

    const requestInit = { signal: controller.signal }
    const requests = [
      ['Tasks', api<{ data: TaskRow[] }>('/api/planner/tasks', requestInit)],
      ['Budget', api<{ data: BudgetRow[]; summary: BudgetSummary; byCategory: CategoryBreakdown[] }>('/api/planner/budget', requestInit)],
      ['Vendors', api<{ data: VendorRow[] }>('/api/planner/vendors', requestInit)],
      ['Guests', api<{ data: GuestRow[]; tables: SeatingTableRow[] }>('/api/planner/guests', requestInit)],
      ['Timeline', api<{ data: TimelineRow[] }>('/api/planner/timeline', requestInit)],
      ['Contributions', api<{ summaryByCurrency: ContributionOverviewSummary[]; counts: ContributionOverviewCounts }>('/api/planner/contributions/summary', requestInit)],
    ] as const

    try {
      const results = await Promise.allSettled(requests.map(([, request]) => request))
      if (controller.signal.aborted) return

      const failures: string[] = []

      const taskResult = results[0]
      if (taskResult.status === 'fulfilled') setTasks(taskResult.value.data ?? [])
      else failures.push('Tasks')

      const budgetResult = results[1]
      if (budgetResult.status === 'fulfilled') {
        setBudget(budgetResult.value.data ?? [])
        setBudgetSummary(budgetResult.value.summary ?? null)
        setBudgetByCategory(budgetResult.value.byCategory ?? [])
      } else failures.push('Budget')

      const vendorResult = results[2]
      if (vendorResult.status === 'fulfilled') setVendors(vendorResult.value.data ?? [])
      else failures.push('Vendors')

      const guestResult = results[3]
      if (guestResult.status === 'fulfilled') {
        setGuests(guestResult.value.data ?? [])
        setTables(guestResult.value.tables ?? [])
      } else failures.push('Guests')

      const timelineResult = results[4]
      if (timelineResult.status === 'fulfilled') {
        setTimeline((timelineResult.value.data ?? []).sort((a, b) => a.order - b.order))
      } else failures.push('Timeline')

      const contributionsResult = results[5]
      if (contributionsResult.status === 'fulfilled') {
        setContributionSummary(contributionsResult.value.summaryByCurrency ?? [])
        setContributionCounts(contributionsResult.value.counts ?? { contributors: 0, pledged: 0, overdue: 0, unverified: 0, toThank: 0 })
      } else if (!isRequestCancellation(contributionsResult.reason, controller.signal)) { console.warn('[PLANNER WORKSPACE CLIENT] contribution summary refresh failed', contributionsResult.reason) }

      results.forEach((result, index) => {
        if (result.status === 'rejected' && !isRequestCancellation(result.reason, controller.signal)) {
          console.warn('[PLANNER WORKSPACE CLIENT] refresh failed', {
            module: requests[index][0],
            error: result.reason,
          })
        }
      })

      if (failures.length > 0) {
        setError(`Could not refresh ${failures.join(', ')}. Your last loaded data is still shown. Check the connection and retry.`)
      }
      if (failures.length < requests.length) setLastUpdated(new Date())
    } catch (refreshError) {
      if (isRequestCancellation(refreshError, controller.signal)) return
      console.warn('[PLANNER WORKSPACE CLIENT] refresh failed unexpectedly', refreshError)
      setError('Unable to refresh planner data. Your last loaded data is still shown. Please retry.')
    } finally {
      if (refreshControllerRef.current === controller) {
        refreshControllerRef.current = null
        if (!controller.signal.aborted) setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void refresh(true)
    const timer = window.setInterval(() => void refresh(false), 30_000)
    return () => {
      window.clearInterval(timer)
      refreshControllerRef.current?.abort()
      refreshControllerRef.current = null
    }
  }, [refresh])

  useEffect(() => {
    const handleRefresh = () => void refresh(true)
    window.addEventListener(PLANNER_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(PLANNER_REFRESH_EVENT, handleRefresh)
  }, [refresh])

  async function mutate(
    action: () => Promise<unknown>,
    successTitle: string,
    reset?: () => void,
  ): Promise<boolean> {
    setSaving(true)
    setError(null)
    try {
      await action()
      reset?.()
      await refresh(false)
      toast({ title: successTitle })
      return true
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : 'The change could not be saved.'
      console.error('[PLANNER WORKSPACE CLIENT] mutation failed', mutationError)
      setError(message)
      toast({ title: 'Save failed', description: message, variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const titleError = plannerTitleError(taskForm.title)
    if (titleError) {
      setError(titleError)
      toast({ title: 'Task needs a title', description: titleError, variant: 'destructive' })
      return
    }
    await mutate(
      () => api('/api/planner/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: normalizePlannerTitle(taskForm.title), category: taskForm.category, priority: taskForm.priority, dueDate: taskForm.dueDate || null, assignee: taskForm.assignee.trim() || null, status: 'todo' }) }),
      'Task added',
      () => setTaskForm({ title: '', category: 'venue', priority: 'medium', dueDate: '', assignee: '' }),
    )
  }

  async function updateTask(task: TaskRow, updates: TaskUpdate): Promise<boolean> {
    return mutate(() => api(`/api/planner/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }), 'Task updated')
  }

  async function updateTaskStatus(task: TaskRow, status: string) {
    const previous = task.status
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status } : item)))
    try {
      await api(`/api/planner/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      toast({ title: 'Task updated', description: task.title })
    } catch (statusError) {
      setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: previous } : item)))
      toast({ title: 'Update failed', description: statusError instanceof Error ? statusError.message : undefined, variant: 'destructive' })
    }
  }

  async function deleteTask(task: TaskRow) {
    await mutate(() => api(`/api/planner/tasks/${task.id}`, { method: 'DELETE' }), 'Task removed')
  }

  async function addBudgetItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!budgetForm.description.trim()) return
    await mutate(
      () => api('/api/planner/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: budgetForm.description.trim(),
          category: budgetForm.category,
          estimatedCost: Number(budgetForm.estimatedCost || 0),
          actualCost: budgetForm.actualCost ? Number(budgetForm.actualCost) : null,
          paidAmount: Number(budgetForm.paidAmount || 0),
          vendorId: budgetForm.vendorId || null,
          vendorName: budgetForm.vendorName.trim() || null,
          notes: budgetForm.notes.trim() || null,
          dueDate: budgetForm.dueDate || null,
          currency: 'USD',
        }),
      }),
      'Budget item added',
      () => setBudgetForm({ description: '', category: 'venue', estimatedCost: '', actualCost: '', paidAmount: '', vendorId: '', vendorName: '', notes: '', dueDate: '' }),
    )
  }

  async function updateBudgetItem(item: BudgetRow, field: 'actualCost' | 'paidAmount', value: string) {
    const parsed = Number(value || 0)
    if (!Number.isFinite(parsed) || parsed < 0) return
    await mutate(() => api(`/api/planner/budget/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: parsed }) }), field === 'paidAmount' ? 'Payment updated' : 'Actual cost updated')
  }

  async function deleteBudgetItem(item: BudgetRow) {
    await mutate(() => api(`/api/planner/budget/${item.id}`, { method: 'DELETE' }), 'Budget item removed')
  }

  async function addVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!vendorForm.name.trim()) return
    await mutate(
      () => api('/api/planner/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vendorForm.name.trim(),
          category: vendorForm.category,
          contact: vendorForm.contact.trim() || null,
          phone: vendorForm.phone.trim() || null,
          email: vendorForm.email.trim() || null,
          website: vendorForm.website.trim() || null,
          contractStatus: vendorForm.contractStatus,
          paymentStatus: vendorForm.paymentStatus,
          rating: vendorForm.rating ? Number(vendorForm.rating) : null,
          notes: vendorForm.notes.trim() || null,
        }),
      }),
      'Vendor added',
      () => setVendorForm(EMPTY_VENDOR_FORM),
    )
  }

  async function updateVendor(vendor: VendorRow, updates: VendorUpdate) {
    await mutate(() => api(`/api/planner/vendors/${vendor.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }), 'Vendor updated')
  }

  async function deleteVendor(vendor: VendorRow) {
    await mutate(() => api(`/api/planner/vendors/${vendor.id}`, { method: 'DELETE' }), 'Vendor removed')
  }

  async function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!guestForm.name.trim()) return
    await mutate(
      () => api('/api/planner/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'guest', name: guestForm.name.trim(), email: guestForm.email.trim() || null, phone: guestForm.phone.trim() || null, role: guestForm.role, side: guestForm.side, seatingTableId: guestForm.seatingTableId || null }) }),
      'Guest added',
      () => setGuestForm(EMPTY_GUEST_FORM),
    )
  }

  async function updateGuest(guest: GuestRow, updates: GuestUpdate): Promise<{ success: boolean; error?: string; field?: string }> {
    setSaving(true)
    setError(null)
    try {
      await api(`/api/planner/guests/${guest.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
      await refresh(false)
      toast({ title: 'Guest updated' })
      return { success: true }
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : 'The guest could not be saved.'
      const field = mutationError instanceof PlannerApiError ? mutationError.field : undefined
      setError(message)
      toast({ title: 'Save failed', description: message, variant: 'destructive' })
      return { success: false, error: message, field }
    } finally {
      setSaving(false)
    }
  }

  async function assignGuestTable(guest: GuestRow, tableId: string | null): Promise<boolean> {
    const previous = guest
    const tableName = tables.find((table) => table.id === tableId)?.name ?? null
    setGuests((current) => current.map((item) => item.id === guest.id ? { ...item, seatingTableId: tableId, seatingTableName: tableName } : item))
    try {
      const payload = await api<{ data: GuestRow }>(`/api/planner/guests/${guest.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seatingTableId: tableId }) })
      setGuests((current) => current.map((item) => (item.id === guest.id ? payload.data : item)))
      toast({ title: tableId ? 'Guest assigned to table' : 'Guest unassigned' })
      return true
    } catch (assignmentError) {
      setGuests((current) => current.map((item) => (item.id === guest.id ? previous : item)))
      toast({ title: 'Seating update failed', description: assignmentError instanceof Error ? assignmentError.message : undefined, variant: 'destructive' })
      return false
    }
  }

  async function assignGuestToTable(guest: GuestRow, tableId: string | null): Promise<boolean> {
    return assignGuestTable(guest, tableId)
  }

  async function deleteGuest(guest: GuestRow) {
    await mutate(() => api(`/api/planner/guests/${guest.id}`, { method: 'DELETE' }), 'Guest removed')
  }

  async function addTimelineItem(input: TimelineInput): Promise<boolean> {
    return mutate(() => api('/api/planner/timeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ time: input.time.trim(), event: input.event.trim(), duration: input.duration.trim(), location: input.location.trim(), notes: input.notes.trim() }) }), 'Timeline item added')
  }

  async function updateTimelineItem(item: TimelineRow, input: TimelineInput): Promise<boolean> {
    return mutate(() => api(`/api/planner/timeline/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ time: input.time.trim(), event: input.event.trim(), duration: input.duration.trim(), location: input.location.trim(), notes: input.notes.trim() }) }), 'Timeline item updated')
  }

  async function deleteTimelineItem(item: TimelineRow): Promise<boolean> {
    return mutate(() => api(`/api/planner/timeline/${item.id}`, { method: 'DELETE' }), 'Timeline item removed')
  }

  async function moveTimelineItem(item: TimelineRow, direction: -1 | 1): Promise<boolean> {
    const index = timeline.findIndex((candidate) => candidate.id === item.id)
    const swapIndex = index + direction
    if (index < 0 || swapIndex < 0 || swapIndex >= timeline.length) return false

    const previous = timeline
    const next = [...timeline]
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    const reordered = next.map((candidate, orderIndex) => ({ ...candidate, order: orderIndex + 1 }))
    setTimeline(reordered)
    setSaving(true)

    const orderPayload = (reordered: number) => ({ order: reordered })
    try {
      await Promise.all([reordered[index], reordered[swapIndex]].map((candidate) => api(`/api/planner/timeline/${candidate.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload(candidate.order)) })))
      toast({ title: 'Timeline order updated' })
      return true
    } catch (moveError) {
      setTimeline(previous)
      toast({ title: 'Reorder failed', description: moveError instanceof Error ? moveError.message : undefined, variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  const printTimeline = () => {
    if (typeof window === 'undefined' || timeline.length === 0) return
    const printWindow = window.open('', '_blank', 'width=900,height=900')
    if (!printWindow) {
      toast({ title: 'Pop-up blocked', variant: 'destructive' })
      return
    }

    const rows = timeline.map((item) => `
      <section class="row">
        <div class="time">${escapeHtml(item.time)}</div>
        <div>
          <div class="event">${escapeHtml(item.event)}${item.duration ? ` <span class="meta">(${escapeHtml(item.duration)})</span>` : ''}</div>
          ${item.location ? `<div class="meta">Location: ${escapeHtml(item.location)}</div>` : ''}
          ${item.notes ? `<div class="notes">${escapeHtml(item.notes)}</div>` : ''}
        </div>
      </section>`).join('')

    printWindow.document.write(`<!doctype html>
      <html><head><title>Wedding Day Timeline</title><style>
        body { font-family: Georgia, serif; padding: 40px; color: #1a1410; }
        h1 { font-weight: 400; }
        .row { display: grid; grid-template-columns: 90px 1fr; gap: 18px; padding: 13px 0; border-bottom: 1px solid #ddd4c8; }
        .time { font-weight: 700; color: #8a6c38; }
        .event { font-weight: 700; }
        .meta { color: #645e57; font-size: 13px; }
        .notes { color: #403b36; font-size: 13px; margin-top: 5px; }
      </style></head><body><h1>Wedding Day Timeline</h1><p class="meta">Operational run sheet generated from the selected wedding.</p>${rows}</body></html>`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.window.print()
  }

  async function addTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tableForm.name.trim()) return
    await mutate(() => api('/api/planner/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'table', tableName: tableForm.name.trim(), capacity: Number(tableForm.capacity || 8) }) }), 'Seating table added', () => setTableForm({ name: '', capacity: '8' }))
  }

  async function updateTable(table: SeatingTableRow, updates: { name: string; capacity: number }): Promise<boolean> {
    return mutate(() => api(`/api/planner/guests/${table.id}?kind=table`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }), 'Seating table updated')
  }

  async function deleteTable(table: SeatingTableRow): Promise<boolean> {
    return mutate(() => api(`/api/planner/guests/${table.id}?kind=table`, { method: 'DELETE' }), 'Seating table removed')
  }

  const taskStats = useMemo(() => {
    const done = tasks.filter((task) => task.status === 'done').length
    const blocked = tasks.filter((task) => task.status === 'blocked').length
    const overdue = tasks.filter((task) => {
      if (!task.dueDate || task.status === 'done') return false
      return new Date(task.dueDate).getTime() < Date.now()
    }).length
    return { done, blocked, overdue, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 }
  }, [tasks])

  const guestStats = useMemo<GuestStats>(() => {
    const confirmed = guests.filter((guest) => guest.rsvp?.attending === true).length
    const declined = guests.filter((guest) => guest.rsvp?.attending === false).length
    const pending = guests.filter((guest) => guest.rsvp?.attending == null).length
    const plusOnes = guests.filter((guest) => guest.rsvp?.plusOne).length
    const kidsTotal = guests.reduce((total, guest) => total + (guest.rsvp?.kidsAttending ? guest.rsvp.kidsCount : 0), 0)
    const checkedIn = guests.filter((guest) => guest.rsvp?.checkedIn).length
    const heads = guests.reduce((total, guest) => {
      if (guest.rsvp?.attending !== true) return total
      return total + 1 + (guest.rsvp.plusOne ? 1 : 0) + (guest.rsvp.kidsAttending ? guest.rsvp.kidsCount : 0)
    }, 0)
    return { total: guests.length, confirmed, declined, pending, plusOnes, kidsTotal, checkedIn, heads }
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
      <div
        data-planner-workspace-navigation
        className="flex shrink-0 items-center border-b border-gold/15 bg-espresso/95 px-3 py-2 sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="planner-workspace-section">Planner workspace section</label>
          <select id="planner-workspace-section" value={activeTab} onChange={(event) => setActiveTab(event.target.value as WorkspaceTab)} className="h-11 w-full rounded-lg border border-gold/25 bg-espresso px-3 font-sans text-sm text-champagne md:hidden">{TABS.map((tab) => <option key={tab.value} value={tab.value}>{tab.label}</option>)}</select>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Planner workspace sections">{TABS.map((tab) => <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 font-sans text-[11px] transition-colors ${activeTab === tab.value ? 'border-gold/35 bg-gold/12 text-gold' : 'border-transparent text-champagne/55 hover:border-gold/15 hover:text-champagne'}`}>{tab.icon}{tab.label}</button>)}</nav>
        </div>
      </div>

      <div data-planner-module-scroll="true" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-7xl space-y-5 pb-10 sm:pb-16">
          {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 font-sans text-sm text-clay-light"><span className="min-w-0">{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void refresh(true)} disabled={loading} className="h-8 shrink-0 border-clay/30 bg-transparent text-clay-light"><RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />Retry</Button></div>}

          {loading && !lastUpdated ? <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-7 animate-spin text-gold" /></div> : <>
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
                  {[
                    ['Task progress', `${taskStats.percent}%`, `${taskStats.done} of ${tasks.length} complete`],
                    ['Budget outstanding', money(budgetSummary?.totalOutstanding ?? 0, budgetSummary?.currency), `${money(budgetSummary?.totalPaid ?? 0, budgetSummary?.currency)} paid`],
                    ['Confirmed guests', String(guestStats.confirmed), `${guestStats.heads} confirmed seats`],
                    ['Vendor pipeline', String(vendors.length), `${vendors.filter((vendor) => vendor.contractStatus === 'signed').length} signed`],
                  ].map(([label, value, detail]) => <SectionCard key={label} className="p-3 sm:p-4"><p className="font-sans text-[9px] uppercase tracking-[0.12em] text-gold/65 sm:text-[10px] sm:tracking-[0.16em]">{label}</p><p className="mt-1.5 font-serif text-2xl text-champagne sm:mt-2 sm:text-3xl">{value}</p><p className="mt-1 font-sans text-[10px] text-champagne/45 sm:text-xs">{detail}</p></SectionCard>)}
                </div>

                <div data-testid="planner-contributions-overview">
                  <SectionCard className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70">Contributions & support</p>
                        <h2 className="mt-1 font-serif text-xl">Who is helping make this possible?</h2>
                        <p className="mt-1 font-sans text-xs text-champagne/50">{contributionCounts.contributors} contributors · {contributionCounts.pledged} pledged · {contributionCounts.overdue} overdue · {contributionCounts.unverified} unverified · {contributionCounts.toThank} thank-you{contributionCounts.toThank === 1 ? '' : 's'} pending</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab('contributions')} className="border-gold/25 bg-transparent text-gold">
                        <HandHeart className="size-3.5" />Open Contributions
                      </Button>
                    </div>
                    {contributionSummary.length > 0 ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {contributionSummary.map((row) => (
                          <div key={row.currency} className="rounded-xl border border-gold/10 p-3">
                            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/65">{row.currency}</p>
                            <p className="mt-1 font-sans text-xs text-champagne/65">Received {money(row.cashReceived, row.currency)} · Direct vendor {money(row.directVendorPaid, row.currency)}</p>
                            <p className="mt-1 font-sans text-[11px] text-champagne/45">In-kind {money(row.inKindValue, row.currency)} · Pledged {money(row.pledged, row.currency)} · Available {money(row.availableCash, row.currency)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-xl border border-dashed border-gold/15 p-3 font-sans text-xs text-champagne/45">No contributions recorded yet. Add support only when someone has offered or provided it.</p>
                    )}
                  </SectionCard>
                </div>

                <SectionCard className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-xl">Planning readiness</h2><p className="mt-1 font-sans text-xs text-champagne/50">This workspace uses only the selected wedding’s saved records. Empty weddings stay empty until a planner adds data, imports a file, or applies a template.</p></div><Badge variant="outline" className="border-gold/25 bg-gold/5 text-gold">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Not synced'}</Badge></div>
                  <Progress value={taskStats.percent} className="mt-5 h-2 bg-champagne/10 [&>div]:bg-gold" />
                  <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3"><div className="rounded-xl border border-gold/10 p-3"><p className="font-sans text-[10px] text-champagne/50 sm:text-xs">Overdue tasks</p><p className="mt-1 font-serif text-xl sm:text-2xl">{taskStats.overdue}</p></div><div className="rounded-xl border border-gold/10 p-3"><p className="font-sans text-[10px] text-champagne/50 sm:text-xs">Blocked tasks</p><p className="mt-1 font-serif text-xl sm:text-2xl">{taskStats.blocked}</p></div><div className="rounded-xl border border-gold/10 p-3"><p className="font-sans text-[10px] text-champagne/50 sm:text-xs">Pending RSVPs</p><p className="mt-1 font-serif text-xl sm:text-2xl">{guestStats.pending}</p></div></div>
                </SectionCard>
              </div>
            )}

            {activeTab === 'tasks' && <PlannerTasksModule tasks={tasks} taskForm={taskForm} setTaskForm={setTaskForm} saving={saving} taskProgressPercent={taskStats.percent} onAddTask={addTask} onUpdateTask={updateTask} onUpdateTaskStatus={updateTaskStatus} onDeleteTask={deleteTask} />}
            {activeTab === 'contributions' && <PlannerContributionsWorkspace embedded />}
            {activeTab === 'budget' && <PlannerBudgetModule budget={budget} budgetSummary={budgetSummary} budgetByCategory={budgetByCategory} budgetForm={budgetForm} setBudgetForm={setBudgetForm} vendors={vendors} saving={saving} onAddBudgetItem={addBudgetItem} onUpdateBudgetItem={updateBudgetItem} onDeleteBudgetItem={deleteBudgetItem} />}
            {activeTab === 'vendors' && <PlannerVendorsModule vendors={vendors} vendorForm={vendorForm} setVendorForm={setVendorForm} saving={saving} onAddVendor={addVendor} onUpdateVendor={updateVendor} onDeleteVendor={deleteVendor} />}
            {activeTab === 'guests' && <PlannerGuestsModule guests={guests} tables={tables} guestForm={guestForm} setGuestForm={setGuestForm} guestStats={guestStats} saving={saving} onAddGuest={addGuest} onUpdateGuest={updateGuest} onAssignGuestTable={assignGuestTable} onDeleteGuest={deleteGuest} />}
            {activeTab === 'timeline' && <PlannerTimelineModule timeline={timeline} saving={saving} onCreateTimelineItem={addTimelineItem} onUpdateTimelineItem={updateTimelineItem} onDeleteTimelineItem={deleteTimelineItem} onMoveTimelineItem={moveTimelineItem} onPrintTimeline={printTimeline} />}
            {activeTab === 'seating' && <PlannerSeatingModule tables={tables} guests={guests} tableForm={tableForm} setTableForm={setTableForm} tableOccupancy={tableOccupancy} saving={saving} onAddTable={addTable} onUpdateTable={updateTable} onDeleteTable={deleteTable} onAssignGuestToTable={assignGuestToTable} />}
          </>}
        </div>
      </div>
    </div>
  )
}
