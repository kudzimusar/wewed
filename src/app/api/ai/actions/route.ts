import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { blockUnsafeAiPreviewWrite } from '@/lib/ai/route-safety'
import { canTransitionProposal } from '@/lib/ai/remediation'
import { dateFromOffset, normalizeTitle } from '@/lib/planner-phase2'
import {
  AI_SECTIONS,
  listActionProposals,
  type AiActionProposalValue,
  type AiCommunicationDraftValue,
  type AiTemplateVersionValue,
} from '@/lib/ai/workspace-store'

interface RuntimeProposalValue extends AiActionProposalValue {
  executionId?: string | null
  executingAt?: string | null
  result?: Record<string, unknown> | null
}

interface RevisionRow {
  id: string
  fieldKey: string
  value: string
  status: string
  weddingId: string
  authorId: string | null
  publishedAt: Date | null
  scheduledFor: Date | null
  createdAt: Date
  updatedAt: Date
}

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T
}

function proposalResponse(row: RevisionRow) {
  return {
    id: row.id,
    key: row.fieldKey,
    status: row.status,
    weddingId: row.weddingId,
    authorId: row.authorId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    value: parse<RuntimeProposalValue>(row.value),
  }
}

function withProposalStatus(
  current: RuntimeProposalValue,
  status: 'approved' | 'rejected' | 'executing' | 'executed' | 'failed',
  input?: {
    executionId?: string
    failure?: string | null
    result?: Record<string, unknown>
  },
): RuntimeProposalValue {
  const now = new Date().toISOString()
  return {
    ...current,
    approvedAt: status === 'approved' ? now : current.approvedAt,
    rejectedAt: status === 'rejected' ? now : current.rejectedAt,
    executedAt: status === 'executed' ? now : current.executedAt,
    failure:
      status === 'failed'
        ? (input?.failure ?? 'AI action execution failed.')
        : status === 'approved' || status === 'executing' || status === 'executed'
          ? null
          : current.failure,
    executionId:
      status === 'executing'
        ? (input?.executionId ?? current.executionId ?? null)
        : current.executionId ?? null,
    executingAt: status === 'executing' ? now : current.executingAt ?? null,
    result: status === 'executed' ? (input?.result ?? null) : current.result ?? null,
  }
}

