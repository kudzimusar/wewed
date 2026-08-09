import { NextRequest } from 'next/server'
import {
  markCommunicationRead,
  requireCommunicationActor,
} from '@/lib/communications'
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
    const result = await markCommunicationRead(actor, id)
    return communicationJson({ success: true, data: result })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
