import { NextRequest } from 'next/server'
import {
  createCommunicationConversation,
  listCommunicationConversations,
  requireCommunicationActor,
} from '@/lib/communications'
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
    const body = await request.json().catch(() => ({}))
    const result = await createCommunicationConversation(actor, body)
    return communicationJson(
      { success: true, data: result },
      { status: result.reused ? 200 : 201 },
    )
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