async function transitionProposal(input: {
  weddingId: string
  actorId: string
  row: RevisionRow
  status: 'approved' | 'rejected'
}) {
  if (!canTransitionProposal(input.row.status, input.status, 'external')) {
    throw new Error(
      `Proposal cannot move from ${input.row.status} to ${input.status}.`,
    )
  }

  const before = parse<RuntimeProposalValue>(input.row.value)
  const next = withProposalStatus(before, input.status)
  return db.$transaction(async (tx) => {
    const changed = await tx.contentRevision.updateMany({
      where: {
        id: input.row.id,
        weddingId: input.weddingId,
        section: AI_SECTIONS.proposal,
        status: input.row.status,
      },
      data: {
        status: input.status,
        value: JSON.stringify(next),
      },
    })
    if (changed.count !== 1) {
      throw new Error('Proposal state changed before this request completed.')
    }
    const updated = await tx.contentRevision.findUnique({
      where: { id: input.row.id },
    })
    if (!updated) throw new Error('AI action proposal not found.')
    await tx.auditEvent.create({
      data: {
        action: `ai.action.${input.status}`,
        resourceType: AI_SECTIONS.proposal,
        resourceId: input.row.id,
        beforeValue: input.row.value,
        afterValue: updated.value,
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return updated
  })
}

async function claimProposal(input: {
  weddingId: string
  actorId: string
  row: RevisionRow
}) {
  if (input.row.status !== 'approved') {
    throw new Error(
      `Proposal cannot be executed from ${input.row.status}; approval is required.`,
    )
  }

  const executionId = `aiexec_${randomUUID().replace(/-/g, '')}`
  const before = parse<RuntimeProposalValue>(input.row.value)
  const next = withProposalStatus(before, 'executing', { executionId })

  const claimed = await db.$transaction(async (tx) => {
    const changed = await tx.contentRevision.updateMany({
      where: {
        id: input.row.id,
        weddingId: input.weddingId,
        section: AI_SECTIONS.proposal,
        status: 'approved',
      },
      data: { status: 'executing', value: JSON.stringify(next) },
    })
    if (changed.count !== 1) {
      throw new Error(
        'Proposal is already being executed or its state changed.',
      )
    }
    const updated = await tx.contentRevision.findUnique({
      where: { id: input.row.id },
    })
    if (!updated) throw new Error('AI action proposal not found.')
    await tx.auditEvent.create({
      data: {
        action: 'ai.action.executing',
        resourceType: AI_SECTIONS.proposal,
        resourceId: input.row.id,
        beforeValue: input.row.value,
        afterValue: updated.value,
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return updated
  })

  return { row: claimed, executionId }
}

async function finalizeProposal(input: {
  weddingId: string
  actorId: string
  id: string
  executionId: string
  status: 'executed' | 'failed'
  result?: Record<string, unknown>
  failure?: string
}) {
  return db.$transaction(async (tx) => {
    const current = await tx.contentRevision.findFirst({
      where: {
        id: input.id,
        weddingId: input.weddingId,
        section: AI_SECTIONS.proposal,
        status: 'executing',
      },
    })
    if (!current) {
      throw new Error('Executing proposal claim no longer exists.')
    }
    const value = parse<RuntimeProposalValue>(current.value)
    if (value.executionId !== input.executionId) {
      throw new Error('Executing proposal is owned by another execution claim.')
    }
    const next = withProposalStatus(value, input.status, {
      result: input.result,
      failure: input.failure,
    })
    const changed = await tx.contentRevision.updateMany({
      where: {
        id: input.id,
        weddingId: input.weddingId,
        section: AI_SECTIONS.proposal,
        status: 'executing',
        value: current.value,
      },
      data: { status: input.status, value: JSON.stringify(next) },
    })
    if (changed.count !== 1) {
      throw new Error('Proposal finalization lost its atomic execution claim.')
    }
    const updated = await tx.contentRevision.findUnique({
      where: { id: input.id },
    })
    if (!updated) throw new Error('AI action proposal not found.')
    await tx.auditEvent.create({
      data: {
        action: `ai.action.${input.status}`,
        resourceType: AI_SECTIONS.proposal,
        resourceId: input.id,
        beforeValue: current.value,
        afterValue: updated.value,
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    if (input.result) {
      await tx.auditEvent.create({
        data: {
          action: 'ai.action.execution.result',
          resourceType: AI_SECTIONS.proposal,
          resourceId: input.id,
          afterValue: JSON.stringify(input.result),
          weddingId: input.weddingId,
          actorId: input.actorId,
        },
      })
    }
    return updated
  })
}

async function executeApplyTemplate(input: {
  weddingId: string
  actorId: string
  versionId: string
}) {
  const row = await db.contentRevision.findFirst({
    where: {
      id: input.versionId,
      weddingId: input.weddingId,
      section: AI_SECTIONS.template,
      status: { not: 'archived' },
    },
  })
  if (!row) throw new Error('AI template version not found.')
  const template = parse<AiTemplateVersionValue>(row.value)
  if (!template.anonymized) {
    throw new Error('Template must pass anonymization review before application.')
  }
  if (template.items.length === 0) {
    throw new Error('Template has no structured items and cannot be applied.')
  }
  const wedding = await db.wedding.findUnique({
    where: { id: input.weddingId },
    select: { date: true },
  })
  if (!wedding) throw new Error('Wedding not found.')

  const result = {
    tasksCreated: 0,
    timelineCreated: 0,
    remindersCreated: 0,
    duplicatesSkipped: 0,
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-template:${input.weddingId}`}))`

    const [tasks, timeline, reminders] = await Promise.all([
      tx.plannerTask.findMany({
        where: { weddingId: input.weddingId },
        select: { title: true },
      }),
      tx.programmeItem.findMany({
        where: { weddingId: input.weddingId },
        select: { time: true, title: true },
      }),
      tx.contentRevision.findMany({
        where: {
          weddingId: input.weddingId,
          section: 'planner_reminder',
          status: { not: 'cancelled' },
        },
        select: { value: true, scheduledFor: true },
      }),
    ])

    const taskKeys = new Set(tasks.map((task) => normalizeTitle(task.title)))
    const timelineKeys = new Set(
      timeline.map((item) => `${item.time}|${normalizeTitle(item.title)}`),
    )
    const reminderKeys = new Set(
      reminders.map((reminder) => {
        try {
          const value = parse<{ subject?: string; audience?: string }>(
            reminder.value,
          )
          return `${normalizeTitle(value.subject || '')}|${value.audience || 'pending'}|${reminder.scheduledFor?.toISOString() || ''}`
        } catch {
          return reminder.value
        }
      }),
    )

    for (const item of template.items) {
      const title = item.title.trim()
      if (!title) {
        result.duplicatesSkipped += 1
        continue
      }

      if (item.type === 'task') {
        const key = normalizeTitle(title)
        if (taskKeys.has(key)) {
          result.duplicatesSkipped += 1
          continue
        }
        await tx.plannerTask.create({
          data: {
            title,
            description: item.description?.trim() || null,
            category: item.category || 'other',
            priority: item.priority || 'medium',
            dueDate:
              typeof item.offsetDays === 'number'
                ? dateFromOffset(wedding.date, item.offsetDays)
                : null,
            assignee: item.assignee?.trim() || null,
            order: tasks.length + result.tasksCreated + 1,
            weddingId: input.weddingId,
          },
        })
        taskKeys.add(key)
        result.tasksCreated += 1
        continue
      }

      if (item.type === 'timeline') {
        const time = item.time?.trim() || '09:00'
        const key = `${time}|${normalizeTitle(title)}`
        if (timelineKeys.has(key)) {
          result.duplicatesSkipped += 1
          continue
        }
        await tx.programmeItem.create({
          data: {
            time,
            title,
            description: item.description?.trim() || null,
            duration: item.duration?.trim() || null,
            location: item.location?.trim() || null,
            order: timeline.length + result.timelineCreated + 1,
            weddingId: input.weddingId,
          },
        })
        timelineKeys.add(key)
        result.timelineCreated += 1
        continue
      }

      const scheduledFor =
        typeof item.offsetDays === 'number'
          ? dateFromOffset(wedding.date, item.offsetDays)
          : null
      const audience = item.audience || 'pending'
      const subject = item.subject?.trim() || title
      const key = `${normalizeTitle(subject)}|${audience}|${scheduledFor?.toISOString() || ''}`
      if (reminderKeys.has(key)) {
        result.duplicatesSkipped += 1
        continue
      }
      await tx.contentRevision.create({
        data: {
          section: 'planner_reminder',
          fieldKey: `reminder_${randomUUID().replace(/-/g, '')}`,
          value: JSON.stringify({
            version: 1,
            name: title,
            subject,
            body: item.body || item.description || '',
            audience,
            channel: 'email',
            lastError: null,
            recipientCount: 0,
            lastSentAt: null,
            sourceAiTemplateVersionId: input.versionId,
          }),
          status: scheduledFor ? 'scheduled' : 'draft',
          scheduledFor,
          weddingId: input.weddingId,
          authorId: input.actorId,
        },
      })
      reminderKeys.add(key)
      result.remindersCreated += 1
    }
  })

  return { template: template.name, version: template.version, ...result }
}

async function executeApproveCommunication(input: {
  weddingId: string
  actorId: string
  draftId: string
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-draft:${input.weddingId}:${input.draftId}`}))`
    const row = await tx.contentRevision.findFirst({
      where: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.draft,
        OR: [{ id: input.draftId }, { fieldKey: input.draftId }],
      },
    })
    if (!row) throw new Error('Communication draft not found.')
    if (row.status === 'approved') {
      const value = parse<AiCommunicationDraftValue>(row.value)
      return { draftId: value.draftId, status: row.status, duplicateSkipped: true }
    }
    if (row.status !== 'draft') {
      throw new Error(`Communication cannot be approved from ${row.status}.`)
    }

    const current = parse<AiCommunicationDraftValue>(row.value)
    const next: AiCommunicationDraftValue = {
      ...current,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const changed = await tx.contentRevision.updateMany({
      where: { id: row.id, status: 'draft', value: row.value },
      data: { status: 'approved', value: JSON.stringify(next) },
    })
    if (changed.count !== 1) {
      throw new Error('Communication draft state changed before approval.')
    }
    await tx.auditEvent.create({
      data: {
        action: 'ai.communication.draft.approved',
        resourceType: AI_SECTIONS.draft,
        resourceId: row.id,
        beforeValue: row.value,
        afterValue: JSON.stringify(next),
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return { draftId: next.draftId, status: 'approved', duplicateSkipped: false }
  })
}

async function executeCreateReminder(input: {
  weddingId: string
  actorId: string
  draftId: string
  audience: string
  scheduledFor: string | null
}) {
  const allowedAudiences = ['all', 'pending', 'attending', 'declined']
  const audience = allowedAudiences.includes(input.audience)
    ? input.audience
    : 'pending'
  let scheduledFor: Date | null = null
  if (input.scheduledFor) {
    scheduledFor = new Date(input.scheduledFor)
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new Error('Invalid reminder schedule.')
    }
  }

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-reminder:${input.weddingId}:${input.draftId}`}))`
    const draftRow = await tx.contentRevision.findFirst({
      where: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.draft,
        OR: [{ id: input.draftId }, { fieldKey: input.draftId }],
      },
    })
    if (!draftRow) throw new Error('Communication draft not found.')
    if (!['draft', 'approved'].includes(draftRow.status)) {
      throw new Error(
        `Communication cannot become a reminder from ${draftRow.status}.`,
      )
    }
    const draft = parse<AiCommunicationDraftValue>(draftRow.value)
    const existingReminder = await tx.contentRevision.findFirst({
      where: {
        weddingId: input.weddingId,
        section: 'planner_reminder',
        value: { contains: draft.draftId },
        status: { not: 'cancelled' },
      },
    })
    if (existingReminder) {
      return {
        reminderId: existingReminder.id,
        status: existingReminder.status,
        duplicateSkipped: true,
        delivery:
          'not sent; use the existing reminder preview/send flow separately',
      }
    }

    const reminder = await tx.contentRevision.create({
      data: {
        section: 'planner_reminder',
        fieldKey: `reminder_${randomUUID().replace(/-/g, '')}`,
        value: JSON.stringify({
          version: 1,
          name: draft.title,
          subject: draft.subject || draft.title,
          body: draft.body,
          audience,
          channel: 'email',
          lastError: null,
          recipientCount: 0,
          lastSentAt: null,
          sourceAiDraftId: draft.draftId,
        }),
        status: scheduledFor ? 'scheduled' : 'draft',
        scheduledFor,
        weddingId: input.weddingId,
        authorId: input.actorId,
      },
    })

    if (draftRow.status === 'draft') {
      const nextDraft: AiCommunicationDraftValue = {
        ...draft,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const changed = await tx.contentRevision.updateMany({
        where: { id: draftRow.id, status: 'draft', value: draftRow.value },
        data: { status: 'approved', value: JSON.stringify(nextDraft) },
      })
      if (changed.count !== 1) {
        throw new Error('Communication draft state changed before reminder creation.')
      }
    }

    await tx.auditEvent.create({
      data: {
        action: 'ai.communication.reminder.create',
        resourceType: 'planner_reminder',
        resourceId: reminder.id,
        afterValue: reminder.value,
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return {
      reminderId: reminder.id,
      status: reminder.status,
      duplicateSkipped: false,
      delivery:
        'not sent; use the existing reminder preview/send flow separately',
    }
  })
}

async function executePublishGuestDocument(input: {
  weddingId: string
  actorId: string
  documentId: string
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-document:${input.weddingId}:${input.documentId}`}))`
    const document = await tx.weddingContent.findFirst({
      where: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.document,
        field: input.documentId,
      },
    })
    if (!document) throw new Error('AI document not found.')
    const metadata = parse<Record<string, unknown>>(document.value)
    if (metadata.visibility === 'public') {
      const chunks = await tx.weddingContent.count({
        where: {
          weddingId: input.weddingId,
          section: AI_SECTIONS.documentChunk,
          field: { startsWith: `${input.documentId}:` },
        },
      })
      return {
        documentId: input.documentId,
        visibility: 'public',
        chunks,
        duplicateSkipped: true,
      }
    }

    const chunks = await tx.weddingContent.findMany({
      where: {
        weddingId: input.weddingId,
        section: AI_SECTIONS.documentChunk,
        field: { startsWith: `${input.documentId}:` },
      },
    })
    if (chunks.length === 0) {
      throw new Error('Document has no indexed chunks to publish.')
    }

    const nextMetadata = { ...metadata, visibility: 'public' }
    await tx.weddingContent.update({
      where: { id: document.id },
      data: {
        value: JSON.stringify(nextMetadata),
        metadata: JSON.stringify({ visibility: 'public', published: true }),
      },
    })
    for (const chunk of chunks) {
      const value = parse<Record<string, unknown>>(chunk.value)
      await tx.weddingContent.update({
        where: { id: chunk.id },
        data: {
          value: JSON.stringify({ ...value, visibility: 'public' }),
          metadata: JSON.stringify({ visibility: 'public', published: true }),
        },
      })
    }
    await tx.auditEvent.create({
      data: {
        action: 'ai.document.publish',
        resourceType: AI_SECTIONS.document,
        resourceId: input.documentId,
        beforeValue: JSON.stringify({ visibility: metadata.visibility ?? 'private' }),
        afterValue: JSON.stringify({ visibility: 'public', chunks: chunks.length }),
        weddingId: input.weddingId,
        actorId: input.actorId,
      },
    })
    return {
      documentId: input.documentId,
      visibility: 'public',
      chunks: chunks.length,
      duplicateSkipped: false,
    }
  })
}

async function executeProposal(input: {
  weddingId: string
  actorId: string
  proposal: RuntimeProposalValue
}): Promise<Record<string, unknown>> {
  const payload = input.proposal.payload
  switch (input.proposal.type) {
    case 'apply_template':
      return executeApplyTemplate({
        weddingId: input.weddingId,
        actorId: input.actorId,
        versionId: String(payload.versionId || ''),
      })
    case 'approve_communication':
      return executeApproveCommunication({
        weddingId: input.weddingId,
        actorId: input.actorId,
        draftId: String(payload.draftId || ''),
      })
    case 'create_reminder':
      return executeCreateReminder({
        weddingId: input.weddingId,
        actorId: input.actorId,
        draftId: String(payload.draftId || ''),
        audience: String(payload.audience || 'pending'),
        scheduledFor:
          typeof payload.scheduledFor === 'string' ? payload.scheduledFor : null,
      })
    case 'publish_guest_document':
      return executePublishGuestDocument({
        weddingId: input.weddingId,
        actorId: input.actorId,
        documentId: String(payload.documentId || ''),
      })
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error
  try {
    const data = await listActionProposals(access.context.weddingId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[AI ACTIONS GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load AI action proposals.' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error
  const previewBlock = blockUnsafeAiPreviewWrite(
    request,
    access.context.weddingId,
  )
  if (previewBlock) return previewBlock

  try {
    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const requested = typeof body.status === 'string' ? body.status : ''
    if (!id || !['approved', 'rejected', 'executed'].includes(requested)) {
      return NextResponse.json(
        { success: false, error: 'Proposal id and valid status are required.' },
        { status: 400 },
      )
    }

    const row = await db.contentRevision.findFirst({
      where: {
        id,
        weddingId: access.context.weddingId,
        section: AI_SECTIONS.proposal,
      },
    })
    if (!row) {
      return NextResponse.json(
        { success: false, error: 'AI action proposal not found.' },
        { status: 404 },
      )
    }

    if (requested === 'approved' || requested === 'rejected') {
      const updated = await transitionProposal({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        row,
        status: requested,
      })
      return NextResponse.json({ success: true, data: proposalResponse(updated) })
    }

    const claim = await claimProposal({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      row,
    })
    const proposal = parse<RuntimeProposalValue>(claim.row.value)

    try {
      const result = await executeProposal({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        proposal,
      })
      const updated = await finalizeProposal({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        id,
        executionId: claim.executionId,
        status: 'executed',
        result,
      })
      return NextResponse.json({
        success: true,
        data: proposalResponse(updated),
        result,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI action execution failed.'
      const updated = await finalizeProposal({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        id,
        executionId: claim.executionId,
        status: 'failed',
        failure: message,
      })
      return NextResponse.json(
        { success: false, error: message, data: proposalResponse(updated) },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error('[AI ACTIONS PATCH] error:', error)
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to update AI action proposal.'
    const status = message.includes('not found')
      ? 404
      : message.includes('cannot') ||
          message.includes('already') ||
          message.includes('state changed') ||
          message.includes('approval is required')
        ? 409
        : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
