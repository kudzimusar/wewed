'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  CheckSquare2,
  ChevronsDown,
  ChevronsUp,
  GripVertical,
  Loader2,
  Printer,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  openPlannerPrintDocument,
  type PlannerDocumentColumn,
  type PlannerDocumentRow,
  type PlannerDocumentSummaryItem,
} from '@/lib/planner-document'
import { plannerModuleFromPath, type PlannerModuleSlug } from '@/lib/planner-route-state'
import { PLANNER_COMMAND_CENTER_OPEN_EVENT } from '@/lib/planner-workspace-events'

const RECORD_MODULES = new Set<PlannerModuleSlug>([
  'tasks',
  'budget',
  'vendors',
  'guests',
  'timeline',
  'seating',
])

const MODULE_LABELS: Record<PlannerModuleSlug, string> = {
  overview: 'Overview',
  tasks: 'Tasks',
  budget: 'Budget',
  vendors: 'Vendors',
  guests: 'Guests',
  timeline: 'Timeline',
  seating: 'Seating',
}

type WorkspaceRecord = Record<string, unknown> & { id: string }
type PanelMode = 'print' | 'arrange' | 'select'
type GuestPrintPreset = 'full' | 'rsvp' | 'catering' | 'checkin' | 'seating'

type SessionPayload = {
  authorized?: boolean
  activeWedding?: {
    id?: string
    title?: string
    date?: string
    venue?: string
    venueCity?: string
    venueCountry?: string
  }
}

type LoadResult = {
  records: WorkspaceRecord[]
  summary?: Record<string, unknown>
  tables?: WorkspaceRecord[]
  overview?: Record<string, unknown>
  vendorOptions?: WorkspaceRecord[]
}

function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function titleCase(value: unknown): string {
  return text(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function dateText(value: unknown): string {
  const raw = text(value)
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function money(value: unknown, currency = 'USD'): string {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return text(value)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
      maximumFractionDigits: 0,
    }).format(number)
  } catch {
    return `${currency} ${number.toLocaleString('en-US')}`
  }
}

function recordLabel(module: PlannerModuleSlug, record: WorkspaceRecord): string {
  if (module === 'tasks') return text(record.title) || 'Untitled task'
  if (module === 'budget') return text(record.description) || 'Budget item'
  if (module === 'vendors') return text(record.name) || 'Vendor'
  if (module === 'guests') return text(record.name) || 'Guest'
  if (module === 'timeline') return `${text(record.time)} · ${text(record.title ?? record.event)}`.replace(/^ · | · $/g, '')
  if (module === 'seating') return text(record.name) || 'Seating table'
  return 'Worksheet record'
}

function recordDetail(module: PlannerModuleSlug, record: WorkspaceRecord): string {
  if (module === 'tasks') return [titleCase(record.category), titleCase(record.status), dateText(record.dueDate)].filter(Boolean).join(' · ')
  if (module === 'budget') return [titleCase(record.category), text(record.vendorName), money(record.estimatedCost, text(record.currency) || 'USD')].filter(Boolean).join(' · ')
  if (module === 'vendors') return [titleCase(record.category), `Contract: ${titleCase(record.contractStatus)}`, `Payment: ${titleCase(record.paymentStatus)}`].filter(Boolean).join(' · ')
  if (module === 'guests') return [titleCase(record.side), titleCase(record.role), text(record.seatingTableName) || 'Unassigned'].filter(Boolean).join(' · ')
  if (module === 'timeline') return [text(record.location), text(record.duration), text(record.notes ?? record.description)].filter(Boolean).join(' · ')
  if (module === 'seating') return [titleCase(record.tableType), text(record.zone), `${text(record.capacity)} seats`].filter(Boolean).join(' · ')
  return ''
}

function filterParam(search: URLSearchParams, key: string): string {
  return search.get(`filter_${key}`) ?? ''
}

