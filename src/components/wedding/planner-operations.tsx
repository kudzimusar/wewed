'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  LayoutGrid,
  Loader2,
  Mail,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface Overview {
  generatedAt: string
  wedding: { title: string; date: string; venue: string; venueCity: string; lifecycle: string }
  readiness: number
  tasks: {
    total: number
    completed: number
    open: number
    overdue: number
    dueToday: number
    dueSoon: number
    priority: Array<{ id: string; title: string; dueDate: string | null; priority: string; status: string }>
  }
  guests: {
    total: number
    confirmed: number
    declined: number
    pending: number
    unseated: number
    confirmedHeads: number
    withoutEmail: number
  }
  seating: {
    tables: Array<{ id: string; name: string; capacity: number; occupied: number; remaining: number; overCapacity: boolean }>
    unseatedGuests: Array<{ id: string; name: string; headcount: number }>
  }
  budget: {
    currency: string
    estimated: number
    actual: number
    paid: number
    outstanding: number
    overduePayments: number
  }
  vendors: { total: number; featured: number }
  timeline: Array<{ id: string; time: string; title: string; description: string | null; order: number }>
  reminders: { total: number; scheduled: number; sent: number; failed: number }
  imports: ImportJob[]
  activity: Array<{ id: string; action: string; resourceType: string; createdAt: string }>
}

interface Reminder {
  id: string
  name: string
  subject: string
  body: string
  audience: 'all' | 'pending' | 'attending' | 'declined'
  status: string
  scheduledFor: string | null
  recipientCount: number
  lastError: string | null
  lastSentAt: string | null
}

interface PlannerTemplate {
  id: string
  name: string
  description: string
  source: 'system' | 'wedding'
  version: number
  items: Array<{ type: 'task' | 'timeline' | 'reminder' }>
}

interface ImportJob {
  id?: string
  jobId?: string
  moduleKey: string
  fileName: string
  status: string
  totalRows: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  rollbackToken: string | null
  createdAt: string
}

