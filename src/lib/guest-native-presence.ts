import 'server-only'
import { db } from '@/lib/db'

export type GuestNativePlatform = 'android' | 'ios'

export interface GuestNativeClientMetadata {
  platform: GuestNativePlatform
  appVersion: string | null
  buildVersion: string | null
}

const NATIVE_RUNTIME: Record<GuestNativePlatform, string> = {
  android: 'android-httpurlconnection',
  ios: 'ios-urlsession',
}

const NATIVE_USER_AGENT_PREFIX: Record<GuestNativePlatform, string> = {
  android: 'Wewed-Android/',
  ios: 'Wewed-iOS/',
}

function hasBrowserFetchMetadata(headers: Headers): boolean {
  // Fetch Metadata headers are browser-controlled forbidden request headers. A web page/PWA cannot
  // suppress them while forging Wewed's native marker headers, whereas the native URL transports
  // used by Wewed do not emit them. This is deliberately a telemetry boundary, not an admission or
  // authentication credential: Guest identity is still resolved independently before this runs.
  return ['sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-user']
    .some((name) => headers.has(name))
}

function boundedHeader(headers: Headers, name: string, maxLength = 64): string | null {
  const value = headers.get(name)?.trim()
  if (!value) return null
  return value.slice(0, maxLength)
}

export function nativeGuestClientFromHeaders(
  headers: Headers,
): GuestNativeClientMetadata | null {
  if (headers.get('x-wewed-client')?.trim().toLowerCase() !== 'native') return null
  const rawPlatform = headers.get('x-wewed-native-platform')?.trim().toLowerCase()
  if (rawPlatform !== 'android' && rawPlatform !== 'ios') return null

  // Do not let ordinary browser/PWA activity become "native activation" merely by copying Wewed's
  // custom headers. Browsers own User-Agent and Sec-Fetch-*; page JavaScript cannot override the
  // former or suppress the latter. Wewed's native transports set both the runtime marker and the
  // native-only User-Agent explicitly.
  if (hasBrowserFetchMetadata(headers)) return null
  if (headers.get('x-wewed-native-runtime')?.trim().toLowerCase() !== NATIVE_RUNTIME[rawPlatform]) {
    return null
  }
  const userAgent = headers.get('user-agent')?.trim() ?? ''
  if (!userAgent.startsWith(NATIVE_USER_AGENT_PREFIX[rawPlatform])) return null

  return {
    platform: rawPlatform,
    appVersion: boundedHeader(headers, 'x-wewed-app-version'),
    buildVersion: boundedHeader(headers, 'x-wewed-build-version'),
  }
}

export async function recordGuestNativePresence(input: {
  headers: Headers
  weddingId: string
  guestId: string
  invitationOpened?: boolean
  now?: Date
}) {
  const client = nativeGuestClientFromHeaders(input.headers)
  if (!client) return null

  const now = input.now ?? new Date()
  return db.guestNativePresence.upsert({
    where: {
      weddingId_guestId_platform: {
        weddingId: input.weddingId,
        guestId: input.guestId,
        platform: client.platform,
      },
    },
    create: {
      weddingId: input.weddingId,
      guestId: input.guestId,
      platform: client.platform,
      appVersion: client.appVersion,
      buildVersion: client.buildVersion,
      firstActivatedAt: now,
      lastSeenAt: now,
      lastInvitationOpenAt: input.invitationOpened ? now : null,
      // Deliberately absent: no hardware/ad identifier is collected.
      appInstanceHash: null,
    },
    update: {
      appVersion: client.appVersion,
      buildVersion: client.buildVersion,
      lastSeenAt: now,
      ...(input.invitationOpened ? { lastInvitationOpenAt: now } : {}),
    },
  })
}
