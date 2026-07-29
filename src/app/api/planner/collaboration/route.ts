import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  contextHasPermission,
  requireWeddingPermission,
  type WeddingContext,
} from '@/lib/wedding-access'
import {
  APPROVAL_STATUSES,
  COLLABORATION_SECTIONS,
  VENDOR_PIPELINE_STATUSES,
  calculateCollaborationMetrics,
  decodeLegacyVendorDescription,
  encodeLegacyVendorDescription,
  extractMentionEmails,
  isApprovalTransitionAllowed,
  legacyContractStatus,
  legacyPaymentStatus,
  normalizeCurrency,
  normalizeMoney,
  normalizeOptionalDate,
  parseJson,
  sanitizeExternalUrl,
  type ApprovalStatus,
  type ApprovalValue,
  type CollaborationResourceType,
  type PlannerCommentValue,
  type PlannerDocumentValue,
  type PlannerNotificationValue,
  type TaskAssignmentValue,
  type VendorPipelineStatus,
  type VendorPipelineValue,
} from '@/lib/planner-phase3'

const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked'] as const
const RESOURCE_TYPES: CollaborationResourceType[] = [
  'task',
  'vendor',
  'budget',
  'guest',
  'timeline',
  'document',
]

class RouteError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function requireString(value: unknown, label: string): string {
  const result = stringValue(value)
  if (!result) throw new RouteError(`${label} is required.`)
  return result
}

function permissionForTarget(type: CollaborationResourceType): string {
  if (type === 'vendor') return 'vendors.edit'
  if (type === 'budget') return 'budget.edit'
  if (type === 'guest') return 'guests.edit'
  if (type === 'timeline') return 'timeline.edit'
  return 'planner.edit'
}

function requireContextPermission(context: WeddingContext, permission: string) {
  if (!contextHasPermission(context, permission)) {
    throw new RouteError(`Forbidden — requires ${permission} permission.`, 403)
  }
}

