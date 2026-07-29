'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  XCircle,
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

type ResourceType = 'task' | 'vendor' | 'budget' | 'guest' | 'timeline' | 'document'
type VendorStatus = 'lead' | 'shortlisted' | 'quoted' | 'negotiating' | 'booked' | 'rejected' | 'completed'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

interface TaskRow {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  category: string
  assigneeUserId: string | null
  assigneeName: string | null
}

interface VendorPipeline {
  vendorId: string
  contactName: string
  email: string
  pipelineStatus: VendorStatus
  quoteAmount: number | null
  currency: string
  contractUrl: string
  depositAmount: number | null
  depositDueDate: string | null
  depositPaidAt: string | null
  balanceDueDate: string | null
  balancePaidAt: string | null
  ownerUserId: string | null
  ownerName: string | null
  notes: string
}

interface VendorRow {
  id: string
  name: string
  category: string
  description: string | null
  website: string | null
  phone: string | null
  featured: boolean
  rating: number | null
  pipeline: VendorPipeline
}

interface ApprovalRow {
  id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  title: string
  description: string
  targetType: ResourceType
  targetId: string
  targetLabel: string
  requestedById: string
  requestedByName: string
  reviewerUserId: string | null
  reviewerName: string | null
  decisionNote: string
  decidedByName: string | null
  decidedAt: string | null
  createdAt: string
}

interface DocumentRow {
  id: string
  status: string
  name: string
  url: string
  category: string
  notes: string
  targetType: Exclude<ResourceType, 'document'> | null
  targetId: string | null
  targetLabel: string | null
  expiresAt: string | null
  uploadedById: string
  uploadedByName: string
  createdAt: string
}

interface CommentRow {
  id: string
  body: string
  targetType: ResourceType
  targetId: string
  targetLabel: string
  parentId: string | null
  authorId: string
  authorName: string
  createdAt: string
}

interface NotificationRow {
  id: string
  status: string
  type: string
  title: string
  body: string
  href: string | null
  createdAt: string
}

interface CollaborationData {
  currentUserId: string
  permissions: {
    plannerEdit: boolean
    vendorsEdit: boolean
    budgetEdit: boolean
  }
  metrics: {
    openTasks: number
    myTasks: number
    overdueTasks: number
    pendingApprovals: number
    expiringDocuments: number
    unreadNotifications: number
    bookedVendors: number
    vendorsInPipeline: number
  }
  team: TeamMember[]
  tasks: TaskRow[]
  vendors: VendorRow[]
  approvals: ApprovalRow[]
  documents: DocumentRow[]
  comments: CommentRow[]
  notifications: NotificationRow[]
  resources: Record<ResourceType, Array<{ id: string; label: string }>>
  activity: Array<{
    id: string
    action: string
    resourceType: string
    resourceId: string | null
    actorId: string | null
    createdAt: string
  }>
}

interface VendorDraft extends VendorPipeline {
  vendorName: string
}

const VENDOR_STATUSES: VendorStatus[] = [
  'lead',
  'shortlisted',
  'quoted',
  'negotiating',
  'booked',
  'rejected',
  'completed',
]

const RESOURCE_LABELS: Record<ResourceType, string> = {
  task: 'Task',
  vendor: 'Vendor',
  budget: 'Budget item',
  guest: 'Guest',
  timeline: 'Timeline item',
  document: 'Document',
}

const EMPTY_APPROVAL = {
  title: '',
  description: '',
  targetType: 'task' as ResourceType,
  targetId: '',
  reviewerUserId: '',
}

const EMPTY_DOCUMENT = {
  name: '',
  url: '',
  category: 'contract',
  notes: '',
  targetType: '' as '' | Exclude<ResourceType, 'document'>,
  targetId: '',
  expiresAt: '',
}

function dateInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : ''
}

