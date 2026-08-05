import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { blockUnsafeAiPreviewWrite } from '@/lib/ai/route-safety'
import { dateFromOffset, normalizeTitle } from '@/lib/planner-phase2'
import {
  AI_SECTIONS,
  listActionProposals,
  setProposalStatus,
  updateCommunicationDraft,
  type AiActionProposalValue,
  type AiCommunicationDraftValue,
  type AiProposalStatus,
  type AiTemplateVersionValue,
} from '@/lib/ai/workspace-store'

const TRANSITIONS: Record<string, string[]> = {
  proposed: ['approved', 'rejected'],
  approved: ['executed', 'rejected'],
  executing: ['approved'],
  rejected: [],
  executed: [],
  failed: ['approved', 'rejected'],
}

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T
}

async function executeApplyTemplate(input: {
  weddingId: string
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
    // Serialize template application per wedding. This closes the race where
    // two separately approved proposals could otherwise pass duplicate checks
    // before either transaction committed.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.weddingId}))`

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
          const value = parse<{ subject?: string; audience?: string }>(reminder.value)
          return `${normalizeTitle(value.subject || '')}|${value.audience || 'pending'}|${reminder.scheduledFor?.toISOString() || ''}`
        } catch {
          return reminder.value
        }
      }),
    )

    for (const item of template.items) {
      if (item.type === 'task') {
        const key = normalizeTitle(item.title)
        if (taskKeys.has(key)) {
          result.duplicatesSkipped += 1
          continue
        }
        await tx.plannerTask.create({
          data: {
            title: item.title.trim(),
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
        const key = `${time}|${normalizeTitle(item.title)}`
        if (timelineKeys.has(key)) {
          result.duplicatesSkipped += 1
          continue
        }
        await tx.programmeItem.create({
          data: {
            time,
            title: item.title.trim(),
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
      const subject = item.subject?.trim() || item.title.trim()
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
            name: item.title,
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
  const row = await db.contentRevision.findFirst({
    where: {
      weddingId: input.weddingId,
      section: AI_SECTIONS.draft,
      OR: [{ id: input.draftId }, { fieldKey: input.draftId }],
    },
  })
  if (!row) throw new Error('Communication draft not found.')
  const updated = await updateCommunicationDraft({
    weddingId: input.weddingId,
    actorId: input.actorId,
    id: row.id,
    status: 'approved',
  })
  return { draftId: updated.value.draftId, status: updated.status }
}

async function executeCreateReminder(input: {
  weddingId: string
  actorId: string
  draftId: string
  audience: string
  scheduledFor: string | null
}) {
  const draftRow = await db.contentRevision.findFirst({
    where: {
      weddingId: input.weddingId,
      section: AI_SECTIONS.draft,
      OR: [{ id: input.draftId }, { fieldKey: input.draftId }],
    },
  })
  if (!draftRow) throw new Error('Communication draft not found.')
  const draft = parse<AiCommunicationDraftValue>(draftRow.value)
  const existingReminder = await db.contentRevision.findFirst({
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
      delivery: 'not sent; use the existing reminder preview/send flow separately',
    }
  }

  const allowedAudiences = ['all', 'pending', 'attending', 'declined']
  const audience = allowedAudiences.includes(input.audience) ? input.audience : 'pending'
  let scheduledFor: Date | null = null
  if (input.scheduledFor) {
    scheduledFor = new Date(input.scheduledFor)
    if (Number.isNaN(scheduledFor.getTime())) throw new Error('Invalid reminder schedule.')
  }

  const reminder = await db.contentRevision.create({
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
  await updateCommunicationDraft({
    weddingId: input.weddingId,
    actorId: input.actorId,
    id: draftRow.id,
    status: 'approved',
  })
  return {
    reminderId: reminder.id,
    status: reminder.status,
    duplicateSkipped: false,
    delivery: 'not sent; use the existing reminder preview/send flow separately',
  }
}

async function executePublishGuestDocument(input: {
  weddingId: string
  documentId: string
}) {
  const document = await db.weddingContent.findFirst({
    where: {
      weddingId: input.weddingId,
      section: AI_SECTIONS.document,
      field: input.documentId,
    },
  })
  if (!document) throw new Error('AI document not found.')
  const metadata = parse<Record<string, unknown>>(document.value)
  const nextMetadata = { ...metadata, visibility: 'public' }
  const chunks = await db.weddingContent.findMany({
    where: {
      weddingId: input.weddingId,
      section: AI_SECTIONS.documentChunk,
      field: { startsWith: `${input.documentId}:` },
    },
  })
  await db.$transaction([
    db.weddingContent.update({
      where: { id: document.id },
      data: {
        value: JSON.stringify(nextMetadata),
        metadata: JSON.stringify({ visibility: 'public', published: true }),
      },
    }),
    ...chunks.map((chunk) => {
      const value = parse<Record<string, unknown>>(chunk.value)
      return db.weddingContent.update({
        where: { id: chunk.id },
        data: {
          value: JSON.stringify({ ...value, visibility: 'public' }),
          metadata: JSON.stringify({ visibility: 'public', published: true }),
        },
      })
    }),
  ])
  return { documentId: input.documentId, visibility: 'public', chunks: chunks.length }
}

async function executeProposal(input: {
  weddingId: string
  actorId: string
  proposal: AiActionProposalValue
}) {
  const payload = input.proposal.payload
  switch (input.proposal.type) {
    case 'apply_template':
      return executeApplyTemplate({
        weddingId: input.weddingId,
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
  const previewBlock = blockUnsafeAiPreviewWrite(request, access.context.weddingId)
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
    if (!TRANSITIONS[row.status]?.includes(requested)) {
      return NextResponse.json(
        {
          success: false,
          error: `Proposal cannot move from ${row.status} to ${requested}.`,
        },
        { status: 409 },
      )
    }

    if (requested === 'approved' || requested === 'rejected') {
      const proposal = await setProposalStatus({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        id,
        status: requested as AiProposalStatus,
      })
      return NextResponse.json({ success: true, data: proposal })
    }

    // Atomically claim the approved proposal before executing any write. This
    // prevents double-clicks and concurrent requests from applying it twice.
    const claimed = await db.contentRevision.updateMany({
      where: {
        id,
        weddingId: access.context.weddingId,
        section: AI_SECTIONS.proposal,
        status: 'approved',
      },
      data: { status: 'executing' },
    })
    if (claimed.count !== 1) {
      return NextResponse.json(
        { success: false, error: 'Proposal is already being executed or its state changed.' },
        { status: 409 },
      )
    }
    await db.auditEvent.create({
      data: {
        action: 'ai.action.executing',
        resourceType: AI_SECTIONS.proposal,
        resourceId: id,
        beforeValue: row.value,
        afterValue: row.value,
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
      },
    })

    const value = parse<AiActionProposalValue>(row.value)
    try {
      const result = await executeProposal({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        proposal: value,
      })
      const proposal = await setProposalStatus({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        id,
        status: 'executed',
      })
      await db.auditEvent.create({
        data: {
          action: 'ai.action.execution.result',
          resourceType: AI_SECTIONS.proposal,
          resourceId: id,
          afterValue: JSON.stringify(result),
          weddingId: access.context.weddingId,
          actorId: access.context.session.userId,
        },
      })
      return NextResponse.json({ success: true, data: proposal, result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI action execution failed.'
      const proposal = await setProposalStatus({
        weddingId: access.context.weddingId,
        actorId: access.context.session.userId,
        id,
        status: 'failed',
        failure: message,
      })
      return NextResponse.json(
        { success: false, error: message, data: proposal },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error('[AI ACTIONS PATCH] error:', error)
    const message = error instanceof Error ? error.message : 'Unable to update AI action proposal.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
