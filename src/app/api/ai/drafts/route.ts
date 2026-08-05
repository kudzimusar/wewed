import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { blockUnsafeAiPreviewWrite } from '@/lib/ai/route-safety'
import {
  canDirectlyPatchCommunicationStatus,
  communicationContentIsEditable,
} from '@/lib/ai/remediation'
import {
  AI_SECTIONS,
  createActionProposal,
  createCommunicationDraft,
  listCommunicationDrafts,
  updateCommunicationDraft,
  type AiCommunicationDraftValue,
} from '@/lib/ai/workspace-store'

const CHANNELS: AiCommunicationDraftValue['channel'][] = [
  'email',
  'whatsapp',
  'sms',
  'internal',
  'speech',
]

const KNOWN_STATUSES = new Set([
  'draft',
  'approved',
  'ready_to_send',
  'sent',
  'archived',
])

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access.error

  try {
    const data = await listCommunicationDrafts(access.context.weddingId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[AI DRAFTS GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load communication drafts.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error
  const previewBlock = blockUnsafeAiPreviewWrite(
    request,
    access.context.weddingId,
  )
  if (previewBlock) return previewBlock

  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : 'create'

    if (action === 'create') {
      const title = typeof body.title === 'string' ? body.title : ''
      const content = typeof body.body === 'string' ? body.body : ''
      if (!title.trim() || !content.trim()) {
        return NextResponse.json(
          { success: false, error: 'Draft title and body are required.' },
          { status: 400 },
        )
      }
      const channel = CHANNELS.includes(
        body.channel as AiCommunicationDraftValue['channel'],
      )
        ? (body.channel as AiCommunicationDraftValue['channel'])
        : 'internal'
      const draft = await createCommunicationDraft({
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
        title,
        audience:
          typeof body.audience === 'string' ? body.audience : undefined,
        channel,
        subject: typeof body.subject === 'string' ? body.subject : null,
        body: content,
      })
      return NextResponse.json(
        {
          success: true,
          data: draft,
          boundary: 'draft only; no external delivery occurred',
        },
        { status: 201 },
      )
    }

    if (action === 'propose_approval' || action === 'propose_reminder') {
      const draftId =
        typeof body.draftId === 'string' ? body.draftId.trim() : ''
      if (!draftId) {
        return NextResponse.json(
          { success: false, error: 'Draft id is required.' },
          { status: 400 },
        )
      }

      const draftRow = await db.contentRevision.findFirst({
        where: {
          weddingId: access.context.weddingId,
          section: AI_SECTIONS.draft,
          OR: [{ id: draftId }, { fieldKey: draftId }],
        },
      })
      if (!draftRow) {
        return NextResponse.json(
          { success: false, error: 'Communication draft not found.' },
          { status: 404 },
        )
      }
      if (!['draft', 'approved'].includes(draftRow.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Communication cannot enter review from ${draftRow.status}.`,
          },
          { status: 409 },
        )
      }

      const draft = JSON.parse(
        draftRow.value,
      ) as AiCommunicationDraftValue
      if (action === 'propose_reminder' && draft.channel !== 'email') {
        return NextResponse.json(
          {
            success: false,
            error:
              'Only reviewed email drafts can be converted into planner email reminders.',
          },
          { status: 409 },
        )
      }

      const existingProposal = await db.contentRevision.findFirst({
        where: {
          weddingId: access.context.weddingId,
          section: AI_SECTIONS.proposal,
          status: { in: ['proposed', 'approved', 'executing'] },
          value: { contains: draft.draftId },
        },
        select: { id: true, status: true },
      })
      if (existingProposal) {
        return NextResponse.json(
          {
            success: false,
            error: `A review proposal already exists in ${existingProposal.status} state.`,
            proposalId: existingProposal.id,
          },
          { status: 409 },
        )
      }

      const allowedAudiences = ['all', 'pending', 'attending', 'declined']
      const audience =
        typeof body.audience === 'string' &&
        allowedAudiences.includes(body.audience)
          ? body.audience
          : 'pending'
      const scheduledFor =
        typeof body.scheduledFor === 'string' && body.scheduledFor.trim()
          ? body.scheduledFor
          : null
      if (scheduledFor && Number.isNaN(new Date(scheduledFor).getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid reminder schedule.' },
          { status: 400 },
        )
      }

      const proposal = await createActionProposal({
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
        type:
          action === 'propose_reminder'
            ? 'create_reminder'
            : 'approve_communication',
        summary:
          action === 'propose_reminder'
            ? `Convert reviewed draft “${draft.title}” into a planner email reminder.`
            : `Approve communication draft “${draft.title}” for the next controlled step.`,
        payload: {
          draftId: draftRow.id,
          audience,
          scheduledFor,
        },
        preview: {
          draftId: draft.draftId,
          channel: draft.channel,
          audience,
          scheduledFor,
          externalSend: false,
          nextStep:
            action === 'propose_reminder'
              ? 'create one planner reminder; delivery remains separately controlled'
              : 'mark the draft approved only',
        },
      })
      return NextResponse.json({ success: true, data: proposal }, { status: 201 })
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported draft action.' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[AI DRAFTS POST] error:', error)
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to create communication draft.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
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
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Draft id is required.' },
        { status: 400 },
      )
    }

    const existing = await db.contentRevision.findFirst({
      where: {
        id,
        weddingId: access.context.weddingId,
        section: AI_SECTIONS.draft,
      },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Communication draft not found.' },
        { status: 404 },
      )
    }

    const requestedStatus =
      typeof body.status === 'string' ? body.status : undefined
    if (requestedStatus && !KNOWN_STATUSES.has(requestedStatus)) {
      return NextResponse.json(
        { success: false, error: 'Unknown communication status.' },
        { status: 400 },
      )
    }
    if (
      !canDirectlyPatchCommunicationStatus(existing.status, requestedStatus)
    ) {
      return NextResponse.json(
        {
          success: false,
          code: 'CONTROLLED_STATUS_REQUIRED',
          error:
            requestedStatus === 'sent'
              ? 'A communication can be marked sent only by the delivery subsystem with delivery evidence.'
              : 'Approval and delivery states require the controlled action workflow.',
        },
        { status: 409 },
      )
    }

    const hasContentChange =
      typeof body.title === 'string' ||
      typeof body.audience === 'string' ||
      typeof body.channel === 'string' ||
      body.subject === null ||
      typeof body.subject === 'string' ||
      typeof body.body === 'string'
    if (hasContentChange && !communicationContentIsEditable(existing.status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Only draft communications can be edited. Create a new draft version for further changes.',
        },
        { status: 409 },
      )
    }

    const channel = CHANNELS.includes(
      body.channel as AiCommunicationDraftValue['channel'],
    )
      ? (body.channel as AiCommunicationDraftValue['channel'])
      : undefined
    const draft = await updateCommunicationDraft({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      id,
      status: requestedStatus === 'archived' ? 'archived' : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
      audience:
        typeof body.audience === 'string' ? body.audience : undefined,
      channel,
      subject:
        body.subject === null || typeof body.subject === 'string'
          ? (body.subject as string | null)
          : undefined,
      body: typeof body.body === 'string' ? body.body : undefined,
    })
    return NextResponse.json({ success: true, data: draft })
  } catch (error) {
    console.error('[AI DRAFTS PATCH] error:', error)
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to update communication draft.'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
