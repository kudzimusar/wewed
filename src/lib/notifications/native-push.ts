import 'server-only'
import { db } from '@/lib/db'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const MAX_NATIVE_DEVICES_PER_USER = 50

interface NativePushDeviceRow {
  id: string
  expoPushToken: string
  platform: 'android' | 'ios'
}

interface ExpoPushTicket {
  status?: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

export interface NativePushDeliveryResult {
  configured: boolean
  attempted: number
  sent: number
  providerRefs: string[]
  retriableFailure: boolean
  permanentFailure: boolean
}

async function activeNativeDevices(userId: string): Promise<NativePushDeviceRow[]> {
  try {
    return await db.$queryRawUnsafe<NativePushDeviceRow[]>(
      `SELECT id, "expoPushToken", platform
         FROM public."NativePushDevice"
        WHERE "userId" = $1 AND enabled = TRUE
        ORDER BY "lastSeenAt" DESC
        LIMIT $2`,
      userId,
      MAX_NATIVE_DEVICES_PER_USER,
    )
  } catch (error) {
    const code = (error as { code?: string }).code
    const message = error instanceof Error ? error.message : ''
    if (code === 'P2010' || message.includes('NativePushDevice')) {
      return []
    }
    throw error
  }
}

async function disableNativeDevice(id: string) {
  await db.$executeRawUnsafe(
    `UPDATE public."NativePushDevice"
        SET enabled = FALSE, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1`,
    id,
  )
}

export async function sendNativePushForUser(input: {
  userId: string
  notificationId: string
  deliveryAttemptId: string
  title: string
  body: string
  url: string
}): Promise<NativePushDeliveryResult> {
  const devices = await activeNativeDevices(input.userId)
  if (devices.length === 0) {
    return { configured: false, attempted: 0, sent: 0, providerRefs: [], retriableFailure: false, permanentFailure: false }
  }

  const messages = devices.map((device) => ({
    to: device.expoPushToken,
    title: input.title.slice(0, 120),
    body: input.body.slice(0, 240),
    priority: 'high' as const,
    channelId: device.platform === 'android' ? 'wewed-important' : undefined,
    data: {
      url: input.url,
      notificationId: input.notificationId,
      deliveryAttemptId: input.deliveryAttemptId,
    },
  }))

  let response: Response
  try {
    response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return { configured: true, attempted: devices.length, sent: 0, providerRefs: [], retriableFailure: true, permanentFailure: false }
  }

  if (!response.ok) {
    const retriable = [408, 409, 425, 429].includes(response.status) || response.status >= 500
    return {
      configured: true,
      attempted: devices.length,
      sent: 0,
      providerRefs: [],
      retriableFailure: retriable,
      permanentFailure: !retriable,
    }
  }

  const payload = await response.json().catch(() => null) as { data?: ExpoPushTicket[] | ExpoPushTicket } | null
  const rawTickets = payload?.data
  const tickets = Array.isArray(rawTickets) ? rawTickets : rawTickets ? [rawTickets] : []
  let sent = 0
  let retriableFailure = false
  let permanentFailure = false
  const providerRefs: string[] = []

  for (let index = 0; index < devices.length; index += 1) {
    const device = devices[index]
    const ticket = tickets[index]
    if (!device) continue
    if (ticket?.status === 'ok') {
      sent += 1
      if (ticket.id) providerRefs.push(ticket.id)
      continue
    }
    const errorCode = ticket?.details?.error
    if (errorCode === 'DeviceNotRegistered') {
      await disableNativeDevice(device.id)
      continue
    }
    if (errorCode === 'MessageRateExceeded' || errorCode === 'ExpoError') {
      retriableFailure = true
      continue
    }
    if (ticket?.status === 'error') permanentFailure = true
    else retriableFailure = true
  }

  return {
    configured: true,
    attempted: devices.length,
    sent,
    providerRefs,
    retriableFailure,
    permanentFailure,
  }
}