function matchesCurrentView(module: PlannerModuleSlug, record: WorkspaceRecord, search: URLSearchParams): boolean {
  const query = filterParam(search, 'search').trim().toLowerCase()
  const includesQuery = (values: unknown[]) =>
    !query || values.some((value) => text(value).toLowerCase().includes(query))

  if (module === 'tasks') {
    const category = filterParam(search, 'category')
    const status = filterParam(search, 'status')
    const priority = filterParam(search, 'priority')
    if (category && category !== 'all' && text(record.category) !== category) return false
    if (status && status !== 'all' && text(record.status) !== status) return false
    if (priority && priority !== 'all' && text(record.priority) !== priority) return false
    return includesQuery([record.title, record.description, record.assignee])
  }

  if (module === 'budget') {
    const category = filterParam(search, 'category')
    const status = filterParam(search, 'status')
    if (category && category !== 'all' && text(record.category) !== category) return false
    if (status && status !== 'all') {
      const actual = Number(record.actualCost ?? record.estimatedCost ?? 0)
      const paid = Number(record.paidAmount ?? 0)
      const outstanding = Math.max(0, actual - paid)
      const isPaid = actual > 0 && outstanding === 0
      const due = record.dueDate ? new Date(text(record.dueDate)).getTime() : NaN
      const overdue = Number.isFinite(due) && due < Date.now() && !isPaid
      if (status === 'paid' && !isPaid) return false
      if (status === 'outstanding' && outstanding <= 0) return false
      if (status === 'overdue' && !overdue) return false
    }
    return includesQuery([record.description, record.vendorName, record.category, record.notes])
  }

  if (module === 'guests') {
    const side = filterParam(search, 'side')
    const status = filterParam(search, 'status')
    if (side && side !== 'all' && text(record.side) !== side) return false
    const rsvp = (record.rsvp ?? null) as Record<string, unknown> | null
    const attending = rsvp?.attending
    if (status === 'confirmed' && attending !== true) return false
    if (status === 'declined' && attending !== false) return false
    if (status === 'pending' && attending !== null && attending !== undefined) return false
    return includesQuery([record.name, record.email, record.phone, record.seatingTableName])
  }

  if (module === 'seating') {
    const tableType = filterParam(search, 'tableType')
    if (tableType && tableType !== 'all' && text(record.tableType) !== tableType) return false
    return includesQuery([record.name, record.zone, record.notes, record.tableType])
  }

  if (module === 'timeline') {
    return includesQuery([record.time, record.title, record.event, record.location, record.notes, record.description])
  }

  if (module === 'vendors') {
    return includesQuery([record.name, record.category, record.contact, record.email, record.phone, record.notes])
  }

  return true
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok || !payload) throw new Error(payload?.error || `Request failed (${response.status}).`)
  return payload
}

function endpointFor(module: PlannerModuleSlug): string {
  if (module === 'overview') return '/api/planner/overview'
  return `/api/planner/${module}`
}

function orderedRecords(records: WorkspaceRecord[], order: string[]): WorkspaceRecord[] {
  if (!order.length) return records
  const byId = new Map(records.map((record) => [record.id, record]))
  const result: WorkspaceRecord[] = []
  for (const id of order) {
    const record = byId.get(id)
    if (record) {
      result.push(record)
      byId.delete(id)
    }
  }
  result.push(...records.filter((record) => byId.has(record.id)))
  return result
}

