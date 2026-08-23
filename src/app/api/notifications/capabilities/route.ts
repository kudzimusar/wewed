import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { getCommunicationChannelActivation } from '@/lib/communication-channel-activation'

function principalUserId(request: NextRequest) {
  const session = readAppSession(request)
  return session?.effectiveUserId ?? session?.userId ?? null
}

export async function GET(request: NextRequest) {
  const userId = principalUserId(request)
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const activation = await getCommunicationChannelActivation(userId)
    return NextResponse.json({
      success: true,
      data: {
        email: {
          transportConfigured: activation.EMAIL.transportConfigured,
          endpointVerified: activation.EMAIL.endpointVerified,
          communicationConsentEnabled: activation.EMAIL.preferenceEnabled,
          ready: activation.EMAIL.ready,
        },
        whatsapp: {
          transportConfigured: activation.WHATSAPP.transportConfigured,
          exactActionLinkConfigured: activation.WHATSAPP.exactActionLinkConfigured,
          endpointVerified: activation.WHATSAPP.endpointVerified,
          communicationConsentEnabled: activation.WHATSAPP.preferenceEnabled,
          ready: activation.WHATSAPP.ready,
        },
        push: {
          transportConfigured: activation.PUSH.transportConfigured,
          mode: activation.PUSH.mode,
          activeSubscriptionCount: activation.PUSH.activeDeviceCount,
          ready: activation.PUSH.canEnable,
        },
      },
    })
  } catch (error) {
    console.error('[notification capabilities GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to determine notification channel readiness.' },
      { status: 500 },
    )
  }
}