function money(value: number | null, currency = 'USD') {
  if (value === null) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString('en-US')}`
  }
}

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function PlannerCollaborationHub() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<CollaborationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [taskSearch, setTaskSearch] = useState('')
  const [vendorDraft, setVendorDraft] = useState<VendorDraft | null>(null)
  const [approvalForm, setApprovalForm] = useState(EMPTY_APPROVAL)
  const [documentForm, setDocumentForm] = useState(EMPTY_DOCUMENT)
  const [discussionType, setDiscussionType] = useState<ResourceType>('task')
  const [discussionId, setDiscussionId] = useState('')
  const [commentBody, setCommentBody] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/planner/collaboration', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to load Team Hub.')
      }
      setData(payload as CollaborationData)
      setDiscussionId((current) => current || payload.resources.task?.[0]?.id || '')
      setApprovalForm((current) => ({
        ...current,
        targetId: current.targetId || payload.resources[current.targetType]?.[0]?.id || '',
      }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Team Hub.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  async function perform(
    action: string,
    payload: Record<string, unknown>,
    successTitle?: string,
  ) {
    setBusy(action)
    setError(null)
    try {
      const response = await fetch('/api/planner/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'The collaboration action failed.')
      }
      if (successTitle) toast({ title: successTitle })
      await load()
      return result
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The collaboration action failed.')
      return null
    } finally {
      setBusy(null)
    }
  }

  const filteredTasks = useMemo(() => {
    if (!data) return []
    const query = taskSearch.trim().toLowerCase()
    if (!query) return data.tasks
    return data.tasks.filter((task) =>
      [task.title, task.description, task.assigneeName, task.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [data, taskSearch])

  const myTasks = useMemo(
    () => data?.tasks.filter((task) => task.assigneeUserId === data.currentUserId && task.status !== 'done') ?? [],
    [data],
  )

  const discussionResources = data?.resources[discussionType] ?? []
  const discussionComments =
    data?.comments.filter(
      (comment) => comment.targetType === discussionType && comment.targetId === discussionId,
    ) ?? []

  function startVendorEdit(vendor: VendorRow) {
    setVendorDraft({
      vendorName: vendor.name,
      ...vendor.pipeline,
      depositDueDate: dateInput(vendor.pipeline.depositDueDate),
      depositPaidAt: dateInput(vendor.pipeline.depositPaidAt),
      balanceDueDate: dateInput(vendor.pipeline.balanceDueDate),
      balancePaidAt: dateInput(vendor.pipeline.balancePaidAt),
    })
  }

  async function saveVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!vendorDraft) return
    const result = await perform(
      'upsert_vendor_pipeline',
      vendorDraft,
      `${vendorDraft.vendorName} updated`,
    )
    if (result) setVendorDraft(null)
  }

  async function createApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await perform('create_approval', approvalForm, 'Approval requested')
    if (result) {
      setApprovalForm((current) => ({
        ...EMPTY_APPROVAL,
        targetType: current.targetType,
        targetId: data?.resources[current.targetType]?.[0]?.id || '',
      }))
    }
  }

  async function decideApproval(approval: ApprovalRow, status: 'approved' | 'rejected') {
    const note = window.prompt(
      status === 'approved' ? 'Optional approval note' : 'Reason for rejection',
      '',
    )
    if (note === null) return
    await perform(
      'decide_approval',
      { id: approval.id, status, decisionNote: note },
      status === 'approved' ? 'Approval accepted' : 'Approval rejected',
    )
  }

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await perform(
      'create_document',
      {
        ...documentForm,
        targetType: documentForm.targetType || null,
        targetId: documentForm.targetType ? documentForm.targetId : null,
      },
      'Document link saved',
    )
    if (result) setDocumentForm(EMPTY_DOCUMENT)
  }

  async function createComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await perform(
      'create_comment',
      { targetType: discussionType, targetId: discussionId, body: commentBody },
      'Comment posted',
    )
    if (result) setCommentBody('')
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed right-[22rem] top-2 z-[121] gap-1.5 bg-sage text-espresso shadow-lg hover:bg-sage-light"
      >
        <Users className="size-3.5" />
        <span className="hidden xl:inline">Team Hub</span>
        {data?.metrics.unreadNotifications ? (
          <Badge className="ml-1 bg-espresso px-1.5 text-[9px] text-champagne">
            {data.metrics.unreadNotifications}
          </Badge>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[94vh] w-[97vw] max-w-7xl flex-col gap-0 overflow-hidden border-gold/30 bg-espresso p-0 text-champagne">
          <div className="flex items-center justify-between border-b border-gold/15 px-6 py-4">
            <div>
              <DialogTitle className="wewed-heading text-2xl">Team Collaboration Hub</DialogTitle>
              <DialogDescription className="text-champagne/55">
                Assign work, manage vendors, request decisions, share document links, and keep every discussion wedding-scoped.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="border-gold/30 bg-transparent text-champagne hover:bg-gold/10"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh
            </Button>
          </div>

          {error && (
            <div className="mx-6 mt-3 flex items-center gap-2 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay-light">
              <AlertTriangle className="size-4" /> {error}
            </div>
          )}

          {!data ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-7 animate-spin text-gold" />
            </div>
          ) : (
            <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-6 mt-3 h-auto flex-wrap justify-start bg-transparent">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="work">My Work</TabsTrigger>
                <TabsTrigger value="vendors">Vendors</TabsTrigger>
                <TabsTrigger value="approvals">Approvals</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="discussion">Discussion</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
                <TabsContent value="overview" className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                    <Metric label="My tasks" value={data.metrics.myTasks} icon={<UserCheck />} />
                    <Metric label="Open tasks" value={data.metrics.openTasks} icon={<ClipboardCheck />} />
                    <Metric label="Overdue" value={data.metrics.overdueTasks} icon={<AlertTriangle />} warning={data.metrics.overdueTasks > 0} />
                    <Metric label="Approvals" value={data.metrics.pendingApprovals} icon={<ShieldCheck />} warning={data.metrics.pendingApprovals > 0} />
                    <Metric label="Expiring docs" value={data.metrics.expiringDocuments} icon={<FileText />} warning={data.metrics.expiringDocuments > 0} />
                    <Metric label="Unread" value={data.metrics.unreadNotifications} icon={<Bell />} warning={data.metrics.unreadNotifications > 0} />
                    <Metric label="Booked vendors" value={data.metrics.bookedVendors} icon={<Check />} />
                    <Metric label="Vendor pipeline" value={data.metrics.vendorsInPipeline} icon={<BriefcaseBusiness />} />
                  </div>

                  <div className="grid gap-5 lg:grid-cols-3">
                    <Section title="Wedding team" icon={<Users className="size-4" />}>
                      {data.team.map((member) => (
                        <div key={member.id} className="flex items-center justify-between border-b border-gold/10 py-2 last:border-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm">{member.name}</p>
                            <p className="truncate text-[10px] text-champagne/40">{member.email}</p>
                          </div>
                          <Badge variant="outline" className="border-gold/25 text-gold">{member.role}</Badge>
                        </div>
                      ))}
                    </Section>
                    <Section title="My current work" icon={<ClipboardCheck className="size-4" />}>
                      {myTasks.length === 0 ? <Empty text="No open tasks are assigned to you." /> : myTasks.slice(0, 8).map((task) => (
                        <TaskSummary key={task.id} task={task} />
                      ))}
                    </Section>
                    <Section title="Recent collaboration" icon={<Sparkles className="size-4" />}>
                      {data.activity.length === 0 ? <Empty text="Collaboration activity will appear here." /> : data.activity.slice(0, 10).map((event) => (
                        <div key={event.id} className="border-b border-gold/10 py-2 last:border-0">
                          <p className="text-xs text-champagne/80">{statusLabel(event.action)}</p>
                          <p className="text-[10px] text-champagne/40">{new Date(event.createdAt).toLocaleString('en-US')}</p>
                        </div>
                      ))}
                    </Section>
                  </div>
                </TabsContent>

                <TabsContent value="work" className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="relative max-w-md flex-1">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" />
                      <Input value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="Search tasks, categories or assignees" className="border-gold/25 bg-espresso/60 pl-9" />
                    </div>
                    <Badge variant="outline" className="border-gold/25 text-gold">{filteredTasks.length} tasks</Badge>
                  </div>
                  <div className="space-y-3">
                    {filteredTasks.map((task) => (
                      <Card key={task.id} className="border-gold/20 bg-espresso/45 text-champagne">
                        <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_220px_180px] lg:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{task.title}</p>
                              <Badge variant="outline" className={task.priority === 'high' ? 'border-clay/30 text-clay-light' : 'border-gold/20 text-gold'}>{task.priority}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-champagne/45">{task.category.replaceAll('_', ' ')} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US') : 'No due date'}</p>
                          </div>
                          <Select
                            value={task.assigneeUserId ?? '__unassigned__'}
                            disabled={!data.permissions.plannerEdit || busy === 'assign_task'}
                            onValueChange={(value) => void perform('assign_task', { taskId: task.id, assigneeUserId: value === '__unassigned__' ? null : value }, 'Task assignment updated')}
                          >
                            <SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unassigned__">Unassigned</SelectItem>
                              {data.team.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select
                            value={task.status}
                            disabled={!data.permissions.plannerEdit || busy === 'update_task_status'}
                            onValueChange={(status) => void perform('update_task_status', { taskId: task.id, status }, 'Task status updated')}
                          >
                            <SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">To do</SelectItem>
                              <SelectItem value="in_progress">In progress</SelectItem>
                              <SelectItem value="blocked">Blocked</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="vendors" className="space-y-5">
                  {vendorDraft && (
                    <Section title={`Update ${vendorDraft.vendorName}`} icon={<BriefcaseBusiness className="size-4" />}>
                      <form onSubmit={saveVendor} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="Pipeline status">
                          <Select value={vendorDraft.pipelineStatus} onValueChange={(pipelineStatus: VendorStatus) => setVendorDraft((current) => current ? { ...current, pipelineStatus } : current)}>
                            <SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger>
                            <SelectContent>{VENDOR_STATUSES.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        <Field label="Owner">
                          <Select value={vendorDraft.ownerUserId ?? '__none__'} onValueChange={(value) => setVendorDraft((current) => current ? { ...current, ownerUserId: value === '__none__' ? null : value } : current)}>
                            <SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="__none__">No owner</SelectItem>{data.team.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        <Field label="Contact name"><Input value={vendorDraft.contactName} onChange={(event) => setVendorDraft((current) => current ? { ...current, contactName: event.target.value } : current)} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Contact email"><Input type="email" value={vendorDraft.email} onChange={(event) => setVendorDraft((current) => current ? { ...current, email: event.target.value } : current)} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Quote amount"><Input type="number" min="0" step="0.01" value={vendorDraft.quoteAmount ?? ''} onChange={(event) => setVendorDraft((current) => current ? { ...current, quoteAmount: event.target.value ? Number(event.target.value) : null } : current)} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Currency"><Input maxLength={3} value={vendorDraft.currency} onChange={(event) => setVendorDraft((current) => current ? { ...current, currency: event.target.value.toUpperCase() } : current)} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Contract URL"><Input type="url" value={vendorDraft.contractUrl} onChange={(event) => setVendorDraft((current) => current ? { ...current, contractUrl: event.target.value } : current)} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Deposit amount"><Input type="number" min="0" step="0.01" value={vendorDraft.depositAmount ?? ''} onChange={(event) => setVendorDraft((current) => current ? { ...current, depositAmount: event.target.value ? Number(event.target.value) : null } : current)} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Deposit due"><Input type="date" value={vendorDraft.depositDueDate ?? ''} onChange={(event) => setVendorDraft((current) => current ? { ...current, depositDueDate: event.target.value || null } : current)} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Deposit paid"><Input type="date" value={vendorDraft.depositPaidAt ?? ''} onChange={(event) => setVendorDraft((current) => current ? { ...current, depositPaidAt: event.target.value || null } : current)} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Balance due"><Input type="date" value={vendorDraft.balanceDueDate ?? ''} onChange={(event) => setVendorDraft((current) => current ? { ...current, balanceDueDate: event.target.value || null } : current)} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Balance paid"><Input type="date" value={vendorDraft.balancePaidAt ?? ''} onChange={(event) => setVendorDraft((current) => current ? { ...current, balancePaidAt: event.target.value || null } : current)} className="border-gold/25 bg-espresso/60" /></Field>
                        <div className="md:col-span-2 xl:col-span-4"><Field label="Procurement notes"><Textarea rows={3} value={vendorDraft.notes} onChange={(event) => setVendorDraft((current) => current ? { ...current, notes: event.target.value } : current)} className="border-gold/25 bg-espresso/60" /></Field></div>
                        <div className="flex gap-2 md:col-span-2 xl:col-span-4">
                          <Button disabled={busy === 'upsert_vendor_pipeline'} className="bg-gold text-espresso hover:bg-gold-light"><Save className="size-4" />Save vendor</Button>
                          <Button type="button" variant="outline" onClick={() => setVendorDraft(null)} className="border-gold/25 bg-transparent">Cancel</Button>
                        </div>
                      </form>
                    </Section>
                  )}
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {data.vendors.map((vendor) => (
                      <Card key={vendor.id} className="border-gold/20 bg-espresso/45 text-champagne">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div><p className="font-medium">{vendor.name}</p><p className="text-xs text-champagne/45">{vendor.category}</p></div>
                            <Badge variant="outline" className={vendor.pipeline.pipelineStatus === 'booked' ? 'border-sage/30 text-sage-light' : vendor.pipeline.pipelineStatus === 'rejected' ? 'border-clay/30 text-clay-light' : 'border-gold/25 text-gold'}>{statusLabel(vendor.pipeline.pipelineStatus)}</Badge>
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-champagne/60">
                            <p>Owner: {vendor.pipeline.ownerName || 'Unassigned'}</p>
                            <p>Quote: {money(vendor.pipeline.quoteAmount, vendor.pipeline.currency)}</p>
                            <p>Contact: {vendor.pipeline.contactName || vendor.phone || 'Not recorded'}</p>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" disabled={!data.permissions.vendorsEdit} onClick={() => startVendorEdit(vendor)} className="bg-gold text-espresso hover:bg-gold-light">Manage</Button>
                            {vendor.pipeline.contractUrl && <a href={vendor.pipeline.contractUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-gold/25 px-3 py-1.5 text-xs text-gold hover:bg-gold/10"><ExternalLink className="size-3" />Contract</a>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="approvals" className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
                    <Section title="Request a decision" icon={<ShieldCheck className="size-4" />}>
                      <form onSubmit={createApproval} className="space-y-3">
                        <Field label="Title"><Input required value={approvalForm.title} onChange={(event) => setApprovalForm((current) => ({ ...current, title: event.target.value }))} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Resource type">
                          <Select value={approvalForm.targetType} onValueChange={(targetType: ResourceType) => setApprovalForm((current) => ({ ...current, targetType, targetId: data.resources[targetType]?.[0]?.id || '' }))}>
                            <SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger>
                            <SelectContent>{(Object.keys(RESOURCE_LABELS) as ResourceType[]).map((type) => <SelectItem key={type} value={type}>{RESOURCE_LABELS[type]}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        <Field label="Resource">
                          <Select value={approvalForm.targetId || '__none__'} onValueChange={(targetId) => setApprovalForm((current) => ({ ...current, targetId: targetId === '__none__' ? '' : targetId }))}>
                            <SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="__none__">Select a resource</SelectItem>{data.resources[approvalForm.targetType].map((resource) => <SelectItem key={resource.id} value={resource.id}>{resource.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        <Field label="Reviewer">
                          <Select value={approvalForm.reviewerUserId || '__team__'} onValueChange={(value) => setApprovalForm((current) => ({ ...current, reviewerUserId: value === '__team__' ? '' : value }))}>
                            <SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="__team__">Any owner or planner</SelectItem>{data.team.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        <Field label="Context"><Textarea rows={4} value={approvalForm.description} onChange={(event) => setApprovalForm((current) => ({ ...current, description: event.target.value }))} className="border-gold/25 bg-espresso/60" /></Field>
                        <Button disabled={!approvalForm.targetId || busy === 'create_approval'} className="bg-gold text-espresso hover:bg-gold-light"><ShieldCheck className="size-4" />Request approval</Button>
                      </form>
                    </Section>
                    <Section title="Decision queue" icon={<ClipboardCheck className="size-4" />}>
                      {data.approvals.length === 0 ? <Empty text="No approvals have been requested." /> : data.approvals.map((approval) => (
                        <div key={approval.id} className="mb-3 rounded-md border border-gold/15 bg-espresso/45 p-3 last:mb-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div><p className="text-sm font-medium">{approval.title}</p><p className="text-[11px] text-champagne/45">{approval.targetLabel} · requested by {approval.requestedByName}</p></div>
                            <Badge variant="outline" className={approval.status === 'approved' ? 'border-sage/30 text-sage-light' : approval.status === 'rejected' ? 'border-clay/30 text-clay-light' : 'border-gold/25 text-gold'}>{approval.status}</Badge>
                          </div>
                          {approval.description && <p className="mt-2 text-xs text-champagne/65">{approval.description}</p>}
                          {approval.decisionNote && <p className="mt-2 text-xs text-gold">Decision: {approval.decisionNote}</p>}
                          {approval.status === 'pending' && data.permissions.plannerEdit && (
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" disabled={busy === 'decide_approval'} onClick={() => void decideApproval(approval, 'approved')} className="bg-sage text-espresso hover:bg-sage-light"><Check className="size-3.5" />Approve</Button>
                              <Button size="sm" variant="outline" disabled={busy === 'decide_approval'} onClick={() => void decideApproval(approval, 'rejected')} className="border-clay/30 bg-transparent text-clay-light"><XCircle className="size-3.5" />Reject</Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </Section>
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
                    <Section title="Add a secure document link" icon={<FileText className="size-4" />}>
                      <form onSubmit={createDocument} className="space-y-3">
                        <Field label="Document name"><Input required value={documentForm.name} onChange={(event) => setDocumentForm((current) => ({ ...current, name: event.target.value }))} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="HTTPS link"><Input required type="url" value={documentForm.url} onChange={(event) => setDocumentForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://drive.google.com/..." className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Category"><Input value={documentForm.category} onChange={(event) => setDocumentForm((current) => ({ ...current, category: event.target.value }))} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Link to resource">
                          <Select value={documentForm.targetType || '__none__'} onValueChange={(value) => setDocumentForm((current) => ({ ...current, targetType: value === '__none__' ? '' : value as Exclude<ResourceType, 'document'>, targetId: value === '__none__' ? '' : data.resources[value as ResourceType]?.[0]?.id || '' }))}>
                            <SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="__none__">No linked resource</SelectItem>{(['task', 'vendor', 'budget', 'guest', 'timeline'] as const).map((type) => <SelectItem key={type} value={type}>{RESOURCE_LABELS[type]}</SelectItem>)}</SelectContent>
                          </Select>
                        </Field>
                        {documentForm.targetType && <Field label="Resource"><Select value={documentForm.targetId || '__none__'} onValueChange={(value) => setDocumentForm((current) => ({ ...current, targetId: value === '__none__' ? '' : value }))}><SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Select a resource</SelectItem>{data.resources[documentForm.targetType].map((resource) => <SelectItem key={resource.id} value={resource.id}>{resource.label}</SelectItem>)}</SelectContent></Select></Field>}
                        <Field label="Expiry or renewal date"><Input type="date" value={documentForm.expiresAt} onChange={(event) => setDocumentForm((current) => ({ ...current, expiresAt: event.target.value }))} className="border-gold/25 bg-espresso/60" /></Field>
                        <Field label="Notes"><Textarea rows={3} value={documentForm.notes} onChange={(event) => setDocumentForm((current) => ({ ...current, notes: event.target.value }))} className="border-gold/25 bg-espresso/60" /></Field>
                        <Button disabled={busy === 'create_document'} className="bg-gold text-espresso hover:bg-gold-light"><Save className="size-4" />Save link</Button>
                      </form>
                    </Section>
                    <Section title="Document register" icon={<FileText className="size-4" />}>
                      {data.documents.filter((document) => document.status !== 'archived').length === 0 ? <Empty text="No document links have been saved." /> : data.documents.filter((document) => document.status !== 'archived').map((document) => (
                        <div key={document.id} className="mb-3 rounded-md border border-gold/15 p-3 last:mb-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div><p className="text-sm font-medium">{document.name}</p><p className="text-[11px] text-champagne/45">{document.category} · {document.targetLabel || 'Wedding-wide'} · added by {document.uploadedByName}</p></div>
                            {document.expiresAt && <Badge variant="outline" className={new Date(document.expiresAt) < new Date() ? 'border-clay/30 text-clay-light' : 'border-gold/25 text-gold'}>{new Date(document.expiresAt).toLocaleDateString('en-US')}</Badge>}
                          </div>
                          {document.notes && <p className="mt-2 text-xs text-champagne/60">{document.notes}</p>}
                          <div className="mt-3 flex gap-2">
                            <a href={document.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-espresso hover:bg-gold-light"><ExternalLink className="size-3" />Open</a>
                            {data.permissions.plannerEdit && <Button size="sm" variant="ghost" disabled={busy === 'archive_document'} onClick={() => void perform('archive_document', { id: document.id }, 'Document archived')} className="text-clay-light"><Trash2 className="size-3.5" />Archive</Button>}
                          </div>
                        </div>
                      ))}
                    </Section>
                  </div>
                </TabsContent>

                <TabsContent value="discussion" className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
                    <Section title="Choose a resource" icon={<MessageSquare className="size-4" />}>
                      <div className="space-y-3">
                        <Field label="Resource type"><Select value={discussionType} onValueChange={(value: ResourceType) => { setDiscussionType(value); setDiscussionId(data.resources[value]?.[0]?.id || '') }}><SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(RESOURCE_LABELS) as ResourceType[]).map((type) => <SelectItem key={type} value={type}>{RESOURCE_LABELS[type]}</SelectItem>)}</SelectContent></Select></Field>
                        <Field label="Resource"><Select value={discussionId || '__none__'} onValueChange={(value) => setDiscussionId(value === '__none__' ? '' : value)}><SelectTrigger className="border-gold/25 bg-espresso/60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">Select a resource</SelectItem>{discussionResources.map((resource) => <SelectItem key={resource.id} value={resource.id}>{resource.label}</SelectItem>)}</SelectContent></Select></Field>
                        <form onSubmit={createComment} className="space-y-2">
                          <Field label="Comment"><Textarea required rows={5} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Add context or mention a teammate as @name@example.com" className="border-gold/25 bg-espresso/60" /></Field>
                          <Button disabled={!discussionId || busy === 'create_comment' || !data.permissions.plannerEdit} className="bg-gold text-espresso hover:bg-gold-light"><MessageSquare className="size-4" />Post comment</Button>
                        </form>
                      </div>
                    </Section>
                    <Section title="Thread" icon={<MessageSquare className="size-4" />}>
                      {discussionComments.length === 0 ? <Empty text="No comments on this resource." /> : discussionComments.map((comment) => (
                        <div key={comment.id} className="mb-3 rounded-md border border-gold/15 bg-espresso/45 p-3 last:mb-0">
                          <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-medium text-gold">{comment.authorName}</p><p className="text-[10px] text-champagne/40">{new Date(comment.createdAt).toLocaleString('en-US')}</p></div>{comment.authorId === data.currentUserId && <Button size="icon" variant="ghost" disabled={busy === 'delete_comment'} onClick={() => void perform('delete_comment', { id: comment.id }, 'Comment deleted')} className="size-7 text-clay-light"><Trash2 className="size-3.5" /></Button>}</div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-champagne/75">{comment.body}</p>
                        </div>
                      ))}
                    </Section>
                  </div>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><h3 className="font-medium">Your notifications</h3><p className="text-xs text-champagne/45">Assignments, mentions, approval decisions, and vendor ownership.</p></div>
                    <Button variant="outline" disabled={busy === 'mark_notifications' || data.metrics.unreadNotifications === 0} onClick={() => void perform('mark_notifications', {}, 'Notifications marked read')} className="border-gold/25 bg-transparent"><Check className="size-4" />Mark all read</Button>
                  </div>
                  {data.notifications.length === 0 ? <Empty text="No notifications yet." /> : data.notifications.map((notification) => (
                    <Card key={notification.id} className={notification.status === 'unread' ? 'border-gold/35 bg-gold/5 text-champagne' : 'border-gold/15 bg-espresso/45 text-champagne'}>
                      <CardContent className="flex items-start justify-between gap-3 p-4">
                        <div><div className="flex items-center gap-2"><Bell className="size-4 text-gold" /><p className="text-sm font-medium">{notification.title}</p>{notification.status === 'unread' && <Badge className="bg-gold text-espresso">New</Badge>}</div><p className="mt-1 text-xs text-champagne/60">{notification.body}</p><p className="mt-1 text-[10px] text-champagne/35">{new Date(notification.createdAt).toLocaleString('en-US')}</p></div>
                        {notification.status === 'unread' && <Button size="sm" variant="ghost" disabled={busy === 'mark_notifications'} onClick={() => void perform('mark_notifications', { id: notification.id })}>Mark read</Button>}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Metric({ label, value, icon, warning = false }: { label: string; value: number; icon: ReactNode; warning?: boolean }) {
  return <Card className="border-gold/20 bg-espresso/45 text-champagne"><CardContent className="p-3"><div className={warning ? 'text-clay-light' : 'text-gold'}>{icon}</div><p className="mt-2 wewed-heading text-2xl">{value}</p><p className="text-[9px] uppercase tracking-wider text-champagne/45">{label}</p></CardContent></Card>
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <Card className="border-gold/20 bg-espresso/45 text-champagne"><CardContent className="p-4"><div className="mb-3 flex items-center gap-2 text-gold">{icon}<h3 className="font-medium text-champagne">{title}</h3></div>{children}</CardContent></Card>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-wider text-gold-muted">{label}</Label>{children}</div>
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-champagne/45">{text}</p>
}

function TaskSummary({ task }: { task: TaskRow }) {
  const overdue = task.dueDate && new Date(task.dueDate) < new Date()
  return <div className="border-b border-gold/10 py-2 last:border-0"><div className="flex items-start justify-between gap-2"><p className="text-sm text-champagne/85">{task.title}</p>{overdue && <Badge variant="outline" className="border-clay/30 text-clay-light">Overdue</Badge>}</div><p className="mt-1 text-[10px] text-champagne/40">{task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US') : 'No due date'} · {task.status.replaceAll('_', ' ')}</p>{task.status !== 'done' && <Progress value={task.status === 'in_progress' ? 50 : task.status === 'blocked' ? 20 : 0} className="mt-2" />}</div>
}
