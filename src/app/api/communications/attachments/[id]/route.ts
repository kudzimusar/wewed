import { NextRequest } from 'next/server'
import { requireCommunicationActor } from '@/lib/communications'
import { getCommunicationAttachmentDownload } from '@/lib/communications-attachments'
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
    const data = await getCommunicationAttachmentDownload(actor, id)
    return communicationJson({ success: true, data })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