function printColumns(module: PlannerModuleSlug, preset: GuestPrintPreset): PlannerDocumentColumn[] {
  if (module === 'tasks') return [
    { key: 'order', label: '#' }, { key: 'title', label: 'Task' }, { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category' }, { key: 'status', label: 'Status' }, { key: 'priority', label: 'Priority' },
    { key: 'dueDate', label: 'Due' }, { key: 'assignee', label: 'Assignee' },
  ]
  if (module === 'budget') return [
    { key: 'order', label: '#' }, { key: 'description', label: 'Item' }, { key: 'category', label: 'Category' },
    { key: 'vendor', label: 'Vendor' }, { key: 'estimate', label: 'Estimate' }, { key: 'actual', label: 'Actual' },
    { key: 'paid', label: 'Paid' }, { key: 'outstanding', label: 'Outstanding' }, { key: 'dueDate', label: 'Due' }, { key: 'notes', label: 'Notes' },
  ]
  if (module === 'vendors') return [
    { key: 'order', label: '#' }, { key: 'name', label: 'Vendor' }, { key: 'category', label: 'Category' },
    { key: 'contact', label: 'Contact' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
    { key: 'contract', label: 'Contract' }, { key: 'payment', label: 'Payment' }, { key: 'notes', label: 'Notes' },
  ]
  if (module === 'timeline') return [
    { key: 'order', label: '#' }, { key: 'time', label: 'Time' }, { key: 'title', label: 'Activity' },
    { key: 'duration', label: 'Duration' }, { key: 'location', label: 'Location' }, { key: 'notes', label: 'Operational notes' },
  ]
  if (module === 'seating') return [
    { key: 'order', label: '#' }, { key: 'name', label: 'Table' }, { key: 'type', label: 'Type' },
    { key: 'zone', label: 'Zone / position' }, { key: 'capacity', label: 'Capacity' }, { key: 'notes', label: 'Notes' },
  ]
  if (preset === 'rsvp') return [
    { key: 'order', label: '#' }, { key: 'name', label: 'Guest' }, { key: 'side', label: 'Side' }, { key: 'rsvp', label: 'RSVP' },
    { key: 'plusOne', label: 'Plus-one' }, { key: 'kids', label: 'Kids' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
  ]
  if (preset === 'catering') return [
    { key: 'order', label: '#' }, { key: 'name', label: 'Guest' }, { key: 'rsvp', label: 'RSVP' }, { key: 'meal', label: 'Meal' },
    { key: 'plusOne', label: 'Plus-one / meal' }, { key: 'kids', label: 'Kids' }, { key: 'dietary', label: 'Dietary notes' }, { key: 'table', label: 'Table' },
  ]
  if (preset === 'checkin') return [
    { key: 'order', label: '#' }, { key: 'name', label: 'Guest' }, { key: 'side', label: 'Side' }, { key: 'rsvp', label: 'RSVP' },
    { key: 'party', label: 'Party size' }, { key: 'table', label: 'Table' }, { key: 'checkedIn', label: 'Checked in' },
  ]
  if (preset === 'seating') return [
    { key: 'order', label: '#' }, { key: 'name', label: 'Guest' }, { key: 'side', label: 'Side' }, { key: 'role', label: 'Role' },
    { key: 'party', label: 'Party size' }, { key: 'table', label: 'Table' },
  ]
  return [
    { key: 'order', label: '#' }, { key: 'name', label: 'Guest' }, { key: 'role', label: 'Role' }, { key: 'side', label: 'Side' },
    { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'rsvp', label: 'RSVP' },
    { key: 'party', label: 'Party size' }, { key: 'dietary', label: 'Dietary notes' }, { key: 'table', label: 'Table' }, { key: 'checkedIn', label: 'Checked in' },
  ]
}

function partySize(record: WorkspaceRecord): number {
  const rsvp = (record.rsvp ?? null) as Record<string, unknown> | null
  return 1 + (rsvp?.plusOne ? 1 : 0) + (rsvp?.kidsAttending ? Number(rsvp.kidsCount ?? 0) : 0)
}

function printRows(module: PlannerModuleSlug, records: WorkspaceRecord[], preset: GuestPrintPreset): PlannerDocumentRow[] {
  return records.map((record, index) => {
    const order = index + 1
    if (module === 'tasks') return { id: record.id, cells: {
      order, title: text(record.title), description: text(record.description), category: titleCase(record.category),
      status: titleCase(record.status), priority: titleCase(record.priority), dueDate: dateText(record.dueDate), assignee: text(record.assignee),
    } }
    if (module === 'budget') {
      const currency = text(record.currency) || 'USD'
      const actual = Number(record.actualCost ?? record.estimatedCost ?? 0)
      const paid = Number(record.paidAmount ?? 0)
      return { id: record.id, cells: {
        order, description: text(record.description), category: titleCase(record.category), vendor: text(record.vendorName),
        estimate: money(record.estimatedCost, currency), actual: money(actual, currency), paid: money(paid, currency),
        outstanding: money(Math.max(0, actual - paid), currency), dueDate: dateText(record.dueDate), notes: text(record.notes),
      } }
    }
    if (module === 'vendors') return { id: record.id, cells: {
      order, name: text(record.name), category: titleCase(record.category), contact: text(record.contact), phone: text(record.phone),
      email: text(record.email), contract: titleCase(record.contractStatus), payment: titleCase(record.paymentStatus), notes: text(record.notes),
    } }
    if (module === 'timeline') return { id: record.id, cells: {
      order, time: text(record.time), title: text(record.title ?? record.event), duration: text(record.duration), location: text(record.location),
      notes: text(record.notes ?? record.description),
    } }
    if (module === 'seating') return { id: record.id, cells: {
      order, name: text(record.name), type: titleCase(record.tableType), zone: text(record.zone), capacity: text(record.capacity), notes: text(record.notes),
    } }

    const rsvp = (record.rsvp ?? null) as Record<string, unknown> | null
    const attending = rsvp?.attending === true ? 'Confirmed' : rsvp?.attending === false ? 'Declined' : 'Pending'
    return { id: record.id, cells: {
      order, name: text(record.name), role: titleCase(record.role), side: titleCase(record.side), email: text(record.email), phone: text(record.phone),
      rsvp: attending, plusOne: rsvp?.plusOne ? `${text(rsvp.plusOneName) || 'Yes'}${rsvp.plusOneMeal ? ` · ${text(rsvp.plusOneMeal)}` : ''}` : 'No',
      kids: rsvp?.kidsAttending ? text(rsvp.kidsCount) : '0', meal: text(rsvp?.mealChoice), dietary: text(rsvp?.dietaryNotes),
      party: partySize(record), table: text(record.seatingTableName) || 'Unassigned', checkedIn: rsvp?.checkedIn ? 'Yes' : 'No',
    } }
  })
}

function guestPresetRows(records: WorkspaceRecord[], preset: GuestPrintPreset): WorkspaceRecord[] {
  if (preset === 'full') return records
  if (preset === 'rsvp') return records
  if (preset === 'catering') return records.filter((record) => {
    const rsvp = record.rsvp as Record<string, unknown> | null
    return rsvp?.attending === true
  })
  if (preset === 'checkin') return records.filter((record) => {
    const rsvp = record.rsvp as Record<string, unknown> | null
    return rsvp?.attending === true
  })
  return records.filter((record) => Boolean(record.seatingTableId))
}

function SortableRecord({
  module,
  record,
  selected,
  onToggle,
  onMove,
}: {
  module: PlannerModuleSlug
  record: WorkspaceRecord
  selected: boolean
  onToggle: () => void
  onMove: (direction: 'up' | 'down' | 'top' | 'bottom') => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: record.id })
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border bg-espresso/70 p-3 ${isDragging ? 'border-gold shadow-xl' : selected ? 'border-gold/55' : 'border-gold/15'}`}
      data-planner-arrange-record={record.id}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${recordLabel(module, record)}`}
          className="mt-1 size-5 shrink-0 accent-[#BF9B5F]"
        />
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 flex size-8 shrink-0 touch-none items-center justify-center rounded-lg border border-gold/20 text-champagne/55 hover:border-gold/45 hover:text-gold"
          aria-label={`Drag to reorder ${recordLabel(module, record)}`}
          title="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-sm font-medium text-champagne">{recordLabel(module, record)}</p>
          <p className="mt-1 font-sans text-[11px] leading-4 text-champagne/45">{recordDetail(module, record) || 'No additional details'}</p>
        </div>
        <div className="grid grid-cols-2 gap-1" aria-label={`Move ${recordLabel(module, record)}`}>
          <button type="button" onClick={() => onMove('top')} className="flex size-8 items-center justify-center rounded border border-gold/15 text-champagne/50 hover:text-gold" aria-label="Move to top"><ChevronsUp className="size-3.5" /></button>
          <button type="button" onClick={() => onMove('up')} className="flex size-8 items-center justify-center rounded border border-gold/15 text-champagne/50 hover:text-gold" aria-label="Move up"><ArrowUp className="size-3.5" /></button>
          <button type="button" onClick={() => onMove('down')} className="flex size-8 items-center justify-center rounded border border-gold/15 text-champagne/50 hover:text-gold" aria-label="Move down"><ArrowDown className="size-3.5" /></button>
          <button type="button" onClick={() => onMove('bottom')} className="flex size-8 items-center justify-center rounded border border-gold/15 text-champagne/50 hover:text-gold" aria-label="Move to bottom"><ChevronsDown className="size-3.5" /></button>
        </div>
      </div>
    </article>
  )
}

