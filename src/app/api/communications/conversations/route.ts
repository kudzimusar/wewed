import { NextRequest } from 'next/server'
import {
  createCommunicationConversation,
  listCommunicationConversations,
  requireCommunicationActor,
  sendCommunicationMessage,
} from '@/lib/communications'
import { enforceCommunicationRateLimit } from '@/lib/communications-rate-limit'
import {
  communicationErrorResponse,
  communicationJson,
} from '@/lib/communications-route'

export async function GET(request: NextRequest) {
  try {
    const actor = await requireCommunicationActor(request)
    const conversations = await listCommunicationConversations(actor)
    return communicationJson({ success: true, data: conversations })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireCommunicationActor(request)
    await enforceCommunicationRateLimit({
      userId: actor.userId,
      scope: 'conversation_create',
    })
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const initialMessage = typeof body.initialMessage === 'string' && body.initialMessage.trim()
      ? body.initialMessage
      : null

    if (initialMessage) {
      await enforceCommunicationRateLimit({ userId: actor.userId, scope: 'message_send' })
      const participantCost = Array.isArray(body.participantIds)
        ? Math.max(1, body.participantIds.length)
        : 1
      await enforceCommunicationRateLimit({
        userId: actor.userId,
        scope: 'recipient_fanout',
        cost: participantCost,
      })
    }

    const result = await createCommunicationConversation(actor, body)
    if (result.reused && initialMessage) {
      await sendCommunicationMessage(actor, result.id, { body: initialMessage })
    }

    return communicationJson(
      { success: true, data: result },
      { status: result.reused ? 200 : 201 },
    )
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
