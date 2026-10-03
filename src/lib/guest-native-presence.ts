import 'server-only'
import { db } from '@/lib/db'

export type GuestNativePlatform = 'android' | 'ios'

export interface GuestNativeClientMetadata {
  platform: GuestNativePlatform
  appVersion: string | null
  buildVersion: string | null
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
