'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  Loader2,
  MapPin,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Table2,
  Undo2,
  UserCheck,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface EventData {
  generatedAt: string
  wedding: {
    id: string
    slug: string
    title: string
    date: string
    venue: string
    venueCity: string
    venueCountry: string
  }
  stats: {
    totalGuests: number
    expectedGuests: number
    expectedHeads: number
    checkedInGuests: number
    checkedInHeads: number
    remainingHeads: number
    unseatedHeads: number
    openIssues: number
    openCriticalIssues: number
    timelineComplete: number
    timelineTotal: number
    readiness: number
  }
  guests: Array<{
    id: string
    name: string
    email: string | null
    phone: string | null
    role: string
    side: string | null
    tableId: string | null
    tableName: string | null
    attending: boolean | null
    mealChoice: string | null
    dietaryNotes: string | null
    plusOneName: string | null
    checkedIn: boolean
    checkedInAt: string | null
    partySize: number
    checkedInHeads: number
  }>
  tables: Array<{
    id: string
    name: string
    capacity: number
    position: string | null
    expectedHeads: number
    checkedInHeads: number
    remaining: number
    overCapacity: boolean
  }>
  timeline: Array<{
    id: string
    time: string
    title: string
    description: string | null
    order: number
    status: 'pending' | 'in_progress' | 'complete' | 'held'
    statusUpdatedAt: string | null
  }>
  issues: Array<{
    id: string
    status: string
    title: string
    notes: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    owner: string
    createdAt: string
    resolvedAt: string | null
    resolvedBy: string | null
  }>
}

type GuestFilter = 'expected' | 'all' | 'checked_in' | 'remaining' | 'unseated'
type TimelineStatus = 'pending' | 'in_progress' | 'complete' | 'held'

const TIMELINE_STATUSES: Array<{ value: TimelineStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'Live' },
  { value: 'complete', label: 'Complete' },
  { value: 'held', label: 'Held' },
]

function attendanceLabel(value: boolean | null): string {
  return value === true ? 'Attending' : value === false ? 'Declined' : 'Pending RSVP'
}

function severityClass(value: string): string {
  if (value === 'critical') return 'border-clay/50 bg-clay/15 text-clay-light'
  if (value === 'high') return 'border-amber-400/40 bg-amber-400/10 text-amber-200'
  if (value === 'low') return 'border-sage/35 bg-sage/10 text-sage-light'
  return 'border-gold/30 bg-gold/10 text-gold'
}

function timelineClass(value: TimelineStatus): string {
  if (value === 'complete') return 'border-sage/40 bg-sage/10 text-sage-light'
  if (value === 'in_progress') return 'border-gold/45 bg-gold/15 text-gold'
  if (value === 'held') return 'border-clay/40 bg-clay/10 text-clay-light'
  return 'border-champagne/15 bg-champagne/5 text-champagne/55'
}

