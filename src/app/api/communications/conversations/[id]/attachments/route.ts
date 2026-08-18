import { NextRequest } from 'next/server'
import { requireCommunicationActor } from '@/lib/communications'
import { sendCommunicationAttachments } from '@/lib/communications-attachments'
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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCommunicationActor(request)
    const { id } = await context.params
    await enforceCommunicationRateLimit({
      userId: actor.userId,
      scope: 'message_send',
    })
    await enforceCommunicationConversationFanoutLimit(actor.userId, id)

    const form = await request.formData()
    const files = form.getAll('files').filter((value): value is File => value instanceof File)
    const captions = form.getAll('captions').map((value) => typeof value === 'string' ? value : '')
    const body = form.get('body')
    const internalNote = form.get('internalNote') === 'true'

    const result = await sendCommunicationAttachments({
      actor,
      conversationId: id,
      files,
      body,
      internalNote,
      captions,
    })
    return communicationJson({ success: true, data: result }, { status: 201 })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
