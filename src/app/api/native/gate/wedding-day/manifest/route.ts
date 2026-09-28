import { NextRequest } from 'next/server'
import { noStoreJson } from '@/lib/native-domain-context'
import { resolveNativeGateOperationalContext } from '@/lib/native-gate-context'
import {
  assertWeddingDayWW2RuntimeReady,
  isWeddingDayWW2Enabled,
} from '@/lib/wedding-day-feature'
import { signedNativeWeddingDayManifest } from '@/lib/wedding-day-manifest'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
    requiredCapability: 'gate.manifest.read',
  })
  if (!resolved.ok) return resolved.response

  const { grant } = resolved.context

  try {
    const manifest = await signedNativeWeddingDayManifest(grant.weddingId)
    return noStoreJson({
      success: true,
      data: manifest,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return noStoreJson(
      { success: false, code: 'MANIFEST_GENERATION_FAILED', error: message },
      500,
    )
  }
}