export function PlannerWorksheetCommandCenter() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const isPlannerWorksheet =
    pathname === '/planner' ||
    /^\/planner\/(overview|tasks|budget|vendors|guests|timeline|seating)(?:\/|$)/.test(pathname)
  const module = plannerModuleFromPath(pathname) as PlannerModuleSlug
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PanelMode>('print')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadResult, setLoadResult] = useState<LoadResult>({ records: [] })
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [savedOrder, setSavedOrder] = useState<string[]>([])
  const [workingOrder, setWorkingOrder] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [guestPreset, setGuestPreset] = useState<GuestPrintPreset>('full')
  const [bulkAction, setBulkAction] = useState('')
  const [bulkValue, setBulkValue] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const load = useCallback(async () => {
    if (!isPlannerWorksheet) return
    setLoading(true)
    try {
      const [sessionPayload, modulePayload] = await Promise.all([
        jsonRequest<SessionPayload>('/api/auth/me'),
        jsonRequest<Record<string, unknown>>(endpointFor(module)),
      ])
      setSession(sessionPayload)

      if (module === 'overview') {
        setLoadResult({ records: [], overview: modulePayload })
        setSavedOrder([])
        setWorkingOrder([])
        return
      }

      const records = (Array.isArray(modulePayload.data) ? modulePayload.data : []) as WorkspaceRecord[]
      const orderPayload = await jsonRequest<{ data?: string[] }>(`/api/planner/worksheet-order?module=${module}`)
      const order = Array.isArray(orderPayload.data) ? orderPayload.data : records.map((record) => record.id)
      let vendorOptions: WorkspaceRecord[] | undefined
      if (module === 'budget') {
        const vendorPayload = await jsonRequest<{ data?: WorkspaceRecord[] }>('/api/planner/vendors')
        vendorOptions = vendorPayload.data ?? []
      }
      setLoadResult({
        records,
        summary: (modulePayload.summary ?? undefined) as Record<string, unknown> | undefined,
        tables: (Array.isArray(modulePayload.tables) ? modulePayload.tables : undefined) as WorkspaceRecord[] | undefined,
        vendorOptions,
      })
      setSavedOrder(order)
      setWorkingOrder(order)
      setSelectedIds(new Set())
      setBulkAction('')
      setBulkValue('')
    } catch (error) {
      toast({ title: 'Worksheet tools unavailable', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [isPlannerWorksheet, module, toast])

  useEffect(() => {
    if (open) void load()
  }, [load, open])

  useEffect(() => {
    if (!isPlannerWorksheet) return
    const handleOpen = () => {
      setMode('print')
      setOpen(true)
    }
    window.addEventListener(PLANNER_COMMAND_CENTER_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(PLANNER_COMMAND_CENTER_OPEN_EVENT, handleOpen)
  }, [isPlannerWorksheet])

  useEffect(() => {
    setOpen(false)
    setSelectedIds(new Set())
  }, [pathname])

  const records = useMemo(() => orderedRecords(loadResult.records, workingOrder), [loadResult.records, workingOrder])
  const currentView = useMemo(() => records.filter((record) => matchesCurrentView(module, record, searchParams)), [module, records, searchParams])
  const selectedRecords = useMemo(() => records.filter((record) => selectedIds.has(record.id)), [records, selectedIds])
  const hasFilters = useMemo(() => Array.from(searchParams.keys()).some((key) => key.startsWith('filter_')), [searchParams])
  const orderChanged = workingOrder.join('|') !== savedOrder.join('|')

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function moveRecord(id: string, direction: 'up' | 'down' | 'top' | 'bottom') {
    setWorkingOrder((current) => {
      const index = current.indexOf(id)
      if (index < 0) return current
      const next = [...current]
      next.splice(index, 1)
      const target = direction === 'top' ? 0 : direction === 'bottom' ? next.length : direction === 'up' ? Math.max(0, index - 1) : Math.min(next.length, index + 1)
      next.splice(target, 0, id)
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = text(event.active.id)
    const overId = event.over ? text(event.over.id) : ''
    if (!overId || activeId === overId) return
    setWorkingOrder((current) => {
      const oldIndex = current.indexOf(activeId)
      const newIndex = current.indexOf(overId)
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex)
    })
  }

  function moveSelected(destination: 'top' | 'bottom') {
    if (!selectedIds.size) return
    setWorkingOrder((current) => {
      const selected = current.filter((id) => selectedIds.has(id))
      const rest = current.filter((id) => !selectedIds.has(id))
      return destination === 'top' ? [...selected, ...rest] : [...rest, ...selected]
    })
  }

  async function saveOrder() {
    if (!RECORD_MODULES.has(module)) return
    setBusy(true)
    try {
      const payload = await jsonRequest<{ data: string[] }>(`/api/planner/worksheet-order?module=${module}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: workingOrder }),
      })
      setSavedOrder(payload.data)
      setWorkingOrder(payload.data)
      toast({ title: 'Worksheet order saved', description: 'The presentation order is now durable for this wedding.' })
    } catch (error) {
      toast({ title: 'Order not saved', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  function orientation(): 'portrait' | 'landscape' {
    return module === 'budget' || module === 'vendors' || module === 'guests' ? 'landscape' : 'portrait'
  }

  function printSummary(recordsToPrint: WorkspaceRecord[]): PlannerDocumentSummaryItem[] {
    if (module === 'budget') {
      const currency = text(recordsToPrint[0]?.currency) || text(loadResult.summary?.currency) || 'USD'
      const estimated = recordsToPrint.reduce((sum, record) => sum + Number(record.estimatedCost ?? 0), 0)
      const actual = recordsToPrint.reduce((sum, record) => sum + Number(record.actualCost ?? record.estimatedCost ?? 0), 0)
      const paid = recordsToPrint.reduce((sum, record) => sum + Number(record.paidAmount ?? 0), 0)
      return [
        { label: 'Estimated', value: money(estimated, currency) }, { label: 'Actual', value: money(actual, currency) },
        { label: 'Paid', value: money(paid, currency) }, { label: 'Outstanding', value: money(Math.max(0, actual - paid), currency) },
      ]
    }
    if (module === 'tasks') return [
      { label: 'Tasks', value: recordsToPrint.length }, { label: 'Done', value: recordsToPrint.filter((record) => record.status === 'done').length },
      { label: 'Blocked', value: recordsToPrint.filter((record) => record.status === 'blocked').length },
    ]
    if (module === 'guests') return [
      { label: 'Guest records', value: recordsToPrint.length }, { label: 'Planned heads', value: recordsToPrint.reduce((sum, record) => sum + partySize(record), 0) },
      { label: 'Confirmed', value: recordsToPrint.filter((record) => (record.rsvp as Record<string, unknown> | null)?.attending === true).length },
    ]
    if (module === 'vendors') return [
      { label: 'Vendors', value: recordsToPrint.length }, { label: 'Contracts signed', value: recordsToPrint.filter((record) => record.contractStatus === 'signed').length },
      { label: 'Paid', value: recordsToPrint.filter((record) => record.paymentStatus === 'paid').length },
    ]
    if (module === 'seating') return [
      { label: 'Tables', value: recordsToPrint.length }, { label: 'Capacity', value: recordsToPrint.reduce((sum, record) => sum + Number(record.capacity ?? 0), 0) },
    ]
    return [{ label: 'Records', value: recordsToPrint.length }]
  }

  function printOverview() {
    const overview = loadResult.overview ?? {}
    const wedding = (overview.wedding ?? {}) as Record<string, unknown>
    const tasks = (overview.tasks ?? {}) as Record<string, unknown>
    const guests = (overview.guests ?? {}) as Record<string, unknown>
    const budget = (overview.budget ?? {}) as Record<string, unknown>
    const vendors = (overview.vendors ?? {}) as Record<string, unknown>
    const seating = (overview.seating ?? {}) as Record<string, unknown>
    const tables = Array.isArray(seating.tables) ? seating.tables : []
    const rows: PlannerDocumentRow[] = [
      ['Readiness', `${text(overview.readiness)}%`],
      ['Tasks', `${text(tasks.completed)} complete · ${text(tasks.overdue)} overdue · ${text(tasks.open)} open`],
      ['Guests', `${text(guests.confirmed)} confirmed · ${text(guests.pending)} pending · ${text(guests.unseated)} unseated`],
      ['Budget', `${money(budget.paid, text(budget.currency) || 'USD')} paid · ${money(budget.outstanding, text(budget.currency) || 'USD')} outstanding`],
      ['Vendors', `${text(vendors.total)} recorded`],
      ['Seating', `${tables.length} tables`],
    ].map(([metric, value], index) => ({ id: String(index), cells: { metric, value } }))
    const ok = openPlannerPrintDocument({
      weddingTitle: text(wedding.title) || session?.activeWedding?.title || 'Wedding',
      weddingDate: text(wedding.date) || session?.activeWedding?.date,
      location: [text(wedding.venue), text(wedding.venueCity)].filter(Boolean).join(' · '),
      worksheetName: 'Planner Overview', scopeLabel: 'Current saved wedding summary', orientation: 'portrait',
      columns: [{ key: 'metric', label: 'Area' }, { key: 'value', label: 'Current position' }], rows,
      summary: [{ label: 'Readiness', value: `${text(overview.readiness)}%` }],
      note: 'Operational summary generated from the current saved Planner data.',
    })
    if (!ok) toast({ title: 'Pop-up blocked', description: 'Allow pop-ups for Wewed, then try Print / Save PDF again.', variant: 'destructive' })
  }

  function printRecords(scope: 'full' | 'current' | 'selected') {
    if (module === 'overview') {
      printOverview()
      return
    }
    let target = scope === 'selected' ? selectedRecords : scope === 'current' ? currentView : records
    if (module === 'guests') target = guestPresetRows(target, guestPreset)
    const wedding = session?.activeWedding
    const scopeLabel = scope === 'selected' ? `${target.length} selected record${target.length === 1 ? '' : 's'}` : scope === 'current' ? 'Current filtered view' : 'Full worksheet'
    const ok = openPlannerPrintDocument({
      weddingTitle: wedding?.title || 'Wedding', weddingDate: wedding?.date,
      location: [wedding?.venue, wedding?.venueCity, wedding?.venueCountry].filter(Boolean).join(' · '),
      worksheetName: MODULE_LABELS[module], scopeLabel: module === 'guests' ? `${scopeLabel} · ${titleCase(guestPreset)} preset` : scopeLabel,
      orientation: orientation(), columns: printColumns(module, guestPreset), rows: printRows(module, target, guestPreset),
      summary: printSummary(target), note: module === 'timeline' ? 'Timeline clock time remains authoritative; custom presentation order does not change event times.' : null,
    })
    if (!ok) toast({ title: 'Pop-up blocked', description: 'Allow pop-ups for Wewed, then try Print / Save PDF again.', variant: 'destructive' })
  }

  async function patchRecord(record: WorkspaceRecord, updates: Record<string, unknown>) {
    if (module === 'seating') {
      return jsonRequest(`/api/planner/guests/${record.id}?kind=table`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
    }
    return jsonRequest(`/api/planner/${module}/${record.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
  }

  async function deleteRecord(record: WorkspaceRecord) {
    const endpoint = module === 'seating' ? `/api/planner/guests/${record.id}?kind=table` : `/api/planner/${module}/${record.id}`
    return jsonRequest(endpoint, { method: 'DELETE' })
  }

  async function applyBulkAction() {
    if (!selectedRecords.length || !bulkAction) return
    setBusy(true)
    try {
      if (bulkAction === 'move_top' || bulkAction === 'move_bottom') {
        moveSelected(bulkAction === 'move_top' ? 'top' : 'bottom')
        toast({ title: 'Selection repositioned', description: 'Review the order, then choose Save order.' })
        return
      }

      if (bulkAction === 'delete') {
        const weddingTitle = session?.activeWedding?.title || 'the active wedding'
        const consequence = module === 'budget'
          ? 'This removes financial worksheet records. Existing paid/actual values will be deleted with them.'
          : module === 'vendors'
            ? 'Vendor records and their planner pipeline entries will be removed. Linked budget items retain their saved vendor name where available.'
            : module === 'guests'
              ? 'Guest, RSVP and seating relationships for these records will be removed.'
              : module === 'seating'
                ? 'Guests assigned to deleted tables will become unassigned.'
                : 'These worksheet records will be permanently removed.'
        if (!window.confirm(`Delete ${selectedRecords.length} ${MODULE_LABELS[module].toLowerCase()} record${selectedRecords.length === 1 ? '' : 's'} from ${weddingTitle}?\n\n${consequence}\n\nThis action is not reversible from this screen.`)) return
        for (const record of selectedRecords) await deleteRecord(record)
      } else if (module === 'guests' && bulkAction === 'table') {
        await jsonRequest('/api/planner/guests', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'bulk_assignment', guestIds: selectedRecords.map((record) => record.id), seatingTableId: bulkValue || null }),
        })
      } else {
        const updates: Record<string, unknown> = {}
        if (module === 'tasks') {
          if (bulkAction === 'status') updates.status = bulkValue
          if (bulkAction === 'priority') updates.priority = bulkValue
          if (bulkAction === 'category') updates.category = bulkValue
          if (bulkAction === 'assignee') updates.assignee = bulkValue || null
        }
        if (module === 'budget') {
          if (bulkAction === 'category') updates.category = bulkValue
          if (bulkAction === 'dueDate') updates.dueDate = bulkValue || null
          if (bulkAction === 'vendor') {
            const vendor = loadResult.vendorOptions?.find((candidate) => candidate.id === bulkValue)
            updates.vendorId = vendor?.id ?? null
            updates.vendorName = vendor ? text(vendor.name) : null
          }
        }
        if (module === 'vendors') {
          if (bulkAction === 'contractStatus') updates.contractStatus = bulkValue
          if (bulkAction === 'paymentStatus') updates.paymentStatus = bulkValue
        }
        if (module === 'guests') {
          if (bulkAction === 'side') updates.side = bulkValue
          if (bulkAction === 'role') updates.role = bulkValue
        }
        if (module === 'timeline' && bulkAction === 'location') updates.location = bulkValue || null
        if (!Object.keys(updates).length) throw new Error('Choose a valid bulk action and destination.')
        for (const record of selectedRecords) await patchRecord(record, updates)
      }

      toast({ title: 'Bulk action complete', description: `${selectedRecords.length} record${selectedRecords.length === 1 ? '' : 's'} updated for this wedding.` })
      await load()
    } catch (error) {
      toast({ title: 'Bulk action failed', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  function actionOptions(): Array<[string, string]> {
    const common: Array<[string, string]> = [['move_top', 'Move selected to top'], ['move_bottom', 'Move selected to bottom']]
    if (module === 'tasks') return [...common, ['status', 'Change status'], ['priority', 'Change priority'], ['category', 'Change category'], ['assignee', 'Assign / reassign'], ['delete', 'Delete selected']]
    if (module === 'budget') return [...common, ['category', 'Change category'], ['dueDate', 'Set due date'], ['vendor', 'Link vendor'], ['delete', 'Delete selected']]
    if (module === 'vendors') return [...common, ['contractStatus', 'Change contract status'], ['paymentStatus', 'Change payment status'], ['delete', 'Delete selected']]
    if (module === 'guests') return [...common, ['side', 'Change side'], ['role', 'Change role'], ['table', 'Assign / unassign table'], ['delete', 'Delete selected']]
    if (module === 'timeline') return [...common, ['location', 'Set location'], ['delete', 'Delete selected']]
    if (module === 'seating') return [...common, ['delete', 'Delete selected tables']]
    return []
  }

  function bulkValueControl() {
    if (!bulkAction || ['move_top', 'move_bottom', 'delete'].includes(bulkAction)) return null
    const commonClass = 'h-10 min-w-[12rem] rounded-lg border border-gold/25 bg-espresso px-3 text-sm text-champagne'
    if (bulkAction === 'assignee' || bulkAction === 'location') return <input value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} className={commonClass} placeholder={bulkAction === 'assignee' ? 'Assignee name' : 'Location'} />
    if (bulkAction === 'dueDate') return <input type="date" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} className={commonClass} />
    if (bulkAction === 'vendor') return <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} className={commonClass}><option value="">Clear vendor link</option>{(loadResult.vendorOptions ?? []).map((vendor) => <option key={vendor.id} value={vendor.id}>{text(vendor.name)}</option>)}</select>
    if (bulkAction === 'table') return <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} className={commonClass}><option value="">Unassign selected guests</option>{(loadResult.tables ?? []).map((table) => <option key={table.id} value={table.id}>{text(table.name)} · {text(table.capacity)} seats</option>)}</select>

    const optionMap: Record<string, string[]> = {
      status: ['todo', 'in_progress', 'blocked', 'done'], priority: ['low', 'medium', 'high'],
      category: module === 'budget' ? ['venue', 'catering', 'attire', 'roora', 'decor', 'photo_video', 'music', 'transport', 'stationery', 'miscellaneous'] : ['venue', 'catering', 'attire', 'roora', 'magumo', 'transport', 'stationery', 'decor', 'photo_video', 'music', 'other'],
      contractStatus: ['signed', 'pending', 'negotiating', 'declined'], paymentStatus: ['paid', 'deposit', 'unpaid'],
      side: ['bride', 'groom', 'family', 'neutral'], role: ['guest', 'bridal_party', 'family', 'officiant', 'vip'],
    }
    const options = optionMap[bulkAction] ?? []
    return <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} className={commonClass}><option value="">Choose…</option>{options.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}</select>
  }

  if (!isPlannerWorksheet) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-planner-worksheet-command-center
        className="max-h-[94dvh] w-[96vw] max-w-5xl overflow-hidden border-gold/30 bg-espresso p-0 text-champagne"
      >
        <div className="border-b border-gold/15 px-4 py-4 sm:px-6">
          <DialogTitle className="font-serif text-2xl text-champagne">{MODULE_LABELS[module]} worksheet tools</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-champagne/55">
            Print an A4 working document, arrange presentation order, or select several records for one safe action.
          </DialogDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            {(['print', ...(module === 'overview' ? [] : ['arrange', 'select'])] as PanelMode[]).map((item) => (
              <Button key={item} type="button" size="sm" variant="outline" onClick={() => setMode(item)} className={mode === item ? 'border-gold bg-gold text-espresso hover:bg-gold-light' : 'border-gold/25 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold'}>
                {item === 'print' ? <Printer className="size-4" /> : item === 'arrange' ? <GripVertical className="size-4" /> : <CheckSquare2 className="size-4" />}
                {item === 'print' ? 'Print / Save PDF' : item === 'arrange' ? 'Arrange' : 'Select & act'}
              </Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => void load()} disabled={loading || busy} className="ml-auto text-champagne/55 hover:text-gold"><RefreshCw className="size-4" />Refresh</Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-champagne/55"><Loader2 className="size-5 animate-spin text-gold" />Loading current saved worksheet…</div> : mode === 'print' ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4">
                <h3 className="font-serif text-xl">A4 working document</h3>
                <p className="mt-1 text-sm leading-6 text-champagne/55">The same clean document is used for physical printing and your browser's Save as PDF option. Printing never changes worksheet data.</p>
                {module === 'guests' && <label className="mt-4 block max-w-sm text-sm text-champagne/70">Guest document preset<select value={guestPreset} onChange={(event) => setGuestPreset(event.target.value as GuestPrintPreset)} className="mt-2 h-11 w-full rounded-lg border border-gold/25 bg-espresso px-3"><option value="full">Full guest list</option><option value="rsvp">RSVP list</option><option value="catering">Catering / dietary list</option><option value="checkin">Check-in list</option><option value="seating">Seating assignment list</option></select></label>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => printRecords('full')} className="bg-gold text-espresso hover:bg-gold-light"><Printer className="size-4" />Print full worksheet</Button>
                  {module !== 'overview' && <Button type="button" variant="outline" onClick={() => printRecords('current')} className="border-gold/25 bg-transparent text-champagne/75"><Printer className="size-4" />Print current view ({currentView.length})</Button>}
                  {selectedRecords.length > 0 && <Button type="button" variant="outline" onClick={() => printRecords('selected')} className="border-gold/25 bg-transparent text-gold"><Printer className="size-4" />Print selected ({selectedRecords.length})</Button>}
                </div>
              </div>
              {module !== 'overview' && <p className="text-xs leading-5 text-champagne/45">Full worksheet uses the saved presentation order. Current view respects the filters currently shown in the Planner URL. Status is always printed as text so the document remains understandable in grayscale.</p>}
            </div>
          ) : (
            <div className="space-y-4">
              {mode === 'arrange' && <div className="rounded-xl border border-gold/20 bg-gold/[0.05] p-3 text-sm text-champagne/65"><strong className="text-gold">Presentation order only.</strong> Reordering does not change budget values, guest data, seating capacity, or timeline clock times. Drag on desktop or use the arrow controls on any device.{hasFilters ? ' Active filters do not hide records here, so saving cannot accidentally scramble unseen items.' : ''}</div>}
              {mode === 'select' && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/15 bg-champagne/[0.035] p-3"><Button type="button" size="sm" variant="outline" onClick={() => setSelectedIds(new Set(currentView.map((record) => record.id)))} className="border-gold/25 bg-transparent text-champagne/70">Select all in current view ({currentView.length})</Button><Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-champagne/55"><X className="size-4" />Clear selection</Button><span className="ml-auto text-sm text-gold">{selectedIds.size} selected</span></div>}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={workingOrder} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {records.length === 0 ? <div className="rounded-xl border border-dashed border-gold/20 p-10 text-center text-champagne/50">No records in this worksheet yet.</div> : records.map((record) => (
                      <SortableRecord key={record.id} module={module} record={record} selected={selectedIds.has(record.id)} onToggle={() => toggleSelected(record.id)} onMove={(direction) => moveRecord(record.id, direction)} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {mode === 'arrange' && <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-2xl border border-gold/25 bg-espresso/98 p-3 shadow-2xl"><span className="mr-auto text-xs text-champagne/50">{orderChanged ? 'Order changed — save to make it durable.' : 'Saved order is current.'}</span><Button type="button" variant="ghost" disabled={!orderChanged || busy} onClick={() => setWorkingOrder(savedOrder)} className="text-champagne/60">Reset</Button><Button type="button" disabled={!orderChanged || busy} onClick={() => void saveOrder()} className="bg-gold text-espresso hover:bg-gold-light">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Save order</Button></div>}

              {mode === 'select' && selectedIds.size > 0 && <div className="sticky bottom-0 rounded-2xl border border-gold/30 bg-espresso/98 p-3 shadow-2xl"><div className="flex flex-wrap items-center gap-2"><span className="mr-auto text-sm text-champagne"><strong className="text-gold">{selectedIds.size}</strong> selected</span><select value={bulkAction} onChange={(event) => { setBulkAction(event.target.value); setBulkValue('') }} className="h-10 min-w-[13rem] rounded-lg border border-gold/25 bg-espresso px-3 text-sm"><option value="">Choose action…</option>{actionOptions().map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{bulkValueControl()}<Button type="button" disabled={!bulkAction || busy || (!['move_top', 'move_bottom', 'delete'].includes(bulkAction) && bulkValue === '' && !['vendor', 'table', 'assignee', 'location'].includes(bulkAction))} onClick={() => void applyBulkAction()} className="bg-gold text-espresso hover:bg-gold-light">{busy ? <Loader2 className="size-4 animate-spin" /> : bulkAction === 'delete' ? <Trash2 className="size-4" /> : null}Apply</Button><Button type="button" variant="outline" onClick={() => printRecords('selected')} className="border-gold/25 bg-transparent text-gold"><Printer className="size-4" />Print selected</Button></div><p className="mt-2 text-[11px] leading-4 text-champagne/40">Destructive actions describe their consequences before execution. Financial paid/actual values and timeline event times are deliberately excluded from generic bulk overwrite.</p></div>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
