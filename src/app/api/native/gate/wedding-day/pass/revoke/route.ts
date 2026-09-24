import { NextRequest } from 'next/server'
import { noStoreJson } from '@/lib/native-domain-context'
import { resolveNativeGateOperationalContext } from '@/lib/native-gate-context'
import {
  assertWeddingDayWW2RuntimeReady,
  isWeddingDayWW2Enabled,
} from '@/lib/wedding-day-feature'
import { MAX_REVOCATION_REASON_LENGTH, revokeWeddingPassCredential } from '@/lib/wedding-day'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface RevokeRequestBody {
  credentialId?: string
  passSerial?: string
  reason?: string
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
    requiredCapability: 'gate.pass.revoke',
  })
  if (!resolved.ok) return resolved.response

  const { grant } = resolved.context

  let body: RevokeRequestBody
  try {
    body = await request.json()
  } catch {
    return noStoreJson(
      { success: false, code: 'INVALID_JSON', error: 'Invalid JSON payload.' },
      400,
    )
  }

  const reason = (body.reason ?? '').trim()
  if (!reason) {
    return noStoreJson(
      { success: false, code: 'REVOCATION_REASON_REQUIRED', error: 'Revocation reason is required.' },
      400,
    )
  }
  if (reason.length > MAX_REVOCATION_REASON_LENGTH) {
    return noStoreJson(
      {
        success: false,
        code: 'REVOCATION_REASON_TOO_LONG',
        error: `Revocation reason must be ${MAX_REVOCATION_REASON_LENGTH} characters or fewer.`,
      },
      400,
    )
  }

  let credentialId = (body.credentialId ?? '').trim()
  const passSerial = (body.passSerial ?? '').trim()

  if ((!credentialId && !passSerial) || (credentialId && passSerial)) {
    return noStoreJson(
      {
        success: false,
        code: 'CREDENTIAL_SELECTOR_INVALID',
        error: 'Provide exactly one of credentialId or passSerial.',
      },
      400,
    )
  }

  try {
    if (!credentialId && passSerial) {
      const found = await db.weddingPassCredential.findUnique({
        where: {
          weddingId_passSerial: {
            weddingId: grant.weddingId,
            passSerial,
          },
        },
        select: { id: true },
      })
      if (!found) {
        return noStoreJson(
          { success: false, code: 'PASS_NOT_FOUND', error: 'Wedding pass not found.' },
          404,
        )
      }
      credentialId = found.id
    }

    const revoked = await revokeWeddingPassCredential({
      weddingId: grant.weddingId,
      credentialId,
      reason,
      actorUserId: grant.operatorUserId,
      gateId: grant.gateId,
    })

    return noStoreJson({
      success: true,
      data: {
        credentialId: revoked.id,
        passSerial: revoked.passSerial,
        revokedAt: revoked.revokedAt,
        revocationReason: revoked.revocationReason,
      },
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'PASS_NOT_FOUND') {
      return noStoreJson(
        { success: false, code, error: 'Wedding pass not found.' },
        404,
      )
    }
    if (code === 'REVOCATION_REASON_REQUIRED' || code === 'REVOCATION_REASON_TOO_LONG') {
      return noStoreJson(
        { success: false, code, error: 'The revocation reason is invalid.' },
        400,
      )
    }
    return noStoreJson(
      { success: false, code: 'REVOCATION_FAILED', error: 'Unable to revoke the wedding pass.' },
      500,
    )
  }
}
