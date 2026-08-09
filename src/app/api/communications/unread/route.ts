import { NextRequest } from 'next/server'
import {
  getCommunicationUnread,
  requireCommunicationActor,
} from '@/lib/communications'
import {
  communicationErrorResponse,
  communicationJson,
} from '@/lib/communications-route'

export async function GET(request: NextRequest) {
  try {
    const actor = await requireCommunicationActor(request)
    const unread = await getCommunicationUnread(actor)
    return communicationJson({ success: true, data: unread })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
