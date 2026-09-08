import { NextRequest } from 'next/server'
import {
  blockCommunicationParticipant,
  getCommunicationBlockState,
  requireCommunicationActor,
  unblockCommunicationParticipant,
} from '@/lib/communications'
import { enforceCommunicationRateLimit } from '@/lib/communications-rate-limit'
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
    return communicationJson({
      success: true,
      data: await getCommunicationBlockState(actor, id),
    })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCommunicationActor(request)
    await enforceCommunicationRateLimit({ userId: actor.userId, scope: 'channel_mutation' })
    const { id } = await context.params
    return communicationJson({
      success: true,
      data: await blockCommunicationParticipant(actor, id),
    })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireCommunicationActor(request)
    await enforceCommunicationRateLimit({ userId: actor.userId, scope: 'channel_mutation' })
    const { id } = await context.params
    return communicationJson({
      success: true,
      data: await unblockCommunicationParticipant(actor, id),
    })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}