export function PlannerEventCommand() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<EventData | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<GuestFilter>('expected')
  const [issueForm, setIssueForm] = useState({
    title: '',
    notes: '',
    severity: 'medium' as EventData['issues'][number]['severity'],
    owner: '',
  })

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/planner/event-day', { cache: 'no-store' })
      const payload = (await response.json()) as EventData & { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load wedding-day operations.')
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load wedding-day operations.')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void load(true)
    const timer = window.setInterval(() => void load(false), 15_000)
    return () => window.clearInterval(timer)
  }, [open, load])

  async function action(body: Record<string, unknown>, id: string, successTitle: string) {
    setBusyId(id)
    setError(null)
    try {
      const response = await fetch('/api/planner/event-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'The wedding-day update failed.')
      await load(false)
      toast({ title: successTitle })
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'The wedding-day update failed.'
      setError(message)
      toast({ title: 'Update failed', description: message, variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  async function setCheckIn(guest: EventData['guests'][number]) {
    await action(
      { action: 'set_check_in', guestId: guest.id, checkedIn: !guest.checkedIn },
      `guest-${guest.id}`,
      guest.checkedIn ? `${guest.name} checked out` : `${guest.name} checked in`,
    )
  }

  async function setTimelineStatus(itemId: string, status: TimelineStatus) {
    await action(
      { action: 'set_timeline_status', itemId, status },
      `timeline-${itemId}`,
      `Run-sheet status changed to ${status.replaceAll('_', ' ')}`,
    )
  }

  async function createIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!issueForm.title.trim()) return
    await action(
      { action: 'create_issue', ...issueForm },
      'new-issue',
      'Wedding-day issue logged',
    )
    setIssueForm({ title: '', notes: '', severity: 'medium', owner: '' })
  }

  async function toggleIssue(issue: EventData['issues'][number]) {
    const resolved = issue.status === 'resolved'
    await action(
      { action: resolved ? 'reopen_issue' : 'resolve_issue', issueId: issue.id },
      `issue-${issue.id}`,
      resolved ? 'Issue reopened' : 'Issue resolved',
    )
  }

  const visibleGuests = useMemo(() => {
    if (!data) return []
    const query = search.trim().toLowerCase()
    return data.guests.filter((guest) => {
      const matchesSearch = !query || [guest.name, guest.email, guest.phone, guest.tableName, guest.plusOneName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
      if (!matchesSearch) return false
      if (filter === 'expected') return guest.attending === true
      if (filter === 'checked_in') return guest.checkedIn
      if (filter === 'remaining') return guest.attending === true && !guest.checkedIn
      if (filter === 'unseated') return guest.attending === true && !guest.tableId
      return true
    })
  }, [data, filter, search])

  const openIssues = useMemo(
    () => data?.issues.filter((issue) => issue.status !== 'resolved') ?? [],
    [data],
  )
  const resolvedIssues = useMemo(
    () => data?.issues.filter((issue) => issue.status === 'resolved') ?? [],
    [data],
  )

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        title="Open wedding-day command centre"
        className="border-gold/25 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold"
      >
        <UserCheck className="size-3.5" />
        <span className="hidden lg:inline">Wedding Day</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[95vh] w-[98vw] max-w-[1500px] flex-col gap-0 overflow-hidden border-gold/30 bg-espresso p-0 text-champagne"
        >
          <DialogTitle className="sr-only">Wedding Day Command Centre</DialogTitle>
          <DialogDescription className="sr-only">
            Live guest arrivals, run sheet, issue management and table status for the active wedding.
          </DialogDescription>

          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-gold/15 px-4 py-4 sm:px-6">
            <div>
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gold/70">Phase 6 · Live Event Operations</p>
              <h2 className="mt-1 font-serif text-2xl">Wedding Day Command Centre</h2>
              {data && (
                <p className="mt-1 flex flex-wrap items-center gap-2 font-sans text-xs text-champagne/50">
                  <span>{data.wedding.title}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{data.wedding.venue}</span>
                  <span>·</span>
                  <span>{new Date(data.wedding.date).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void load(true)}
                disabled={loading}
                className="border-gold/25 bg-transparent"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-3 rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 font-sans text-sm text-clay-light sm:mx-6">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <Loader2 className="size-8 animate-spin text-gold" />
            </div>
          ) : data ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-gold/10 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6 sm:px-6">
                <Metric label="Readiness" value={`${data.stats.readiness}%`} alert={data.stats.readiness < 60} />
                <Metric label="Expected heads" value={data.stats.expectedHeads} />
                <Metric label="Checked in" value={data.stats.checkedInHeads} />
                <Metric label="Remaining" value={data.stats.remainingHeads} alert={data.stats.remainingHeads > 0} />
                <Metric label="Unseated" value={data.stats.unseatedHeads} alert={data.stats.unseatedHeads > 0} />
                <Metric label="Open issues" value={data.stats.openIssues} alert={data.stats.openCriticalIssues > 0} />
              </div>

              <Tabs defaultValue="check-in" className="flex min-h-0 flex-1 flex-col">
                <TabsList className="mx-4 mt-3 h-auto shrink-0 flex-wrap justify-start bg-transparent sm:mx-6">
                  <TabsTrigger value="check-in">Check-in</TabsTrigger>
                  <TabsTrigger value="run-sheet">Run sheet</TabsTrigger>
                  <TabsTrigger value="issues">Issues</TabsTrigger>
                  <TabsTrigger value="tables">Tables</TabsTrigger>
                </TabsList>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6">
                  <TabsContent value="check-in" className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" />
                        <Input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search guest, phone, email, plus-one or table"
                          className="border-gold/20 bg-espresso/60 pl-9"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          ['expected', 'Expected'],
                          ['remaining', 'Remaining'],
                          ['checked_in', 'Checked in'],
                          ['unseated', 'Unseated'],
                          ['all', 'All guests'],
                        ] as Array<[GuestFilter, string]>).map(([value, label]) => (
                          <Button
                            key={value}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setFilter(value)}
                            className={filter === value ? 'border-gold/50 bg-gold/15 text-gold' : 'border-gold/15 bg-transparent text-champagne/55'}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                      <Button asChild size="sm" variant="outline" className="border-gold/25 bg-transparent">
                        <a href="/api/planner/event-day/export?kind=guest-manifest">
                          <Download className="size-3.5" /> Manifest
                        </a>
                      </Button>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gold/15">
                      {visibleGuests.length === 0 ? (
                        <Empty text="No guests match this filter." />
                      ) : visibleGuests.map((guest) => (
                        <div key={guest.id} className="grid gap-3 border-b border-gold/10 p-3 last:border-0 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] md:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-sans text-sm font-medium text-champagne">{guest.name}</p>
                              <Badge variant="outline" className={guest.attending === true ? 'border-sage/30 text-sage-light' : guest.attending === false ? 'border-clay/30 text-clay-light' : 'border-gold/25 text-gold'}>
                                {attendanceLabel(guest.attending)}
                              </Badge>
                              {guest.partySize > 1 && <Badge variant="outline" className="border-gold/20 text-champagne/60">Party of {guest.partySize}</Badge>}
                            </div>
                            <p className="mt-1 truncate font-sans text-[11px] text-champagne/45">
                              {guest.tableName || 'No table'} · {guest.phone || guest.email || 'No contact'}
                            </p>
                            {(guest.dietaryNotes || guest.mealChoice || guest.plusOneName) && (
                              <p className="mt-1 font-sans text-[11px] text-champagne/55">
                                {[guest.mealChoice && `Meal: ${guest.mealChoice}`, guest.dietaryNotes && `Dietary: ${guest.dietaryNotes}`, guest.plusOneName && `Plus-one: ${guest.plusOneName}`].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                          <div className="font-sans text-xs text-champagne/50">
                            {guest.checkedIn ? (
                              <span className="inline-flex items-center gap-1.5 text-sage-light">
                                <CheckCircle2 className="size-4" />
                                Checked in {guest.checkedInAt ? new Date(guest.checkedInAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5"><Circle className="size-4" /> Not arrived</span>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={guest.checkedIn ? 'outline' : 'default'}
                            disabled={busyId === `guest-${guest.id}`}
                            onClick={() => void setCheckIn(guest)}
                            className={guest.checkedIn ? 'border-clay/30 bg-transparent text-clay-light' : 'bg-gold text-espresso hover:bg-gold-light'}
                          >
                            {busyId === `guest-${guest.id}` ? <Loader2 className="size-3.5 animate-spin" /> : guest.checkedIn ? <Undo2 className="size-3.5" /> : <UserCheck className="size-3.5" />}
                            {guest.checkedIn ? 'Undo' : 'Check in'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="run-sheet" className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-xl">Live run sheet</h3>
                        <p className="font-sans text-xs text-champagne/45">Mark each scheduled moment as live, complete or held.</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="border-gold/25 bg-transparent">
                        <a href="/api/planner/event-day/export?kind=run-sheet"><Download className="size-3.5" /> Run sheet</a>
                      </Button>
                    </div>
                    {data.timeline.length === 0 ? <Empty text="No timeline entries have been saved for this wedding." /> : (
                      <div className="overflow-hidden rounded-2xl border border-gold/15">
                        {data.timeline.map((item) => (
                          <div key={item.id} className="grid gap-3 border-b border-gold/10 p-4 last:border-0 lg:grid-cols-[90px_minmax(0,1fr)_auto] lg:items-center">
                            <div className="font-mono text-sm text-gold">{item.time}</div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-sans text-sm font-medium">{item.title}</p>
                                <Badge variant="outline" className={timelineClass(item.status)}>{item.status.replaceAll('_', ' ')}</Badge>
                              </div>
                              {item.description && <p className="mt-1 font-sans text-xs text-champagne/45">{item.description}</p>}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {TIMELINE_STATUSES.map((status) => (
                                <Button
                                  key={status.value}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busyId === `timeline-${item.id}` || item.status === status.value}
                                  onClick={() => void setTimelineStatus(item.id, status.value)}
                                  className={item.status === status.value ? timelineClass(status.value) : 'border-gold/15 bg-transparent text-champagne/50'}
                                >
                                  {status.value === 'in_progress' ? <Play className="size-3" /> : status.value === 'complete' ? <Check className="size-3" /> : status.value === 'held' ? <AlertTriangle className="size-3" /> : <Clock3 className="size-3" />}
                                  {status.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="issues" className="space-y-5">
                    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                      <section className="rounded-2xl border border-gold/15 p-4">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="size-4 text-gold" />
                          <h3 className="font-serif text-xl">Log an issue</h3>
                        </div>
                        <form onSubmit={createIssue} className="mt-4 space-y-3">
                          <div className="space-y-1.5">
                            <Label>Issue</Label>
                            <Input required value={issueForm.title} onChange={(event) => setIssueForm((value) => ({ ...value, title: event.target.value }))} className="border-gold/20 bg-espresso/60" />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label>Severity</Label>
                              <Select value={issueForm.severity} onValueChange={(severity: EventData['issues'][number]['severity']) => setIssueForm((value) => ({ ...value, severity }))}>
                                <SelectTrigger className="border-gold/20 bg-espresso/60"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Owner</Label>
                              <Input value={issueForm.owner} onChange={(event) => setIssueForm((value) => ({ ...value, owner: event.target.value }))} placeholder="Coordinator or vendor" className="border-gold/20 bg-espresso/60" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Notes</Label>
                            <Textarea rows={5} value={issueForm.notes} onChange={(event) => setIssueForm((value) => ({ ...value, notes: event.target.value }))} className="border-gold/20 bg-espresso/60" />
                          </div>
                          <Button disabled={busyId === 'new-issue'} className="bg-gold text-espresso hover:bg-gold-light">
                            {busyId === 'new-issue' ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />}
                            Log issue
                          </Button>
                        </form>
                      </section>

                      <section className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-serif text-xl">Issue board</h3>
                            <p className="font-sans text-xs text-champagne/45">{openIssues.length} open · {resolvedIssues.length} resolved</p>
                          </div>
                          <Button asChild size="sm" variant="outline" className="border-gold/25 bg-transparent">
                            <a href="/api/planner/event-day/export?kind=issues"><Download className="size-3.5" /> Issues</a>
                          </Button>
                        </div>
                        {data.issues.length === 0 ? <Empty text="No wedding-day issues have been logged." /> : (
                          [...openIssues, ...resolvedIssues].map((issue) => (
                            <div key={issue.id} className={`rounded-xl border p-4 ${issue.status === 'resolved' ? 'border-sage/15 bg-sage/[0.025] opacity-65' : 'border-gold/15'}`}>
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-sans text-sm font-medium">{issue.title}</p>
                                    <Badge variant="outline" className={severityClass(issue.severity)}>{issue.severity}</Badge>
                                    {issue.status === 'resolved' && <Badge variant="outline" className="border-sage/30 text-sage-light">Resolved</Badge>}
                                  </div>
                                  <p className="mt-1 font-sans text-[11px] text-champagne/45">
                                    {issue.owner ? `Owner: ${issue.owner} · ` : ''}{new Date(issue.createdAt).toLocaleString('en-US')}
                                  </p>
                                  {issue.notes && <p className="mt-2 whitespace-pre-wrap font-sans text-xs leading-5 text-champagne/65">{issue.notes}</p>}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busyId === `issue-${issue.id}`}
                                  onClick={() => void toggleIssue(issue)}
                                  className={issue.status === 'resolved' ? 'border-gold/25 bg-transparent' : 'border-sage/30 bg-transparent text-sage-light'}
                                >
                                  {issue.status === 'resolved' ? <Undo2 className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                                  {issue.status === 'resolved' ? 'Reopen' : 'Resolve'}
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </section>
                    </div>
                  </TabsContent>

                  <TabsContent value="tables" className="space-y-4">
                    <div>
                      <h3 className="font-serif text-xl">Live table status</h3>
                      <p className="font-sans text-xs text-champagne/45">Expected seats and checked-in heads are calculated from saved guest parties.</p>
                    </div>
                    {data.tables.length === 0 ? <Empty text="No seating tables have been created." /> : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {data.tables.map((table) => (
                          <section key={table.id} className={`rounded-2xl border p-4 ${table.overCapacity ? 'border-clay/40 bg-clay/5' : 'border-gold/15'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2"><Table2 className="size-4 text-gold" /><h4 className="font-sans text-sm font-medium">{table.name}</h4></div>
                                {table.position && <p className="mt-1 font-sans text-[11px] text-champagne/40">{table.position}</p>}
                              </div>
                              {table.overCapacity && <Badge variant="outline" className="border-clay/40 text-clay-light">Over capacity</Badge>}
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                              <TableMetric label="Expected" value={table.expectedHeads} />
                              <TableMetric label="Arrived" value={table.checkedInHeads} />
                              <TableMetric label="Capacity" value={table.capacity} />
                            </div>
                            <Progress value={Math.min(100, table.capacity ? (table.expectedHeads / table.capacity) * 100 : 0)} className="mt-4 h-2 bg-champagne/10 [&>div]:bg-gold" />
                          </section>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          ) : (
            <Empty text="Wedding-day operations are unavailable." />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Metric({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${alert ? 'border-clay/30 bg-clay/5' : 'border-gold/10 bg-gold/[0.025]'}`}>
      <p className={`font-serif text-xl ${alert ? 'text-clay-light' : 'text-champagne'}`}>{value}</p>
      <p className="font-sans text-[9px] uppercase tracking-[0.14em] text-champagne/40">{label}</p>
    </div>
  )
}

function TableMetric({ label, value }: { label: string; value: number }) {
  return <div><p className="font-serif text-xl">{value}</p><p className="font-sans text-[9px] uppercase tracking-wider text-champagne/40">{label}</p></div>
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center font-sans text-sm text-champagne/45">{text}</div>
}
