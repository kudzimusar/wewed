import { NextRequest } from 'next/server'
import { noStoreJson } from '@/lib/native-domain-context'
import { resolveNativeGateOperationalContext } from '@/lib/native-gate-context'
import { isWeddingDayWW2Enabled } from '@/lib/wedding-day-feature'
import { checkInWeddingGuest } from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

interface CheckInRequestBody {
  token?: string
  passSerial?: string
  attendeeKeys?: string[]
  source?: string
  deviceId?: string
  clientEventId?: string
  items?: CheckInRequestBody[]
}

export async function POST(request: NextRequest) {
  if (!isWeddingDayWW2Enabled()) {
    return noStoreJson(
      { success: false, code: 'WEDDING_DAY_DISABLED', error: 'Wedding Day is currently disabled.' },
      503,
    )
  }

  const resolved = await resolveNativeGateOperationalContext(request, {
    requiredCapability: 'gate.checkin.write',
  })
  if (!resolved.ok) return resolved.response

  const { grant, authority } = resolved.context

  let body: CheckInRequestBody
  try {
    body = await request.json()
  } catch {
    return noStoreJson(
      { success: false, code: 'INVALID_JSON', error: 'Invalid JSON payload.' },
      400,
    )
  }

  const operatorUserId = grant.operatorUserId || authority.identity?.accessUserId || ''

  // Handle batch array/items payload if present
  if (Array.isArray(body) || Array.isArray(body.items)) {
    const list: CheckInRequestBody[] = Array.isArray(body) ? body : body.items!
    const syncedIds: string[] = []
    const failedIds: string[] = []
    const blockedLegacyIds: string[] = []

    for (const item of list) {
      if (!item.attendeeKeys || item.attendeeKeys.length === 0) {
        if (item.clientEventId) blockedLegacyIds.push(item.clientEventId)
        continue
      }
      try {
        await checkInWeddingGuest({
          weddingId: grant.weddingId,
          gateId: grant.gateId,
          operatorUserId,
          token: item.token,
          passSerial: item.passSerial,
          attendeeKeys: item.attendeeKeys,
          source: item.source ?? 'offline-sync',
          deviceId: item.deviceId,
          clientEventId: item.clientEventId,
        })
        if (item.clientEventId) syncedIds.push(item.clientEventId)
      } catch {
        if (item.clientEventId) failedIds.push(item.clientEventId)
      }
    }

    return noStoreJson({
      success: true,
      syncedIds,
      failedIds,
      blockedLegacyIds,
    })
  }

  // Single check-in
  if (!body.attendeeKeys || !Array.isArray(body.attendeeKeys) || body.attendeeKeys.length === 0) {
    return noStoreJson(
      { success: false, code: 'ATTENDEE_KEYS_REQUIRED', error: 'Attendee keys are required for check-in.' },
      400,
    )
  }

  if (!body.token && !body.passSerial) {
    return noStoreJson(
      { success: false, code: 'TOKEN_OR_SERIAL_REQUIRED', error: 'Pass token or pass serial is required.' },
      400,
    )
  }

  try {
    const result = await checkInWeddingGuest({
      weddingId: grant.weddingId,
      gateId: grant.gateId,
      operatorUserId,
      token: body.token,
      passSerial: body.passSerial,
      attendeeKeys: body.attendeeKeys,
      source: body.source ?? (body.token ? 'qr' : 'offline-sync'),
      deviceId: body.deviceId,
      clientEventId: body.clientEventId,
    })

    return noStoreJson({
      success: true,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isClientError =
      message === 'PASS_NOT_FOUND' ||
      message === 'PASS_REVOKED_OR_EXPIRED' ||
      message === 'INVALID_PASS_TOKEN' ||
      message === 'PASS_WEDDING_MISMATCH' ||
      message === 'PASS_EVENT_NOT_PERMITTED' ||
      message === 'PASS_SIGNATURE_INVALID' ||
      message === 'GUEST_INELIGIBLE' ||
      message.startsWith('INVALID_ATTENDEE_KEY')
    const status = isClientError ? 400 : 500
    return noStoreJson(
      { success: false, code: isClientError ? message : 'CHECKIN_FAILED', error: message },
      status,
    )
  }
}
