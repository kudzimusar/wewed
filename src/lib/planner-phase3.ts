export type CollaborationResourceType =
  | 'task'
  | 'vendor'
  | 'budget'
  | 'guest'
  | 'timeline'
  | 'document'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type VendorPipelineStatus =
  | 'lead'
  | 'shortlisted'
  | 'quoted'
  | 'negotiating'
  | 'booked'
  | 'rejected'
  | 'completed'

export const COLLABORATION_SECTIONS = [
  'planner_task_assignment',
  'planner_vendor_pipeline',
  'planner_approval',
  'planner_document',
  'planner_comment',
  'planner_notification',
] as const

export const VENDOR_PIPELINE_STATUSES: VendorPipelineStatus[] = [
  'lead',
  'shortlisted',
  'quoted',
  'negotiating',
  'booked',
  'rejected',
  'completed',
]

export const APPROVAL_STATUSES: ApprovalStatus[] = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]

export interface TaskAssignmentValue {
  version: 1
  taskId: string
  assigneeUserId: string | null
  assigneeName: string | null
  assignedById: string
  assignedAt: string
}

export interface VendorPipelineValue {
  version: 1
  vendorId: string
  contactName: string
  email: string
  pipelineStatus: VendorPipelineStatus
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
  updatedById: string
  updatedAt: string
}

export interface ApprovalValue {
  version: 1
  title: string
  description: string
  targetType: CollaborationResourceType
  targetId: string
  targetLabel: string
  requestedById: string
  requestedByName: string
  reviewerUserId: string | null
  reviewerName: string | null
  decisionNote: string
  decidedById: string | null
  decidedByName: string | null
  decidedAt: string | null
  createdAt: string
}

export interface PlannerDocumentValue {
  version: 1
  name: string
  url: string
  category: string
  notes: string
  targetType: Exclude<CollaborationResourceType, 'document'> | null
  targetId: string | null
  targetLabel: string | null
  expiresAt: string | null
  uploadedById: string
  uploadedByName: string
  createdAt: string
}

export interface PlannerCommentValue {
  version: 1
  body: string
  targetType: CollaborationResourceType
  targetId: string
  targetLabel: string
  parentId: string | null
  authorId: string
  authorName: string
  createdAt: string
}

export interface PlannerNotificationValue {
  version: 1
  userId: string
  type: string
  title: string
  body: string
  href: string | null
  createdAt: string
}

export interface CollaborationMetricsInput {
  tasks: Array<{
    status: string
    dueDate: Date | string | null
    assigneeUserId: string | null
  }>
  approvals: Array<{ status: string; reviewerUserId: string | null }>
  documents: Array<{ status: string; expiresAt: string | null }>
  notifications: Array<{ status: string; userId: string }>
  vendors: Array<{ pipelineStatus: VendorPipelineStatus }>
  currentUserId: string
  now?: Date
}

export function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function normalizeMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number < 0) return null
  return Math.round(number * 100) / 100
}

export function normalizeCurrency(value: unknown): string {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
}

export function normalizeOptionalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new Error('Date must be an ISO date string.')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date.')
  return date.toISOString()
}

export function sanitizeExternalUrl(value: unknown, required = false): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    if (required) throw new Error('A URL is required.')
    return ''
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Enter a valid URL.')
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Only http and https URLs are allowed.')
  }
  return url.toString()
}

export function isApprovalTransitionAllowed(
  current: ApprovalStatus,
  next: ApprovalStatus,
): boolean {
  if (current === next) return true
  if (current !== 'pending') return false
  return ['approved', 'rejected', 'cancelled'].includes(next)
}

export function extractMentionEmails(body: string): string[] {
  const matches = body.match(/@[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []
  return Array.from(
    new Set(matches.map((match) => match.slice(1).trim().toLowerCase())),
  )
}

export function calculateCollaborationMetrics(input: CollaborationMetricsInput) {
  const now = input.now ?? new Date()
  const inThirtyDays = new Date(now)
  inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30)

  const openTasks = input.tasks.filter((task) => task.status !== 'done')
  const myTasks = openTasks.filter(
    (task) => task.assigneeUserId === input.currentUserId,
  )
  const overdueTasks = openTasks.filter((task) => {
    if (!task.dueDate) return false
    return new Date(task.dueDate).getTime() < now.getTime()
  })
  const pendingApprovals = input.approvals.filter(
    (approval) =>
      approval.status === 'pending' &&
      (!approval.reviewerUserId || approval.reviewerUserId === input.currentUserId),
  )
  const expiringDocuments = input.documents.filter((document) => {
    if (document.status !== 'active' || !document.expiresAt) return false
    const expiry = new Date(document.expiresAt)
    return expiry >= now && expiry <= inThirtyDays
  })
  const unreadNotifications = input.notifications.filter(
    (notification) =>
      notification.userId === input.currentUserId && notification.status === 'unread',
  )
  const bookedVendors = input.vendors.filter((vendor) =>
    ['booked', 'completed'].includes(vendor.pipelineStatus),
  )

  return {
    openTasks: openTasks.length,
    myTasks: myTasks.length,
    overdueTasks: overdueTasks.length,
    pendingApprovals: pendingApprovals.length,
    expiringDocuments: expiringDocuments.length,
    unreadNotifications: unreadNotifications.length,
    bookedVendors: bookedVendors.length,
    vendorsInPipeline: input.vendors.length - bookedVendors.length,
  }
}

const LEGACY_VENDOR_PREFIX = '__wewed_meta__:'

export interface LegacyVendorMeta {
  contact?: string
  contractStatus?: string
  paymentStatus?: string
  rating?: number
  notes?: string
}

export function decodeLegacyVendorDescription(description: string | null): {
  meta: LegacyVendorMeta
  humanDescription: string | null
} {
  if (!description) return { meta: {}, humanDescription: null }
  if (!description.startsWith(LEGACY_VENDOR_PREFIX)) {
    return { meta: {}, humanDescription: description }
  }
  const [blob, ...humanParts] = description.slice(LEGACY_VENDOR_PREFIX.length).split('|||')
  return {
    meta: parseJson<LegacyVendorMeta>(blob, {}),
    humanDescription: humanParts.length ? humanParts.join('|||') : null,
  }
}

export function encodeLegacyVendorDescription(
  description: string | null,
  meta: LegacyVendorMeta,
): string {
  const human = description?.trim() || ''
  return `${LEGACY_VENDOR_PREFIX}${JSON.stringify(meta)}${human ? `|||${human}` : ''}`
}

export function legacyContractStatus(status: VendorPipelineStatus): string {
  if (status === 'rejected') return 'declined'
  if (status === 'booked' || status === 'completed') return 'signed'
  if (status === 'negotiating' || status === 'quoted') return 'negotiating'
  return 'pending'
}

export function legacyPaymentStatus(value: VendorPipelineValue): string {
  if (value.balancePaidAt) return 'paid'
  if (value.depositPaidAt) return 'deposit'
  return 'unpaid'
}
