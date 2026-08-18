import { NextRequest } from 'next/server'
import { requireCommunicationActor } from '@/lib/communications'
import { authorizeCommunicationAttachmentPromotion } from '@/lib/communications-attachment-authorization'
import { promoteCommunicationAttachment } from '@/lib/communications-attachments'
import {
  enforceCommunicationRateLimit,
} from '@/lib/communications-rate-limit'
import {
  communicationErrorResponse,
  communicationJson,
} from '@/lib/communications-route'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCommunicationActor(request)
    await enforceCommunicationRateLimit({ userId: actor.userId, scope: 'channel_mutation' })
    const { id } = await context.params
    await authorizeCommunicationAttachmentPromotion({ request, actor, attachmentId: id })

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const entityType = typeof body.entityType === 'string' ? body.entityType.trim() : ''
    const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : ''
    const linkRole = typeof body.linkRole === 'string' ? body.linkRole.trim() : ''
    if (!entityType || !entityId || !linkRole) {
      return communicationJson(
        { success: false, error: 'Promotion target and role are required.' },
        { status: 400 },
      )
    }
    await promoteCommunicationAttachment({ actor, attachmentId: id, entityType, entityId, linkRole })
    return communicationJson({ success: true })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
