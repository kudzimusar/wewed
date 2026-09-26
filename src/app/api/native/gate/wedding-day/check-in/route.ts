import { NextRequest } from 'next/server'
import { noStoreJson } from '@/lib/native-domain-context'
import { resolveNativeGateOperationalContext } from '@/lib/native-gate-context'
import {
  assertWeddingDayWW2RuntimeReady,
  isWeddingDayWW2Enabled,
} from '@/lib/wedding-day-feature'
import { checkInWeddingGuest } from '@/lib/wedding-day'
import { previewWriteError } from '@/lib/preview-write-response'

export const dynamic = 'force-dynamic'

interface CheckInRequestBody {
  token?: string
  /** Legacy/serial-only field. Never admission proof; its presence without `token` is refused. */
  passSerial?: string
  attendeeKeys?: string[]
  deviceId?: string
  clientEventId?: string
  items?: CheckInRequestBody[]
}

const CLIENT_ERROR_CODES = new Set([
  'PASS_NOT_FOUND',
  'PASS_REVOKED_OR_EXPIRED',
  'INVALID_PASS_TOKEN',
  'PASS_WEDDING_MISMATCH',
  'PASS_EVENT_NOT_PERMITTED',
  'PASS_SIGNATURE_INVALID',
  'PASS_CREDENTIAL_MISMATCH',
  'PASS_SIGNING_KEY_INACTIVE',
  'PASS_TOKEN_REQUIRED',
  'GATE_INACTIVE_OR_INVALID',
  'GUEST_INELIGIBLE',
])

function hasExactToken(item: CheckInRequestBody): item is CheckInRequestBody & { token: string } {
  return typeof item.token === 'string' && item.token.trim().length > 0
}

function checkInErrorCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error)
  if (CLIENT_ERROR_CODES.has(message)) return message
  if (message.startsWith('INVALID_ATTENDEE_KEY')) return 'INVALID_ATTENDEE_KEY'
  return null
}

export async function POST(request: NextRequest) {
  if (!isWeddingDayWW2Enabled()) {
    return noStoreJson(
      { success: false, code: 'WEDDING_DAY_DISABLED', error: 'Wedding Day is currently disabled.' },
      503,
    )
  }

  try {
    assertWeddingDayWW2RuntimeReady()
  } catch {
    return noStoreJson(
      {
        success: false,
        code: 'WEDDING_DAY_KEY_CONFIGURATION_INVALID',
        error: 'Wedding Day signing configuration is unavailable.',
      },
      503,
    )
  }

  const resolved = await resolveNativeGateOperationalContext(request, {
    requiredCapability: 'gate.checkin.write',
  })
  if (!resolved.ok) return resolved.response

  const { grant } = resolved.context

  // P0-LIVE: the wedding comes only from the server-resolved operational grant. Preview shares the
  // live database, so this write is refused unless Preview is scoped to exactly this wedding.
  const previewBlocked = previewWriteError(grant.weddingId)
  if (previewBlocked) return previewBlocked

  let body: CheckInRequestBody
  try {
    body = await request.json()
  } catch {
    return noStoreJson(
      { success: false, code: 'INVALID_JSON', error: 'Invalid JSON payload.' },
      400,
    )
  }

  const operatorUserId = grant.operatorUserId
  if (!operatorUserId) {
    return noStoreJson(
      { success: false, code: 'GATE_OPERATOR_INVALID', error: 'Gate operator identity is unavailable.' },
      403,
    )
  }

  // Offline-queue reconciliation. Every item must carry the exact scanned WW2 token; the server
  // re-verifies it exactly as for a live scan. Serial-only / count-only items are legacy queue
  // records that never carried proof of the scanned credential: they are reported back as
  // `blockedLegacyIds` and are never admitted. Terminal verification failures are reported
  // separately from transient failures so the device can stop retrying them.
  if (Array.isArray(body) || Array.isArray(body.items)) {
    const list: CheckInRequestBody[] = Array.isArray(body) ? body : body.items!
    const syncedIds: string[] = []
    const failedIds: string[] = []
    const rejected: Array<{ clientEventId: string; code: string }> = []
    const blockedLegacyIds: string[] = []

    for (const item of list) {
      if (!item.attendeeKeys || item.attendeeKeys.length === 0 || !hasExactToken(item)) {
        if (item.clientEventId) blockedLegacyIds.push(item.clientEventId)
        continue
      }
      try {
        await checkInWeddingGuest({
          weddingId: grant.weddingId,
          gateId: grant.gateId,
          operatorUserId,
          token: item.token,
          attendeeKeys: item.attendeeKeys,
          source: 'offline-sync',
          deviceId: item.deviceId,
          clientEventId: item.clientEventId,
        })
        if (item.clientEventId) syncedIds.push(item.clientEventId)
      } catch (error) {
        const code = checkInErrorCode(error)
        if (!item.clientEventId) continue
        if (code) rejected.push({ clientEventId: item.clientEventId, code })
        else failedIds.push(item.clientEventId)
      }
    }

    return noStoreJson({
      success: true,
      syncedIds,
      failedIds,
      rejectedIds: rejected.map((entry) => entry.clientEventId),
      rejected,
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

  if (!hasExactToken(body)) {
    return noStoreJson(
      {
        success: false,
        code: body.passSerial ? 'SERIAL_ONLY_ADMISSION_UNSUPPORTED' : 'PASS_TOKEN_REQUIRED',
        error: 'The exact scanned Wedding Pass credential is required for admission.',
      },
      400,
    )
  }

  try {
    const result = await checkInWeddingGuest({
      weddingId: grant.weddingId,
      gateId: grant.gateId,
      operatorUserId,
      token: body.token,
      attendeeKeys: body.attendeeKeys,
      source: body.clientEventId ? 'offline-sync' : 'qr',
      deviceId: body.deviceId,
      clientEventId: body.clientEventId,
    })

    return noStoreJson({
      success: true,
      ...result,
    })
  } catch (error) {
    const code = checkInErrorCode(error)
    return noStoreJson(
      { success: false, code: code ?? 'CHECKIN_FAILED', error: code ?? 'CHECKIN_FAILED' },
      code ? 400 : 500,
    )
  }
}
