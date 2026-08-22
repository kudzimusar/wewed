import { NextRequest } from 'next/server'
import {
  communicationActivationMessage,
  getCommunicationChannelActivation,
  type ActivatableCommunicationChannel,
} from '@/lib/communication-channel-activation'
import {
  disableCommunicationEndpoint,
  listCommunicationChannelSettings,
  registerCommunicationEndpoint,
  setCommunicationPreference,
} from '@/lib/communication-channels'
import { CommunicationError, requireCommunicationActor } from '@/lib/communications'
import { enforceCommunicationRateLimit } from '@/lib/communications-rate-limit'
import {
  communicationErrorResponse,
  communicationJson,
} from '@/lib/communications-route'

function requestedChannel(value: unknown): ActivatableCommunicationChannel | null {
  return value === 'EMAIL' || value === 'WHATSAPP' || value === 'SMS' || value === 'PUSH'
    ? value
    : null
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireCommunicationActor(request)
    const [settings, activation] = await Promise.all([
      listCommunicationChannelSettings(actor),
      getCommunicationChannelActivation(actor.userId),
    ])
    return communicationJson({
      success: true,
      data: {
        ...settings,
        accountEmail: actor.email,
        activation,
      },
    })
  } catch (error) {
    return communicationErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireCommunicationActor(request)
    await enforceCommunicationRateLimit({ userId: actor.userId, scope: 'channel_mutation' })
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const channel = requestedChannel(body.channel)
    if (channel === 'EMAIL') {
      throw new CommunicationError(
        'Email delivery uses your Wewed account email. Use Verify account email instead of adding an email endpoint manually.',
        409,
      )
    }
    if (channel === 'PUSH') {
      throw new CommunicationError(
        'Push is device-based. Manage Push devices from Notification settings instead of entering a Push endpoint manually.',
        409,
      )
    }
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
      const channel = requestedChannel(body.channel)
      if (!channel) throw new CommunicationError('Unsupported communication channel.')
      if (typeof body.enabled !== 'boolean') throw new CommunicationError('Preference must be enabled or disabled.')
      if (body.enabled) {
        const activation = await getCommunicationChannelActivation(actor.userId)
        const state = activation[channel]
        if (!state.canEnable) {
          throw new CommunicationError(communicationActivationMessage(channel, state), 409)
        }
      }
      const result = await setCommunicationPreference(actor, {
        channel,
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
