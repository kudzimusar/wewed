import 'server-only'

import { db } from '@/lib/db'
import { isTransactionalEmailConfigured } from '@/lib/email/resend'
import { directWebPushConfigured } from '@/lib/notifications/web-push'

export type ActivatableCommunicationChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'PUSH'

export interface CommunicationChannelActivationState {
  transportConfigured: boolean
  endpointVerified: boolean
  activeEndpointCount: number
  activeDeviceCount: number
  preferenceEnabled: boolean
  canEnable: boolean
  ready: boolean
}

export interface CommunicationChannelActivation {
  EMAIL: CommunicationChannelActivationState
  WHATSAPP: CommunicationChannelActivationState & {
    exactActionLinkConfigured: boolean
  }
  SMS: CommunicationChannelActivationState
  PUSH: CommunicationChannelActivationState & {
    mode: 'direct' | 'gateway' | 'none'
  }
}

interface EndpointCountRow {
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS'
  count: bigint | number
}

interface PreferenceRow {
  channel: ActivatableCommunicationChannel
  enabled: boolean
}

function asCount(value: bigint | number | null | undefined): number {
  if (typeof value === 'bigint') return Number(value)
  return typeof value === 'number' ? value : 0
}

function makeState(input: {
  transportConfigured: boolean
  endpointCount: number
  preferenceEnabled: boolean
  activeDeviceCount?: number
}): CommunicationChannelActivationState {
  const activeDeviceCount = Math.max(0, input.activeDeviceCount ?? 0)
  const endpointVerified = input.endpointCount > 0 || activeDeviceCount > 0
  const canEnable = input.transportConfigured && endpointVerified
  return {
    transportConfigured: input.transportConfigured,
    endpointVerified,
    activeEndpointCount: Math.max(0, input.endpointCount),
    activeDeviceCount,
    preferenceEnabled: input.preferenceEnabled,
    canEnable,
    ready: canEnable && input.preferenceEnabled,
  }
}

export async function getCommunicationChannelActivation(
  userId: string,
): Promise<CommunicationChannelActivation> {
  const [endpointRows, preferenceRows, pushRows] = await Promise.all([
    db.$queryRawUnsafe<EndpointCountRow[]>(
      `
        SELECT channel, COUNT(*)::bigint AS count
        FROM wewed_communications."CommunicationEndpoint"
        WHERE "userId" = $1
          AND channel IN ('EMAIL', 'WHATSAPP', 'SMS')
          AND status = 'VERIFIED'
        GROUP BY channel
      `,
      userId,
    ),
    db.$queryRawUnsafe<PreferenceRow[]>(
      `
        SELECT channel, enabled
        FROM wewed_communications."CommunicationPreference"
        WHERE "userId" = $1
          AND channel IN ('EMAIL', 'WHATSAPP', 'SMS', 'PUSH')
      `,
      userId,
    ),
    db.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `
        SELECT COUNT(*)::bigint AS count
        FROM public."PushSubscription"
        WHERE "userId" = $1
          AND "disabledAt" IS NULL
          AND ("expirationTime" IS NULL OR "expirationTime" > $2)
      `,
      userId,
      BigInt(Date.now()),
    ),
  ])

  const endpointCounts = new Map(endpointRows.map((row) => [row.channel, asCount(row.count)]))
  const preferences = new Map(preferenceRows.map((row) => [row.channel, row.enabled]))
  const pushCount = asCount(pushRows[0]?.count)

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
  const pushMode: 'direct' | 'gateway' | 'none' = directPushConfigured
    ? 'direct'
    : gatewayPushConfigured
      ? 'gateway'
      : 'none'

  const email = makeState({
    transportConfigured: isTransactionalEmailConfigured(),
    endpointCount: endpointCounts.get('EMAIL') ?? 0,
    preferenceEnabled: preferences.get('EMAIL') ?? false,
  })
  const whatsapp = makeState({
    transportConfigured: whatsappTransportConfigured,
    endpointCount: endpointCounts.get('WHATSAPP') ?? 0,
    preferenceEnabled: preferences.get('WHATSAPP') ?? false,
  })
  const sms = makeState({
    transportConfigured: Boolean(process.env.WEWED_SMS_GATEWAY_URL?.trim()),
    endpointCount: endpointCounts.get('SMS') ?? 0,
    preferenceEnabled: preferences.get('SMS') ?? false,
  })
  const push = makeState({
    transportConfigured: pushTransportConfigured,
    endpointCount: 0,
    activeDeviceCount: pushCount,
    preferenceEnabled: preferences.get('PUSH') ?? false,
  })

  return {
    EMAIL: email,
    WHATSAPP: {
      ...whatsapp,
      exactActionLinkConfigured: whatsappActionTemplateConfigured,
    },
    SMS: sms,
    PUSH: {
      ...push,
      mode: pushMode,
    },
  }
}

export function communicationActivationMessage(
  channel: ActivatableCommunicationChannel,
  state: CommunicationChannelActivationState,
): string {
  if (channel === 'PUSH') {
    if (!state.activeDeviceCount) return 'Enable Push on at least one device before using this channel.'
    if (!state.transportConfigured) return 'Wewed Push transport is not configured.'
    return 'Push delivery is not ready.'
  }
  if (!state.endpointVerified) {
    if (channel === 'EMAIL') return 'Verify your Wewed account email before enabling Email delivery.'
    return `Verify a ${channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'} endpoint before enabling this channel.`
  }
  if (!state.transportConfigured) return `Wewed ${channel === 'WHATSAPP' ? 'WhatsApp' : channel} transport is not configured.`
  return `${channel} delivery is not ready.`
}
