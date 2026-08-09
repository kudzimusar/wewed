import { NextRequest } from 'next/server'
import {
  disableCommunicationEndpoint,
  listCommunicationChannelSettings,
  registerCommunicationEndpoint,
  setCommunicationPreference,
} from '@/lib/communication-channels'
import { requireCommunicationActor } from '@/lib/communications'
import { enforceCommunicationRateLimit } from '@/lib/communications-rate-limit'
import {
  communicationErrorResponse,
  communicationJson,
} from '@/lib/communications-route'

export async function GET(request: NextRequest) {
  try {
    const actor = await requireCommunicationActor(request)
    const settings = await listCommunicationChannelSettings(actor)
    return communicationJson({ success: true, data: settings })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireCommunicationActor(request)
    await enforceCommunicationRateLimit({ userId: actor.userId, scope: 'channel_mutation' })
    const body = await request.json().catch(() => ({}))
    const result = await registerCommunicationEndpoint(actor, body)
    return communicationJson({ success: true, data: result }, { status: 201 })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireCommunicationActor(request)
    await enforceCommunicationRateLimit({ userId: actor.userId, scope: 'channel_mutation' })
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    if (body.action === 'preference') {
      const result = await setCommunicationPreference(actor, {
        channel: body.channel,
        enabled: body.enabled,
      })
      return communicationJson({ success: true, data: result })
    }
    if (body.action === 'disable' && typeof body.endpointId === 'string') {
      const result = await disableCommunicationEndpoint(actor, body.endpointId)
      return communicationJson({ success: true, data: result })
    }
    return communicationJson(
      { success: false, error: 'Unsupported channel action.' },
      { status: 400 },
    )
  } catch (error) {
    return communicationErrorResponse(error)
  }
}