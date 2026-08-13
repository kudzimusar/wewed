import { NextRequest } from 'next/server'
import {
  listCommunicationMessages,
  requireCommunicationActor,
  sendCommunicationMessage,
} from '@/lib/communications'
import { normalizeWeddingCommunicationMessages } from '@/lib/wedding-communication-roles'
import {
  enforceCommunicationConversationFanoutLimit,
  enforceCommunicationRateLimit,
} from '@/lib/communications-rate-limit'
import {
  communicationErrorResponse,
  communicationJson,
} from '@/lib/communications-route'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCommunicationActor(request)
    const { id } = await context.params
    const messages = await listCommunicationMessages(actor, id)
    const data = await normalizeWeddingCommunicationMessages(id, messages)
    return communicationJson({ success: true, data })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCommunicationActor(request)
    await enforceCommunicationRateLimit({
      userId: actor.userId,
      scope: 'message_send',
    })
    const { id } = await context.params
    await enforceCommunicationConversationFanoutLimit(actor.userId, id)
    const body = await request.json().catch(() => ({}))
    const result = await sendCommunicationMessage(actor, id, body)
    return communicationJson({ success: true, data: result }, { status: 201 })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
