import { NextRequest } from 'next/server'
import {
  listCommunicationContacts,
  requireCommunicationActor,
} from '@/lib/communications'
import {
  communicationErrorResponse,
  communicationJson,
} from '@/lib/communications-route'

export async function GET(request: NextRequest) {
  try {
    const actor = await requireCommunicationActor(request)
    const contacts = await listCommunicationContacts(actor)
    return communicationJson({ success: true, data: contacts })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
