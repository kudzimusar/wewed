import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import {
  communicationActivationMessage,
  getCommunicationChannelActivation,
} from '@/lib/communication-channel-activation'
import {
  getNotificationPreferences,
  notificationPreferenceInputSchema,
  saveNotificationPreferences,
} from '@/lib/notifications/preferences'

function serializePreference(preference: Awaited<ReturnType<typeof getNotificationPreferences>>) {
  return {
    ...preference,
    createdAt: preference.createdAt.toISOString(),
    updatedAt: preference.updatedAt.toISOString(),
  }
}

function principalUserId(session: NonNullable<ReturnType<typeof readAppSession>>): string {
  return session.effectiveUserId ?? session.userId
}

export async function GET(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const scopeKey = request.nextUrl.searchParams.get('scopeKey')?.trim() || 'global'
    const preference = await getNotificationPreferences(session, scopeKey)
    return NextResponse.json({ success: true, data: serializePreference(preference) })
  } catch (error) {
    console.error('[notification preferences GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to load notification preferences.' },
      { status: 400 },
    )
  }
}

export async function PUT(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const input = notificationPreferenceInputSchema.parse(await request.json())
    const activation = await getCommunicationChannelActivation(principalUserId(session))

    if (input.pushEnabled && !activation.PUSH.canEnable) {
      return NextResponse.json(
        { success: false, error: communicationActivationMessage('PUSH', activation.PUSH) },
        { status: 409 },
      )
    }
    if (input.emailEnabled && !activation.EMAIL.ready) {
      const reason = activation.EMAIL.canEnable && !activation.EMAIL.preferenceEnabled
        ? 'Allow Email delivery after verifying your account email, then enable Email notifications.'
        : communicationActivationMessage('EMAIL', activation.EMAIL)
      return NextResponse.json({ success: false, error: reason }, { status: 409 })
    }
    if (input.whatsAppEnabled && !activation.WHATSAPP.ready) {
      const reason = activation.WHATSAPP.canEnable && !activation.WHATSAPP.preferenceEnabled
        ? 'Allow WhatsApp delivery before enabling WhatsApp notifications.'
        : communicationActivationMessage('WHATSAPP', activation.WHATSAPP)
      return NextResponse.json({ success: false, error: reason }, { status: 409 })
    }

    const preference = await saveNotificationPreferences(session, input)
    return NextResponse.json({ success: true, data: serializePreference(preference) })
  } catch (error) {
    console.error('[notification preferences PUT] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to save notification preferences.' },
      { status: 400 },
    )
  }
}
