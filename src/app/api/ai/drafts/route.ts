import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  createActionProposal,
  createCommunicationDraft,
  listCommunicationDrafts,
  updateCommunicationDraft,
  type AiCommunicationDraftValue,
  type AiCommunicationStatus,
} from '@/lib/ai/workspace-store'

const CHANNELS: AiCommunicationDraftValue['channel'][] = [
  'email',
  'whatsapp',
  'sms',
  'internal',
  'speech',
]

const STATUSES: AiCommunicationStatus[] = [
  'draft',
  'approved',
  'ready_to_send',
  'sent',
  'archived',
]

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
      const channel = CHANNELS.includes(body.channel as AiCommunicationDraftValue['channel'])
        ? (body.channel as AiCommunicationDraftValue['channel'])
        : 'internal'
      const draft = await createCommunicationDraft({
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
        title,
        audience: typeof body.audience === 'string' ? body.audience : undefined,
        channel,
        subject: typeof body.subject === 'string' ? body.subject : null,
        body: content,
      })
      return NextResponse.json({ success: true, data: draft }, { status: 201 })
    }

    if (action === 'propose_approval' || action === 'propose_reminder') {
      const draftId = typeof body.draftId === 'string' ? body.draftId.trim() : ''
      if (!draftId) {
        return NextResponse.json(
          { success: false, error: 'Draft id is required.' },
          { status: 400 },
        )
      }
      const proposal = await createActionProposal({
        weddingId: access.context.weddingId,
        authorId: access.context.session.userId,
        type: action === 'propose_reminder' ? 'create_reminder' : 'approve_communication',
        summary:
          action === 'propose_reminder'
            ? 'Convert this reviewed AI draft into an RSVP email reminder.'
            : 'Approve this AI communication draft for the next controlled delivery step.',
        payload: {
          draftId,
          audience:
            typeof body.audience === 'string' ? body.audience : 'pending',
          scheduledFor:
            typeof body.scheduledFor === 'string' ? body.scheduledFor : null,
        },
        preview: {
          draftId,
          externalSend: false,
          nextStep:
            action === 'propose_reminder'
              ? 'create planner reminder; delivery remains separately controlled'
              : 'mark approved only',
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
    const message = error instanceof Error ? error.message : 'Unable to create communication draft.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Draft id is required.' },
        { status: 400 },
      )
    }
    const channel = CHANNELS.includes(body.channel as AiCommunicationDraftValue['channel'])
      ? (body.channel as AiCommunicationDraftValue['channel'])
      : undefined
    const status = STATUSES.includes(body.status as AiCommunicationStatus)
      ? (body.status as AiCommunicationStatus)
      : undefined
    const draft = await updateCommunicationDraft({
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      id,
      status,
      title: typeof body.title === 'string' ? body.title : undefined,
      audience: typeof body.audience === 'string' ? body.audience : undefined,
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
    const message = error instanceof Error ? error.message : 'Unable to update communication draft.'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
