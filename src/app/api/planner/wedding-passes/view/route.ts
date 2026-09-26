import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import {
  assertWeddingDayWW2RuntimeReady,
  isWeddingDayWW2Enabled,
} from '@/lib/wedding-day-feature'
import { verifyWeddingPassToken, type CredentialRow } from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

/**
 * Deliberate Couple/Planner "View Wedding Pass" action. Returns the Guest's exact active
 * `WeddingPassCredential.token` — byte-for-byte what the Guest's own Pass and the Gate use — so
 * the administrative QR can never be an "equivalent" re-mint. It never issues: when the Guest has
 * no active credential the caller receives the state instead. Every view is audited without the
 * token, and the response is no-store.
 */
export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.edit')
  if (access.error) return access.error
  const weddingId = access.context.weddingId

  if (!isWeddingDayWW2Enabled()) {
    return noStore({ success: false, code: 'WEDDING_DAY_DISABLED', error: 'Wedding Day is currently disabled.' }, 503)
  }
  try {
    assertWeddingDayWW2RuntimeReady()
  } catch {
    return noStore(
      { success: false, code: 'WEDDING_DAY_KEY_CONFIGURATION_INVALID', error: 'Wedding Day signing configuration is unavailable.' },
      503,
    )
  }

  const body = (await request.json().catch(() => null)) as { guestId?: unknown } | null
  const guestId = typeof body?.guestId === 'string' ? body.guestId.trim() : ''
  if (!guestId) return noStore({ success: false, code: 'GUEST_REQUIRED', error: 'guestId is required.' }, 400)

  const guests = await db.$queryRawUnsafe<Array<{ id: string; name: string; attending: boolean | null }>>(
    `SELECT g.id, g.name, r.attending
       FROM public."Guest" g
       LEFT JOIN public."RSVP" r ON r."guestId" = g.id
      WHERE g.id = $1 AND g."weddingId" = $2
      LIMIT 1`,
    guestId,
    weddingId,
  )
  const guest = guests[0]
  if (!guest) return noStore({ success: false, code: 'GUEST_NOT_FOUND', error: 'Guest not found.' }, 404)

  const credentials = await db.$queryRawUnsafe<CredentialRow[]>(
    `SELECT * FROM public."WeddingPassCredential"
      WHERE "weddingId" = $1
        AND "guestId" = $2
        AND "revokedAt" IS NULL
        AND "supersededAt" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > now())
      ORDER BY "issueSeq" DESC
      LIMIT 1`,
    weddingId,
    guestId,
  )
  const credential = credentials[0]
  if (!credential || guest.attending !== true) {
    return noStore(
      {
        success: false,
        code: 'NO_ACTIVE_WEDDING_PASS',
        error: 'This guest has no active Wedding Pass. None has been issued from this screen.',
      },
      409,
    )
  }

  // Re-verify exactly as the Gate would, so the administrative view never shows a credential the
  // Gate would refuse (inactive signing key, tampered row, ...).
  let verified: CredentialRow
  try {
    verified = await verifyWeddingPassToken({ weddingId, token: credential.token })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PASS_UNAVAILABLE'
    return noStore({ success: false, code, error: code }, 409)
  }

  await db.$executeRawUnsafe(
    `INSERT INTO public."AuditEvent"
      (id, action, "resourceType", "resourceId", "afterValue", "weddingId", "actorId", "createdAt")
     VALUES ($1, 'wedding_pass.viewed', 'WeddingPassCredential', $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
    `audit_${randomUUID().replace(/-/g, '')}`,
    verified.id,
    JSON.stringify({ passSerial: verified.passSerial, issueSeq: verified.issueSeq, guestId }),
    weddingId,
    access.context.session.userId,
  )

  return noStore({
    success: true,
    data: {
      guestId,
      guestName: guest.name,
      passSerial: verified.passSerial,
      tokenVersion: verified.tokenVersion,
      issueSeq: verified.issueSeq,
      issuedAt: verified.issuedAt.toISOString(),
      expiresAt: verified.expiresAt?.toISOString() ?? null,
      token: verified.token,
    },
  })
}
