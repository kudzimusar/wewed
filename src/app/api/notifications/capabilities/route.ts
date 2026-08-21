import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import { isTransactionalEmailConfigured } from '@/lib/email/resend'
import { directWebPushConfigured } from '@/lib/notifications/web-push'

interface ChannelRow {
  channel: 'EMAIL' | 'WHATSAPP'
  verified: boolean
  enabled: boolean
}

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
    const rows = await db.$queryRawUnsafe<ChannelRow[]>(
      `
        SELECT wanted.channel,
               EXISTS (
                 SELECT 1
                 FROM wewed_communications."CommunicationEndpoint" endpoint
                 WHERE endpoint."userId" = $1
                   AND endpoint.channel = wanted.channel
                   AND endpoint.status = 'VERIFIED'
               ) AS verified,
               COALESCE((
                 SELECT preference.enabled
                 FROM wewed_communications."CommunicationPreference" preference
                 WHERE preference."userId" = $1
                   AND preference.channel = wanted.channel
                 LIMIT 1
               ), false) AS enabled
        FROM (VALUES ('EMAIL'), ('WHATSAPP')) AS wanted(channel)
      `,
      userId,
    )
    const byChannel = new Map(rows.map((row) => [row.channel, row]))

    const emailTransportConfigured = isTransactionalEmailConfigured()
    const whatsappCloudConfigured = Boolean(
      process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim() &&
      process.env.WHATSAPP_CLOUD_GRAPH_VERSION?.trim(),
    )
    const whatsappActionTemplateConfigured = Boolean(
      whatsappCloudConfigured && process.env.WEWED_WHATSAPP_ACTION_TEMPLATE?.trim(),
    )
    const whatsappLegacyTemplateConfigured = Boolean(
      whatsappCloudConfigured && process.env.WEWED_WHATSAPP_NOTIFICATION_TEMPLATE?.trim(),
    )
    const whatsappTestConfigured = Boolean(
      whatsappCloudConfigured &&
      process.env.WEWED_WHATSAPP_TEST_MODE?.trim().toLowerCase() === 'true' &&
      process.env.WEWED_WHATSAPP_TEST_TEMPLATE?.trim(),
    )
    const whatsappTransportConfigured =
      whatsappActionTemplateConfigured || whatsappLegacyTemplateConfigured || whatsappTestConfigured

    const directPushConfigured = directWebPushConfigured()
    const gatewayPushConfigured = Boolean(
      process.env.WEWED_PUSH_GATEWAY_URL?.trim() &&
      process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim(),
    )
    const pushTransportConfigured = directPushConfigured || gatewayPushConfigured
    const pushMode = directPushConfigured ? 'direct' : gatewayPushConfigured ? 'gateway' : 'none'

    const pushSubscriptions = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `
        SELECT COUNT(*)::bigint AS count
        FROM public."PushSubscription"
        WHERE "userId" = $1
          AND "disabledAt" IS NULL
          AND ("expirationTime" IS NULL OR "expirationTime" > $2)
      `,
      userId,
      BigInt(Date.now()),
    )
    const pushSubscriptionCount = Number(pushSubscriptions[0]?.count ?? 0n)

    const email = byChannel.get('EMAIL')
    const whatsapp = byChannel.get('WHATSAPP')

    return NextResponse.json({
      success: true,
      data: {
        email: {
          transportConfigured: emailTransportConfigured,
          endpointVerified: email?.verified ?? false,
          communicationConsentEnabled: email?.enabled ?? false,
          ready: emailTransportConfigured && Boolean(email?.verified) && Boolean(email?.enabled),
        },
        whatsapp: {
          transportConfigured: whatsappTransportConfigured,
          exactActionLinkConfigured: whatsappActionTemplateConfigured,
          endpointVerified: whatsapp?.verified ?? false,
          communicationConsentEnabled: whatsapp?.enabled ?? false,
          ready: whatsappTransportConfigured && Boolean(whatsapp?.verified) && Boolean(whatsapp?.enabled),
        },
        push: {
          transportConfigured: pushTransportConfigured,
          mode: pushMode,
          activeSubscriptionCount: pushSubscriptionCount,
          ready: pushTransportConfigured && pushSubscriptionCount > 0,
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