async function getTeam(context: WeddingContext): Promise<TeamMember[]> {
  const [memberships, currentUser] = await Promise.all([
    db.weddingMembership.findMany({
      where: {
        weddingId: context.weddingId,
        status: 'active',
        user: { isActive: true },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.user.findUnique({
      where: { id: context.session.userId },
      select: { id: true, name: true, email: true },
    }),
  ])

  const result = new Map<string, TeamMember>()
  for (const membership of memberships) {
    result.set(membership.user.id, {
      id: membership.user.id,
      name: membership.user.name?.trim() || membership.user.email,
      email: membership.user.email,
      role: membership.role,
    })
  }
  if (currentUser && !result.has(currentUser.id)) {
    result.set(currentUser.id, {
      id: currentUser.id,
      name: currentUser.name?.trim() || currentUser.email,
      email: currentUser.email,
      role: context.role,
    })
  }
  return Array.from(result.values()).sort((a, b) => a.name.localeCompare(b.name))
}

async function getTarget(
  weddingId: string,
  type: CollaborationResourceType,
  id: string,
): Promise<{ id: string; label: string }> {
  if (type === 'task') {
    const row = await db.plannerTask.findFirst({
      where: { id, weddingId },
      select: { id: true, title: true },
    })
    if (row) return { id: row.id, label: row.title }
  }
  if (type === 'vendor') {
    const row = await db.vendor.findFirst({
      where: { id, weddingId },
      select: { id: true, name: true },
    })
    if (row) return { id: row.id, label: row.name }
  }
  if (type === 'budget') {
    const row = await db.budgetItem.findFirst({
      where: { id, weddingId },
      select: { id: true, description: true },
    })
    if (row) return { id: row.id, label: row.description }
  }
  if (type === 'guest') {
    const row = await db.guest.findFirst({
      where: { id, weddingId },
      select: { id: true, name: true },
    })
    if (row) return { id: row.id, label: row.name }
  }
  if (type === 'timeline') {
    const row = await db.programmeItem.findFirst({
      where: { id, weddingId },
      select: { id: true, title: true },
    })
    if (row) return { id: row.id, label: row.title }
  }
  if (type === 'document') {
    const row = await db.contentRevision.findFirst({
      where: {
        id,
        weddingId,
        section: 'planner_document',
        status: { not: 'archived' },
      },
      select: { id: true, value: true },
    })
    if (row) {
      const value = parseJson<PlannerDocumentValue | null>(row.value, null)
      if (value) return { id: row.id, label: value.name }
    }
  }
  throw new RouteError('The selected resource was not found in this wedding.', 404)
}

function legacyPipeline(
  vendor: { id: string; description: string | null },
  actorId: string,
): VendorPipelineValue {
  const decoded = decodeLegacyVendorDescription(vendor.description)
  const contract = decoded.meta.contractStatus
  const pipelineStatus: VendorPipelineStatus =
    contract === 'signed'
      ? 'booked'
      : contract === 'declined'
        ? 'rejected'
        : contract === 'negotiating'
          ? 'negotiating'
          : 'lead'
  return {
    version: 1,
    vendorId: vendor.id,
    contactName: decoded.meta.contact ?? '',
    email: '',
    pipelineStatus,
    quoteAmount: null,
    currency: 'USD',
    contractUrl: '',
    depositAmount: null,
    depositDueDate: null,
    depositPaidAt: decoded.meta.paymentStatus === 'deposit' ? new Date(0).toISOString() : null,
    balanceDueDate: null,
    balancePaidAt: decoded.meta.paymentStatus === 'paid' ? new Date(0).toISOString() : null,
    ownerUserId: null,
    ownerName: null,
    notes: decoded.meta.notes ?? '',
    updatedById: actorId,
    updatedAt: new Date(0).toISOString(),
  }
}

function parseSectionMap<T>(
  rows: Array<{ id: string; fieldKey: string; value: string; status: string; createdAt: Date; updatedAt: Date }>,
  sectionRows: Set<string>,
): Map<string, { id: string; value: T; status: string; createdAt: Date; updatedAt: Date }> {
  const result = new Map<string, { id: string; value: T; status: string; createdAt: Date; updatedAt: Date }>()
  for (const row of rows) {
    if (!sectionRows.has(row.id) || result.has(row.fieldKey)) continue
    const value = parseJson<T | null>(row.value, null)
    if (value) result.set(row.fieldKey, { id: row.id, value, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt })
  }
  return result
}

async function createNotification(input: {
  weddingId: string
  userId: string
  type: string
  title: string
  body: string
  href?: string | null
  actorId: string
}) {
  if (input.userId === input.actorId) return
  const value: PlannerNotificationValue = {
    version: 1,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    createdAt: new Date().toISOString(),
  }
  await db.contentRevision.create({
    data: {
      section: 'planner_notification',
      fieldKey: `${input.userId}:${randomUUID()}`,
      value: JSON.stringify(value),
      status: 'unread',
      weddingId: input.weddingId,
      authorId: input.actorId,
    },
  })
}

async function audit(input: {
  weddingId: string
  actorId: string
  action: string
  resourceType: string
  resourceId?: string | null
  before?: unknown
  after?: unknown
}) {
  await db.auditEvent.create({
    data: {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      beforeValue: input.before === undefined ? null : JSON.stringify(input.before),
      afterValue: input.after === undefined ? null : JSON.stringify(input.after),
      weddingId: input.weddingId,
      actorId: input.actorId,
    },
  })
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const context = access.context
    const weddingId = context.weddingId
    const [team, tasks, vendors, budget, guests, timeline, revisions, activity] = await Promise.all([
      getTeam(context),
      db.plannerTask.findMany({
        where: { weddingId },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
      }),
      db.vendor.findMany({ where: { weddingId }, orderBy: [{ featured: 'desc' }, { name: 'asc' }] }),
      db.budgetItem.findMany({ where: { weddingId }, orderBy: { createdAt: 'asc' } }),
      db.guest.findMany({ where: { weddingId }, orderBy: { name: 'asc' } }),
      db.programmeItem.findMany({ where: { weddingId }, orderBy: [{ order: 'asc' }, { time: 'asc' }] }),
      db.contentRevision.findMany({
        where: { weddingId, section: { in: [...COLLABORATION_SECTIONS] } },
        orderBy: { updatedAt: 'desc' },
      }),
      db.auditEvent.findMany({ where: { weddingId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ])

    const idsBySection = (section: string) =>
      new Set(revisions.filter((row) => row.section === section).map((row) => row.id))
    const assignmentMap = parseSectionMap<TaskAssignmentValue>(
      revisions,
      idsBySection('planner_task_assignment'),
    )
    const vendorMap = parseSectionMap<VendorPipelineValue>(
      revisions,
      idsBySection('planner_vendor_pipeline'),
    )
    const teamById = new Map(team.map((member) => [member.id, member]))
    const teamByText = new Map(
      team.flatMap((member) => [
        [member.name.toLowerCase(), member],
        [member.email.toLowerCase(), member],
      ] as const),
    )

    const taskRows = tasks.map((task) => {
      const stored = assignmentMap.get(task.id)?.value
      const fallbackMember = task.assignee ? teamByText.get(task.assignee.toLowerCase()) : undefined
      const assigneeUserId = stored?.assigneeUserId ?? fallbackMember?.id ?? null
      return {
        ...task,
        dueDate: task.dueDate?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        assigneeUserId,
        assigneeName: stored?.assigneeName ?? fallbackMember?.name ?? task.assignee,
      }
    })

    const vendorRows = vendors.map((vendor) => {
      const pipeline = vendorMap.get(vendor.id)?.value ?? legacyPipeline(vendor, context.session.userId)
      const decoded = decodeLegacyVendorDescription(vendor.description)
      return {
        id: vendor.id,
        name: vendor.name,
        category: vendor.category,
        description: decoded.humanDescription,
        website: vendor.website,
        phone: vendor.phone,
        featured: vendor.featured,
        rating: vendor.rating,
        pipeline: {
          ...pipeline,
          ownerName:
            pipeline.ownerUserId && teamById.has(pipeline.ownerUserId)
              ? teamById.get(pipeline.ownerUserId)!.name
              : pipeline.ownerName,
        },
      }
    })

    const approvals = revisions
      .filter((row) => row.section === 'planner_approval' && row.status !== 'archived')
      .map((row) => {
        const value = parseJson<ApprovalValue | null>(row.value, null)
        return value
          ? { id: row.id, status: row.status as ApprovalStatus, ...value, updatedAt: row.updatedAt.toISOString() }
          : null
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))

    const documents = revisions
      .filter((row) => row.section === 'planner_document')
      .map((row) => {
        const value = parseJson<PlannerDocumentValue | null>(row.value, null)
        return value
          ? { id: row.id, status: row.status, ...value, updatedAt: row.updatedAt.toISOString() }
          : null
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))

    const comments = revisions
      .filter((row) => row.section === 'planner_comment' && row.status === 'published')
      .map((row) => {
        const value = parseJson<PlannerCommentValue | null>(row.value, null)
        return value ? { id: row.id, status: row.status, ...value } : null
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)

    const notifications = revisions
      .filter((row) => row.section === 'planner_notification')
      .map((row) => {
        const value = parseJson<PlannerNotificationValue | null>(row.value, null)
        return value ? { id: row.id, status: row.status, ...value } : null
      })
      .filter(
        (value): value is NonNullable<typeof value> =>
          Boolean(value) && value!.userId === context.session.userId,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)

    const metrics = calculateCollaborationMetrics({
      currentUserId: context.session.userId,
      tasks: taskRows,
      approvals,
      documents,
      notifications,
      vendors: vendorRows.map((vendor) => ({ pipelineStatus: vendor.pipeline.pipelineStatus })),
    })

    return NextResponse.json({
      success: true,
      currentUserId: context.session.userId,
      permissions: {
        plannerEdit: contextHasPermission(context, 'planner.edit'),
        vendorsEdit: contextHasPermission(context, 'vendors.edit'),
        budgetEdit: contextHasPermission(context, 'budget.edit'),
      },
      metrics,
      team,
      tasks: taskRows,
      vendors: vendorRows,
      approvals,
      documents,
      comments,
      notifications,
      resources: {
        task: tasks.map((row) => ({ id: row.id, label: row.title })),
        vendor: vendors.map((row) => ({ id: row.id, label: row.name })),
        budget: budget.map((row) => ({ id: row.id, label: row.description })),
        guest: guests.map((row) => ({ id: row.id, label: row.name })),
        timeline: timeline.map((row) => ({ id: row.id, label: `${row.time} · ${row.title}` })),
        document: documents
          .filter((row) => row.status !== 'archived')
          .map((row) => ({ id: row.id, label: row.name })),
      },
      activity: activity.map((event) => ({
        id: event.id,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        actorId: event.actorId,
        createdAt: event.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('[planner collaboration GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load the collaboration workspace.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const context = access.context
    const weddingId = context.weddingId
    const actorId = context.session.userId
    const body = (await request.json()) as Record<string, unknown>
    const action = requireString(body.action, 'Action')
    const team = await getTeam(context)
    const teamById = new Map(team.map((member) => [member.id, member]))
    const actor = teamById.get(actorId) ?? {
      id: actorId,
      name: context.session.email,
      email: context.session.email,
      role: context.role,
    }

    if (action === 'assign_task') {
      requireContextPermission(context, 'planner.edit')
      const taskId = requireString(body.taskId, 'Task')
      const task = await db.plannerTask.findFirst({ where: { id: taskId, weddingId } })
      if (!task) throw new RouteError('Task not found.', 404)
      const assigneeUserId = stringValue(body.assigneeUserId) || null
      const assignee = assigneeUserId ? teamById.get(assigneeUserId) : null
      if (assigneeUserId && !assignee) throw new RouteError('Assignee is not an active wedding team member.')

      const value: TaskAssignmentValue = {
        version: 1,
        taskId,
        assigneeUserId,
        assigneeName: assignee?.name ?? null,
        assignedById: actorId,
        assignedAt: new Date().toISOString(),
      }
      const existing = await db.contentRevision.findFirst({
        where: { weddingId, section: 'planner_task_assignment', fieldKey: taskId },
      })
      await db.$transaction([
        db.plannerTask.update({
          where: { id: task.id },
          data: { assignee: assignee?.name ?? null },
        }),
        existing
          ? db.contentRevision.update({
              where: { id: existing.id },
              data: { value: JSON.stringify(value), status: 'active', authorId: actorId },
            })
          : db.contentRevision.create({
              data: {
                section: 'planner_task_assignment',
                fieldKey: taskId,
                value: JSON.stringify(value),
                status: 'active',
                weddingId,
                authorId: actorId,
              },
            }),
      ])
      if (assignee) {
        await createNotification({
          weddingId,
          userId: assignee.id,
          type: 'task_assignment',
          title: 'Task assigned to you',
          body: task.title,
          href: 'team-hub:work',
          actorId,
        })
      }
      await audit({ weddingId, actorId, action: 'collaboration.task_assign', resourceType: 'planner_task', resourceId: taskId, before: { assignee: task.assignee }, after: value })
      return NextResponse.json({ success: true, data: value })
    }

    if (action === 'update_task_status') {
      requireContextPermission(context, 'planner.edit')
      const taskId = requireString(body.taskId, 'Task')
      const status = requireString(body.status, 'Status')
      if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
        throw new RouteError('Invalid task status.')
      }
      const task = await db.plannerTask.findFirst({ where: { id: taskId, weddingId } })
      if (!task) throw new RouteError('Task not found.', 404)
      const updated = await db.plannerTask.update({ where: { id: task.id }, data: { status } })
      const assignmentRow = await db.contentRevision.findFirst({
        where: { weddingId, section: 'planner_task_assignment', fieldKey: taskId },
      })
      const assignment = assignmentRow
        ? parseJson<TaskAssignmentValue | null>(assignmentRow.value, null)
        : null
      if (assignment?.assigneeUserId) {
        await createNotification({
          weddingId,
          userId: assignment.assigneeUserId,
          type: 'task_status',
          title: `Task marked ${status.replace('_', ' ')}`,
          body: task.title,
          href: 'team-hub:work',
          actorId,
        })
      }
      await audit({ weddingId, actorId, action: 'collaboration.task_status', resourceType: 'planner_task', resourceId: taskId, before: { status: task.status }, after: { status } })
      return NextResponse.json({ success: true, data: { id: updated.id, status: updated.status } })
    }

    if (action === 'upsert_vendor_pipeline') {
      requireContextPermission(context, 'vendors.edit')
      const vendorId = requireString(body.vendorId, 'Vendor')
      const vendor = await db.vendor.findFirst({ where: { id: vendorId, weddingId } })
      if (!vendor) throw new RouteError('Vendor not found.', 404)
      const existing = await db.contentRevision.findFirst({
        where: { weddingId, section: 'planner_vendor_pipeline', fieldKey: vendorId },
      })
      const current = existing
        ? parseJson<VendorPipelineValue>(existing.value, legacyPipeline(vendor, actorId))
        : legacyPipeline(vendor, actorId)
      const pipelineStatus = stringValue(body.pipelineStatus) || current.pipelineStatus
      if (!VENDOR_PIPELINE_STATUSES.includes(pipelineStatus as VendorPipelineStatus)) {
        throw new RouteError('Invalid vendor pipeline status.')
      }
      const ownerUserId = stringValue(body.ownerUserId) || null
      const owner = ownerUserId ? teamById.get(ownerUserId) : null
      if (ownerUserId && !owner) throw new RouteError('Vendor owner is not an active wedding team member.')
      const email = stringValue(body.email).toLowerCase()
      if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new RouteError('Enter a valid vendor email address.')
      const money = (raw: unknown, label: string) => {
        if (raw === '' || raw === null || raw === undefined) return null
        const value = normalizeMoney(raw)
        if (value === null) throw new RouteError(`${label} must be zero or greater.`)
        return value
      }
      const value: VendorPipelineValue = {
        version: 1,
        vendorId,
        contactName: stringValue(body.contactName),
        email,
        pipelineStatus: pipelineStatus as VendorPipelineStatus,
        quoteAmount: money(body.quoteAmount, 'Quote amount'),
        currency: normalizeCurrency(body.currency),
        contractUrl: sanitizeExternalUrl(body.contractUrl),
        depositAmount: money(body.depositAmount, 'Deposit amount'),
        depositDueDate: normalizeOptionalDate(body.depositDueDate),
        depositPaidAt: normalizeOptionalDate(body.depositPaidAt),
        balanceDueDate: normalizeOptionalDate(body.balanceDueDate),
        balancePaidAt: normalizeOptionalDate(body.balancePaidAt),
        ownerUserId,
        ownerName: owner?.name ?? null,
        notes: stringValue(body.notes),
        updatedById: actorId,
        updatedAt: new Date().toISOString(),
      }
      const decoded = decodeLegacyVendorDescription(vendor.description)
      const legacyDescription = encodeLegacyVendorDescription(decoded.humanDescription, {
        ...decoded.meta,
        contact: value.contactName || undefined,
        contractStatus: legacyContractStatus(value.pipelineStatus),
        paymentStatus: legacyPaymentStatus(value),
        notes: value.notes || undefined,
      })
      await db.$transaction([
        db.vendor.update({ where: { id: vendor.id }, data: { description: legacyDescription } }),
        existing
          ? db.contentRevision.update({
              where: { id: existing.id },
              data: { value: JSON.stringify(value), status: 'active', authorId: actorId },
            })
          : db.contentRevision.create({
              data: {
                section: 'planner_vendor_pipeline',
                fieldKey: vendorId,
                value: JSON.stringify(value),
                status: 'active',
                weddingId,
                authorId: actorId,
              },
            }),
      ])
      if (owner) {
        await createNotification({ weddingId, userId: owner.id, type: 'vendor_owner', title: 'Vendor assigned to you', body: vendor.name, href: 'team-hub:vendors', actorId })
      }
      await audit({ weddingId, actorId, action: 'collaboration.vendor_pipeline', resourceType: 'vendor', resourceId: vendorId, before: current, after: value })
      return NextResponse.json({ success: true, data: value })
    }

    if (action === 'create_approval') {
      requireContextPermission(context, 'planner.edit')
      const targetType = requireString(body.targetType, 'Target type') as CollaborationResourceType
      if (!RESOURCE_TYPES.includes(targetType)) throw new RouteError('Invalid approval target type.')
      requireContextPermission(context, permissionForTarget(targetType))
      const target = await getTarget(weddingId, targetType, requireString(body.targetId, 'Target'))
      const reviewerUserId = stringValue(body.reviewerUserId) || null
      const reviewer = reviewerUserId ? teamById.get(reviewerUserId) : null
      if (reviewerUserId && !reviewer) throw new RouteError('Reviewer is not an active wedding team member.')
      const value: ApprovalValue = {
        version: 1,
        title: requireString(body.title, 'Approval title'),
        description: stringValue(body.description),
        targetType,
        targetId: target.id,
        targetLabel: target.label,
        requestedById: actorId,
        requestedByName: actor.name,
        reviewerUserId,
        reviewerName: reviewer?.name ?? null,
        decisionNote: '',
        decidedById: null,
        decidedByName: null,
        decidedAt: null,
        createdAt: new Date().toISOString(),
      }
      const row = await db.contentRevision.create({
        data: {
          section: 'planner_approval',
          fieldKey: `approval_${randomUUID()}`,
          value: JSON.stringify(value),
          status: 'pending',
          weddingId,
          authorId: actorId,
        },
      })
      const recipients = reviewer
        ? [reviewer]
        : team.filter((member) => ['owner', 'planner', 'admin'].includes(member.role))
      await Promise.all(
        recipients.map((member) =>
          createNotification({ weddingId, userId: member.id, type: 'approval_request', title: value.title, body: value.targetLabel, href: 'team-hub:approvals', actorId }),
        ),
      )
      await audit({ weddingId, actorId, action: 'collaboration.approval_request', resourceType: targetType, resourceId: target.id, after: value })
      return NextResponse.json({ success: true, data: { id: row.id, status: row.status, ...value } }, { status: 201 })
    }

    if (action === 'decide_approval') {
      requireContextPermission(context, 'planner.edit')
      const id = requireString(body.id, 'Approval')
      const nextStatus = requireString(body.status, 'Decision') as ApprovalStatus
      if (!APPROVAL_STATUSES.includes(nextStatus)) throw new RouteError('Invalid approval decision.')
      const row = await db.contentRevision.findFirst({ where: { id, weddingId, section: 'planner_approval' } })
      if (!row) throw new RouteError('Approval not found.', 404)
      const value = parseJson<ApprovalValue | null>(row.value, null)
      if (!value) throw new RouteError('Approval data is invalid.', 409)
      const currentStatus = row.status as ApprovalStatus
      if (!isApprovalTransitionAllowed(currentStatus, nextStatus)) {
        throw new RouteError('This approval has already been decided.', 409)
      }
      if (
        value.reviewerUserId &&
        value.reviewerUserId !== actorId &&
        !['owner', 'admin'].includes(context.role)
      ) {
        throw new RouteError('Only the assigned reviewer or wedding owner can decide this approval.', 403)
      }
      const nextValue: ApprovalValue = {
        ...value,
        decisionNote: stringValue(body.decisionNote),
        decidedById: actorId,
        decidedByName: actor.name,
        decidedAt: new Date().toISOString(),
      }
      await db.contentRevision.update({
        where: { id: row.id },
        data: { status: nextStatus, value: JSON.stringify(nextValue), authorId: actorId },
      })
      await createNotification({ weddingId, userId: value.requestedById, type: 'approval_decision', title: `${value.title}: ${nextStatus}`, body: nextValue.decisionNote || value.targetLabel, href: 'team-hub:approvals', actorId })
      await audit({ weddingId, actorId, action: `collaboration.approval_${nextStatus}`, resourceType: value.targetType, resourceId: value.targetId, before: { status: currentStatus }, after: { status: nextStatus, decisionNote: nextValue.decisionNote } })
      return NextResponse.json({ success: true, data: { id, status: nextStatus, ...nextValue } })
    }

    if (action === 'create_document') {
      requireContextPermission(context, 'planner.edit')
      const rawTargetType = stringValue(body.targetType)
      const targetType = rawTargetType ? (rawTargetType as Exclude<CollaborationResourceType, 'document'>) : null
      if (targetType && (!RESOURCE_TYPES.includes(targetType) || targetType === 'document')) {
        throw new RouteError('Invalid document target type.')
      }
      let target: { id: string; label: string } | null = null
      if (targetType) {
        requireContextPermission(context, permissionForTarget(targetType))
        target = await getTarget(weddingId, targetType, requireString(body.targetId, 'Linked resource'))
      }
      const value: PlannerDocumentValue = {
        version: 1,
        name: requireString(body.name, 'Document name'),
        url: sanitizeExternalUrl(body.url, true),
        category: stringValue(body.category) || 'general',
        notes: stringValue(body.notes),
        targetType,
        targetId: target?.id ?? null,
        targetLabel: target?.label ?? null,
        expiresAt: normalizeOptionalDate(body.expiresAt),
        uploadedById: actorId,
        uploadedByName: actor.name,
        createdAt: new Date().toISOString(),
      }
      const row = await db.contentRevision.create({
        data: {
          section: 'planner_document',
          fieldKey: `document_${randomUUID()}`,
          value: JSON.stringify(value),
          status: 'active',
          weddingId,
          authorId: actorId,
        },
      })
      await audit({ weddingId, actorId, action: 'collaboration.document_create', resourceType: 'planner_document', resourceId: row.id, after: value })
      return NextResponse.json({ success: true, data: { id: row.id, status: row.status, ...value } }, { status: 201 })
    }

    if (action === 'archive_document') {
      requireContextPermission(context, 'planner.edit')
      const id = requireString(body.id, 'Document')
      const row = await db.contentRevision.findFirst({ where: { id, weddingId, section: 'planner_document', status: { not: 'archived' } } })
      if (!row) throw new RouteError('Document not found.', 404)
      await db.contentRevision.update({ where: { id: row.id }, data: { status: 'archived', authorId: actorId } })
      await audit({ weddingId, actorId, action: 'collaboration.document_archive', resourceType: 'planner_document', resourceId: id })
      return NextResponse.json({ success: true, data: { id, status: 'archived' } })
    }

    if (action === 'create_comment') {
      requireContextPermission(context, 'planner.edit')
      const targetType = requireString(body.targetType, 'Target type') as CollaborationResourceType
      if (!RESOURCE_TYPES.includes(targetType)) throw new RouteError('Invalid comment target type.')
      requireContextPermission(context, permissionForTarget(targetType))
      const target = await getTarget(weddingId, targetType, requireString(body.targetId, 'Target'))
      const commentBody = requireString(body.body, 'Comment')
      if (commentBody.length > 2000) throw new RouteError('Comment is too long (maximum 2,000 characters).')
      const parentId = stringValue(body.parentId) || null
      if (parentId) {
        const parent = await db.contentRevision.findFirst({ where: { id: parentId, weddingId, section: 'planner_comment', status: 'published' } })
        const parentValue = parent ? parseJson<PlannerCommentValue | null>(parent.value, null) : null
        if (!parentValue || parentValue.targetType !== targetType || parentValue.targetId !== target.id) {
          throw new RouteError('Parent comment does not match this resource.')
        }
      }
      const value: PlannerCommentValue = {
        version: 1,
        body: commentBody,
        targetType,
        targetId: target.id,
        targetLabel: target.label,
        parentId,
        authorId: actorId,
        authorName: actor.name,
        createdAt: new Date().toISOString(),
      }
      const row = await db.contentRevision.create({
        data: {
          section: 'planner_comment',
          fieldKey: `${targetType}:${target.id}:${randomUUID()}`,
          value: JSON.stringify(value),
          status: 'published',
          weddingId,
          authorId: actorId,
        },
      })
      const mentions = new Set(extractMentionEmails(commentBody))
      await Promise.all(
        team
          .filter((member) => mentions.has(member.email.toLowerCase()))
          .map((member) =>
            createNotification({ weddingId, userId: member.id, type: 'comment_mention', title: `${actor.name} mentioned you`, body: `${target.label}: ${commentBody.slice(0, 180)}`, href: 'team-hub:discussion', actorId }),
          ),
      )
      await audit({ weddingId, actorId, action: 'collaboration.comment_create', resourceType: targetType, resourceId: target.id, after: { commentId: row.id } })
      return NextResponse.json({ success: true, data: { id: row.id, status: row.status, ...value } }, { status: 201 })
    }

    if (action === 'delete_comment') {
      const id = requireString(body.id, 'Comment')
      const row = await db.contentRevision.findFirst({ where: { id, weddingId, section: 'planner_comment', status: 'published' } })
      if (!row) throw new RouteError('Comment not found.', 404)
      const value = parseJson<PlannerCommentValue | null>(row.value, null)
      if (!value) throw new RouteError('Comment data is invalid.', 409)
      if (value.authorId !== actorId && !['owner', 'admin'].includes(context.role)) {
        throw new RouteError('Only the author or wedding owner can delete this comment.', 403)
      }
      await db.contentRevision.update({ where: { id: row.id }, data: { status: 'archived', authorId: actorId } })
      await audit({ weddingId, actorId, action: 'collaboration.comment_delete', resourceType: value.targetType, resourceId: value.targetId, before: { commentId: id } })
      return NextResponse.json({ success: true, data: { id, status: 'archived' } })
    }

    if (action === 'mark_notifications') {
      const requestedId = stringValue(body.id)
      const rows = await db.contentRevision.findMany({
        where: {
          weddingId,
          section: 'planner_notification',
          status: 'unread',
          ...(requestedId ? { id: requestedId } : {}),
        },
        select: { id: true, value: true },
      })
      const ids = rows
        .filter((row) => {
          const value = parseJson<PlannerNotificationValue | null>(row.value, null)
          return value?.userId === actorId
        })
        .map((row) => row.id)
      if (ids.length) {
        await db.contentRevision.updateMany({ where: { id: { in: ids } }, data: { status: 'read' } })
      }
      return NextResponse.json({ success: true, data: { updated: ids.length } })
    }

    throw new RouteError('Unsupported collaboration action.', 400)
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[planner collaboration POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Collaboration action failed.' },
      { status: 500 },
    )
  }
}