const EMPTY_REMINDER = {
  name: '',
  subject: 'A reminder to RSVP for {{wedding_title}}',
  body: 'Hello {{guest_name}},\n\nPlease submit your RSVP here: {{rsvp_link}}\n\nWedding date: {{wedding_date}}',
  audience: 'pending' as Reminder['audience'],
  scheduledFor: '',
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString('en-US')}`
  }
}

function dateTimeInputValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function PlannerOperations() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [templates, setTemplates] = useState<PlannerTemplate[]>([])
  const [deliveryConfigured, setDeliveryConfigured] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reminderForm, setReminderForm] = useState(EMPTY_REMINDER)
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null)
  const [savingReminder, setSavingReminder] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [seatingPreview, setSeatingPreview] = useState<{
    assignmentCount: number
    unassignedCount: number
    assignments: Array<{ guestName: string; tableName: string; headcount: number }>
  } | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [overviewResponse, remindersResponse, templatesResponse] = await Promise.all([
        fetch('/api/planner/overview', { cache: 'no-store' }),
        fetch('/api/planner/reminders', { cache: 'no-store' }),
        fetch('/api/planner/templates', { cache: 'no-store' }),
      ])
      const overviewPayload = await overviewResponse.json()
      const remindersPayload = await remindersResponse.json()
      const templatesPayload = await templatesResponse.json()
      if (!overviewResponse.ok || !overviewPayload.success) throw new Error(overviewPayload.error || 'Unable to load overview.')
      if (!remindersResponse.ok || !remindersPayload.success) throw new Error(remindersPayload.error || 'Unable to load reminders.')
      if (!templatesResponse.ok || !templatesPayload.success) throw new Error(templatesPayload.error || 'Unable to load templates.')
      setOverview(overviewPayload)
      setReminders(remindersPayload.data ?? [])
      setDeliveryConfigured(remindersPayload.deliveryConfigured === true)
      setTemplates(templatesPayload.data ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load planner operations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadAll()
  }, [open, loadAll])

  const readinessLabel = useMemo(() => {
    if (!overview) return 'Loading'
    if (overview.readiness >= 85) return 'Ready'
    if (overview.readiness >= 60) return 'On track'
    if (overview.readiness >= 35) return 'Needs attention'
    return 'At risk'
  }, [overview])

  async function saveReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingReminder(true)
    setError(null)
    try {
      const response = await fetch('/api/planner/reminders', {
        method: editingReminderId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingReminderId ? { id: editingReminderId } : {}),
          ...reminderForm,
          scheduledFor: reminderForm.scheduledFor
            ? new Date(reminderForm.scheduledFor).toISOString()
            : null,
          status: reminderForm.scheduledFor ? 'scheduled' : 'draft',
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save reminder.')
      toast({ title: editingReminderId ? 'Reminder updated' : 'Reminder created' })
      setReminderForm(EMPTY_REMINDER)
      setEditingReminderId(null)
      await loadAll()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save reminder.')
    } finally {
      setSavingReminder(false)
    }
  }

  function editReminder(reminder: Reminder) {
    setEditingReminderId(reminder.id)
    setReminderForm({
      name: reminder.name,
      subject: reminder.subject,
      body: reminder.body,
      audience: reminder.audience,
      scheduledFor: dateTimeInputValue(reminder.scheduledFor),
    })
  }

  async function previewOrSendReminder(reminder: Reminder, dryRun: boolean) {
    if (!dryRun && !window.confirm(`Send “${reminder.name}” to the selected RSVP audience now?`)) return
    setBusyId(reminder.id)
    setError(null)
    try {
      const response = await fetch('/api/planner/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reminder.id, dryRun }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Reminder action failed.')
      if (dryRun) {
        const sample = (payload.recipients ?? []).slice(0, 5).map((item: { email: string }) => item.email).join(', ')
        toast({
          title: `Preview: ${payload.recipientCount} recipient${payload.recipientCount === 1 ? '' : 's'}`,
          description: sample || 'No guests match this audience.',
        })
      } else {
        toast({ title: `Sent ${payload.sent} reminder${payload.sent === 1 ? '' : 's'}`, description: payload.failed ? `${payload.failed} failed` : undefined })
        await loadAll()
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Reminder action failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function cancelReminder(id: string) {
    if (!window.confirm('Cancel this reminder?')) return
    setBusyId(id)
    try {
      const response = await fetch('/api/planner/reminders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to cancel reminder.')
      await loadAll()
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel reminder.')
    } finally {
      setBusyId(null)
    }
  }

  async function applyTemplate(template: PlannerTemplate) {
    if (!window.confirm(`Apply “${template.name}”? Existing matching items will be skipped.`)) return
    setBusyId(template.id)
    try {
      const response = await fetch('/api/planner/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', templateId: template.id }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to apply template.')
      const result = payload.result
      toast({
        title: `${template.name} applied`,
        description: `${result.tasksCreated} tasks · ${result.timelineCreated} timeline · ${result.remindersCreated} reminders · ${result.duplicatesSkipped} duplicates skipped`,
      })
      await loadAll()
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Unable to apply template.')
    } finally {
      setBusyId(null)
    }
  }

  async function saveCurrentTemplate() {
    const name = templateName.trim()
    if (!name) return
    setBusyId('save-template')
    try {
      const response = await fetch('/api/planner/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_current', name }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save template.')
      setTemplateName('')
      toast({ title: 'Current wedding saved as a template' })
      await loadAll()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save template.')
    } finally {
      setBusyId(null)
    }
  }

  async function archiveTemplate(id: string) {
    if (!window.confirm('Archive this custom template?')) return
    setBusyId(id)
    try {
      const response = await fetch('/api/planner/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to archive template.')
      await loadAll()
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Unable to archive template.')
    } finally {
      setBusyId(null)
    }
  }

  async function autoSeat(dryRun: boolean) {
    if (!dryRun && !window.confirm('Apply the displayed capacity-safe seating assignments?')) return
    setBusyId('seating')
    try {
      const response = await fetch('/api/planner/seating/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to generate seating plan.')
      setSeatingPreview(payload)
      if (!dryRun) {
        toast({ title: `${payload.assignmentCount} guests assigned`, description: `${payload.unassignedCount} could not fit` })
        await loadAll()
      }
    } catch (seatError) {
      setError(seatError instanceof Error ? seatError.message : 'Unable to generate seating plan.')
    } finally {
      setBusyId(null)
    }
  }

  async function rollbackImport(job: ImportJob) {
    const jobId = job.id ?? job.jobId
    if (!jobId || !job.rollbackToken || !window.confirm(`Roll back ${job.fileName}?`)) return
    setBusyId(jobId)
    try {
      const response = await fetch(`/api/imports/${encodeURIComponent(jobId)}?rollbackToken=${encodeURIComponent(job.rollbackToken)}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to roll back import.')
      toast({ title: 'Import rolled back', description: `${payload.rollback.deleted} deleted · ${payload.rollback.restored} restored` })
      await loadAll()
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : 'Unable to roll back import.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed right-24 top-2 z-[121] gap-1.5 bg-gold text-espresso shadow-lg hover:bg-gold-light"
      >
        <Sparkles className="size-3.5" />
        <span className="hidden sm:inline">Daily Ops</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[94vh] w-[96vw] max-w-7xl flex-col gap-0 overflow-hidden border-gold/30 bg-espresso p-0 text-champagne">
          <div className="flex items-center justify-between border-b border-gold/15 px-6 py-4">
            <div>
              <DialogTitle className="wewed-heading text-2xl">Daily Planner Operations</DialogTitle>
              <DialogDescription className="text-champagne/55">
                Today’s priorities, RSVP communications, reusable templates, seating and import history.
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading} className="border-gold/30 bg-transparent text-champagne hover:bg-gold/10">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh
            </Button>
          </div>

          {error && (
            <div className="mx-6 mt-3 flex items-center gap-2 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay-light">
              <AlertCircle className="size-4" /> {error}
            </div>
          )}

          <Tabs defaultValue="today" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-6 mt-3 h-auto flex-wrap justify-start bg-transparent">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="reminders">Reminders</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="seating">Seating</TabsTrigger>
              <TabsTrigger value="imports">Imports</TabsTrigger>
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
              <TabsContent value="today" className="space-y-5">
                {!overview ? <LoadingState /> : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
                      <Card className="border-gold/20 bg-gold/5 text-champagne">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-gold-muted">Readiness</p>
                              <p className="wewed-heading mt-1 text-4xl text-gold">{overview.readiness}%</p>
                            </div>
                            <Badge className="bg-gold/15 text-gold">{readinessLabel}</Badge>
                          </div>
                          <Progress value={overview.readiness} className="mt-4" />
                          <p className="mt-3 text-xs text-champagne/55">{overview.wedding.title} · {new Date(overview.wedding.date).toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
                        </CardContent>
                      </Card>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Metric icon={<ClipboardCheck />} label="Overdue tasks" value={overview.tasks.overdue} warning={overview.tasks.overdue > 0} />
                        <Metric icon={<Users />} label="Pending RSVPs" value={overview.guests.pending} warning={overview.guests.pending > 0} />
                        <Metric icon={<LayoutGrid />} label="Unseated" value={overview.guests.unseated} warning={overview.guests.unseated > 0} />
                        <Metric icon={<Wallet />} label="Outstanding" value={money(overview.budget.outstanding, overview.budget.currency)} warning={overview.budget.outstanding > 0} />
                      </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <Section title="Priority tasks" icon={<ClipboardCheck className="size-4" />}>
                        {overview.tasks.priority.length === 0 ? <Empty text="No dated tasks need attention." /> : overview.tasks.priority.map((task) => (
                          <div key={task.id} className="flex items-center justify-between border-b border-gold/10 py-2 last:border-0">
                            <div className="min-w-0">
                              <p className="truncate text-sm text-champagne">{task.title}</p>
                              <p className="text-[11px] text-champagne/45">{task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US') : 'No due date'} · {task.priority}</p>
                            </div>
                            {task.dueDate && new Date(task.dueDate) < new Date() && <Badge variant="outline" className="border-clay/30 text-clay-light">Overdue</Badge>}
                          </div>
                        ))}
                      </Section>
                      <Section title="Wedding-day timeline" icon={<CalendarClock className="size-4" />}>
                        {overview.timeline.length === 0 ? <Empty text="No timeline items yet. Apply the run-sheet template." /> : overview.timeline.map((item) => (
                          <div key={item.id} className="flex gap-3 border-b border-gold/10 py-2 last:border-0">
                            <span className="w-14 shrink-0 font-mono text-xs text-gold">{item.time}</span>
                            <span className="text-sm text-champagne/80">{item.title}</span>
                          </div>
                        ))}
                      </Section>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-3">
                      <Section title="Guest status" icon={<Users className="size-4" />}>
                        <KeyValue label="Total guests" value={overview.guests.total} />
                        <KeyValue label="Confirmed" value={overview.guests.confirmed} />
                        <KeyValue label="Declined" value={overview.guests.declined} />
                        <KeyValue label="Pending" value={overview.guests.pending} />
                        <KeyValue label="Confirmed heads" value={overview.guests.confirmedHeads} />
                        <KeyValue label="Missing email" value={overview.guests.withoutEmail} />
                      </Section>
                      <Section title="Budget" icon={<Wallet className="size-4" />}>
                        <KeyValue label="Estimated" value={money(overview.budget.estimated, overview.budget.currency)} />
                        <KeyValue label="Actual" value={money(overview.budget.actual, overview.budget.currency)} />
                        <KeyValue label="Paid" value={money(overview.budget.paid, overview.budget.currency)} />
                        <KeyValue label="Outstanding" value={money(overview.budget.outstanding, overview.budget.currency)} />
                        <KeyValue label="Overdue payments" value={overview.budget.overduePayments} />
                      </Section>
                      <Section title="Recent activity" icon={<Activity className="size-4" />}>
                        {overview.activity.length === 0 ? <Empty text="Activity will appear as planner actions are completed." /> : overview.activity.slice(0, 8).map((item) => (
                          <div key={item.id} className="border-b border-gold/10 py-2 last:border-0">
                            <p className="text-xs text-champagne/80">{item.action.replaceAll('.', ' ')}</p>
                            <p className="text-[10px] text-champagne/40">{new Date(item.createdAt).toLocaleString('en-US')}</p>
                          </div>
                        ))}
                      </Section>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="reminders" className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
                  <Section title={editingReminderId ? 'Edit reminder' : 'Create reminder'} icon={<Mail className="size-4" />}>
                    <form onSubmit={saveReminder} className="space-y-3">
                      <Field label="Name"><Input value={reminderForm.name} onChange={(event) => setReminderForm((value) => ({ ...value, name: event.target.value }))} required className="border-gold/25 bg-espresso/60" /></Field>
                      <Field label="Audience">
                        <Select value={reminderForm.audience} onValueChange={(audience: Reminder['audience']) => setReminderForm((value) => ({ ...value, audience }))}>
                          <SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="pending">Pending RSVP</SelectItem><SelectItem value="attending">Attending</SelectItem><SelectItem value="declined">Declined</SelectItem><SelectItem value="all">All guests with email</SelectItem></SelectContent>
                        </Select>
                      </Field>
                      <Field label="Subject"><Input value={reminderForm.subject} onChange={(event) => setReminderForm((value) => ({ ...value, subject: event.target.value }))} required className="border-gold/25 bg-espresso/60" /></Field>
                      <Field label="Message"><Textarea rows={7} value={reminderForm.body} onChange={(event) => setReminderForm((value) => ({ ...value, body: event.target.value }))} required className="border-gold/25 bg-espresso/60" /></Field>
                      <Field label="Schedule (optional)"><Input type="datetime-local" value={reminderForm.scheduledFor} onChange={(event) => setReminderForm((value) => ({ ...value, scheduledFor: event.target.value }))} className="border-gold/25 bg-espresso/60" /></Field>
                      <p className="text-[10px] text-champagne/45">Variables: {'{{guest_name}}'}, {'{{wedding_title}}'}, {'{{wedding_date}}'}, {'{{rsvp_link}}'}</p>
                      <div className="flex gap-2">
                        <Button disabled={savingReminder} className="bg-gold text-espresso hover:bg-gold-light">{savingReminder ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{editingReminderId ? 'Update' : 'Save'}</Button>
                        {editingReminderId && <Button type="button" variant="outline" onClick={() => { setEditingReminderId(null); setReminderForm(EMPTY_REMINDER) }} className="border-gold/25 bg-transparent">Cancel edit</Button>}
                      </div>
                    </form>
                  </Section>
                  <Section title="Reminder queue" icon={<Send className="size-4" />} action={<Badge variant="outline" className={deliveryConfigured ? 'border-sage/30 text-sage-light' : 'border-gold/30 text-gold'}>{deliveryConfigured ? 'Email configured' : 'Preview mode'}</Badge>}>
                    {reminders.length === 0 ? <Empty text="No reminders. Apply the RSVP reminder template or create one." /> : reminders.map((reminder) => (
                      <div key={reminder.id} className="mb-3 rounded-md border border-gold/15 bg-espresso/45 p-3 last:mb-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div><p className="text-sm font-medium">{reminder.name}</p><p className="text-[11px] text-champagne/45">{reminder.audience} · {reminder.scheduledFor ? new Date(reminder.scheduledFor).toLocaleString('en-US') : 'manual'} · {reminder.status}</p></div>
                          <Badge variant="outline" className="border-gold/25 text-gold">{reminder.recipientCount || 0} last sent</Badge>
                        </div>
                        <p className="mt-2 text-xs text-champagne/65">{reminder.subject}</p>
                        {reminder.lastError && <p className="mt-1 text-[11px] text-clay-light">{reminder.lastError}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => editReminder(reminder)} className="border-gold/25 bg-transparent">Edit</Button>
                          <Button size="sm" variant="outline" disabled={busyId === reminder.id} onClick={() => void previewOrSendReminder(reminder, true)} className="border-gold/25 bg-transparent"><Play className="size-3.5" />Preview</Button>
                          <Button size="sm" disabled={busyId === reminder.id || !deliveryConfigured} onClick={() => void previewOrSendReminder(reminder, false)} className="bg-gold text-espresso hover:bg-gold-light"><Send className="size-3.5" />Send now</Button>
                          <Button size="sm" variant="ghost" disabled={busyId === reminder.id || reminder.status === 'cancelled'} onClick={() => void cancelReminder(reminder.id)} className="text-clay-light"><Trash2 className="size-3.5" />Cancel</Button>
                        </div>
                      </div>
                    ))}
                  </Section>
                </div>
              </TabsContent>

              <TabsContent value="templates" className="space-y-5">
                <Section title="Save this wedding as a template" icon={<Save className="size-4" />}>
                  <div className="flex flex-col gap-2 sm:flex-row"><Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" className="border-gold/25 bg-espresso/60" /><Button disabled={!templateName.trim() || busyId === 'save-template'} onClick={() => void saveCurrentTemplate()} className="bg-gold text-espresso hover:bg-gold-light"><Save className="size-4" />Save current plan</Button></div>
                  <p className="mt-2 text-[11px] text-champagne/45">Saves tasks, timeline and active reminders with dates stored relative to the wedding date.</p>
                </Section>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {templates.map((template) => {
                    const counts = template.items.reduce((result, item) => ({ ...result, [item.type]: (result[item.type] || 0) + 1 }), {} as Record<string, number>)
                    return <Card key={template.id} className="border-gold/20 bg-espresso/45 text-champagne"><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{template.name}</p><p className="mt-1 text-xs text-champagne/50">{template.description}</p></div><Badge variant="outline" className="border-gold/25 text-gold">{template.source}</Badge></div><p className="mt-3 text-[11px] text-champagne/50">{counts.task || 0} tasks · {counts.timeline || 0} timeline · {counts.reminder || 0} reminders</p><div className="mt-4 flex gap-2"><Button size="sm" disabled={busyId === template.id} onClick={() => void applyTemplate(template)} className="bg-gold text-espresso hover:bg-gold-light"><Download className="size-3.5" />Apply</Button>{template.source === 'wedding' && <Button size="sm" variant="ghost" disabled={busyId === template.id} onClick={() => void archiveTemplate(template.id)} className="text-clay-light"><Trash2 className="size-3.5" />Archive</Button>}</div></CardContent></Card>
                  })}
                </div>
              </TabsContent>

              <TabsContent value="seating" className="space-y-5">
                {!overview ? <LoadingState /> : <>
                  <div className="grid gap-3 md:grid-cols-3"><Metric icon={<LayoutGrid />} label="Tables" value={overview.seating.tables.length} /><Metric icon={<Users />} label="Confirmed unseated" value={overview.guests.unseated} warning={overview.guests.unseated > 0} /><Metric icon={<AlertCircle />} label="Over-capacity tables" value={overview.seating.tables.filter((table) => table.overCapacity).length} warning={overview.seating.tables.some((table) => table.overCapacity)} /></div>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <Section title="Capacity" icon={<LayoutGrid className="size-4" />}>{overview.seating.tables.length === 0 ? <Empty text="Create seating tables in the Seating tab first." /> : overview.seating.tables.map((table) => <div key={table.id} className="mb-3"><div className="flex justify-between text-xs"><span>{table.name}</span><span className={table.overCapacity ? 'text-clay-light' : 'text-champagne/55'}>{table.occupied}/{table.capacity}</span></div><Progress value={Math.min(100, table.capacity ? table.occupied / table.capacity * 100 : 0)} className="mt-1" /></div>)}</Section>
                    <Section title="Auto-assign confirmed guests" icon={<Sparkles className="size-4" />}>
                      <p className="text-xs text-champagne/55">The algorithm places larger parties first and never knowingly exceeds table capacity. Preview before applying.</p><div className="mt-3 flex gap-2"><Button variant="outline" disabled={busyId === 'seating'} onClick={() => void autoSeat(true)} className="border-gold/25 bg-transparent"><Play className="size-4" />Preview</Button><Button disabled={busyId === 'seating' || !seatingPreview} onClick={() => void autoSeat(false)} className="bg-gold text-espresso hover:bg-gold-light"><CheckCircle2 className="size-4" />Apply preview</Button></div>{seatingPreview && <div className="mt-4 max-h-72 overflow-y-auto rounded-md border border-gold/15 p-3"><p className="mb-2 text-xs text-gold">{seatingPreview.assignmentCount} assignments · {seatingPreview.unassignedCount} still unassigned</p>{seatingPreview.assignments.slice(0, 30).map((assignment, index) => <div key={`${assignment.guestName}-${index}`} className="flex justify-between border-b border-gold/10 py-1.5 text-xs last:border-0"><span>{assignment.guestName} ({assignment.headcount})</span><span className="text-gold">{assignment.tableName}</span></div>)}</div>}</Section>
                  </div>
                </>}
              </TabsContent>

              <TabsContent value="imports" className="space-y-5">
                <Section title="Persistent import history" icon={<FileSpreadsheet className="size-4" />}>
                  <p className="mb-4 text-xs text-champagne/50">Use the Import buttons inside Guests, Budget, Checklist, Seating, Vendors or Timeline. Previews and rollback snapshots now survive server restarts and remain isolated to the active wedding.</p>
                  {!overview || overview.imports.length === 0 ? <Empty text="No imports for this wedding." /> : overview.imports.map((job) => { const id = job.id ?? job.jobId ?? ''; return <div key={id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/10 py-3 last:border-0"><div><p className="text-sm">{job.fileName}</p><p className="text-[11px] text-champagne/45">{job.moduleKey} · {job.status} · {job.totalRows} rows · {new Date(job.createdAt).toLocaleString('en-US')}</p><p className="text-[10px] text-champagne/40">{job.createdCount} created · {job.updatedCount} updated · {job.errorCount} errors</p></div>{job.status === 'executed' && job.rollbackToken && <Button size="sm" variant="outline" disabled={busyId === id} onClick={() => void rollbackImport(job)} className="border-clay/30 bg-transparent text-clay-light"><RotateCcw className="size-3.5" />Rollback</Button>}</div> })}
                </Section>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}

function LoadingState() { return <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-6 animate-spin text-gold" /></div> }
function Empty({ text }: { text: string }) { return <p className="py-4 text-center text-xs text-champagne/45">{text}</p> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-wider text-gold-muted">{label}</Label>{children}</div> }
function Section({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) { return <Card className="border-gold/20 bg-espresso/45 text-champagne"><CardContent className="p-4"><div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-gold">{icon}<h3 className="font-medium text-champagne">{title}</h3></div>{action}</div>{children}</CardContent></Card> }
function Metric({ icon, label, value, warning = false }: { icon: React.ReactNode; label: string; value: string | number; warning?: boolean }) { return <Card className="border-gold/20 bg-espresso/45 text-champagne"><CardContent className="p-4"><div className={warning ? 'text-clay-light' : 'text-gold'}>{icon}</div><p className="mt-2 wewed-heading text-2xl">{value}</p><p className="text-[10px] uppercase tracking-wider text-champagne/45">{label}</p></CardContent></Card> }
function KeyValue({ label, value }: { label: string; value: string | number }) { return <div className="flex justify-between border-b border-gold/10 py-2 text-xs last:border-0"><span className="text-champagne/55">{label}</span><span className="text-champagne">{value}</span></div> }
