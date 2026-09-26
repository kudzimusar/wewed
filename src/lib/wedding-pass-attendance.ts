import { randomUUID } from 'node:crypto'
import type { db } from '@/lib/db'
import { ATTENDANCE_WITHDRAWN_REASON } from '@/lib/wedding-pass-availability'

/**
 * RSVP ↔ Wedding Pass lifecycle — attendance withdrawal. Re-exported by `@/lib/wedding-day`, the
 * Wedding Pass authority; kept free of `server-only`/Next imports so every RSVP writer (Guest
 * self-service `applyGuestRsvpUpdate` and the Planner worksheet import) shares this one
 * implementation.
 */

export { ATTENDANCE_WITHDRAWN_REASON }

/**
 * Must run inside the caller's RSVP-write transaction, after the caller has locked the Guest row
 * and then the RSVP row (the same Guest → RSVP → credential lock order used by issuance and
 * check-in). Every live credential for the Guest is revoked and superseded, so a token issued
 * while attending can never become valid again merely because the Guest later re-accepts:
 * re-acceptance plus the next authorized Pass retrieval issues a fresh credential (new issueSeq,
 * serial, nonce and token).
 *
 * Deliberately not gated on the WW2 feature flag: when Wedding Day is disabled no credential can
 * exist, so this is a no-op, and when it is enabled withdrawal must never be skipped.
 */
export async function withdrawWeddingPassesForAttendance(
  tx: Pick<typeof db, '$queryRawUnsafe' | '$executeRawUnsafe'>,
  input: { weddingId: string; guestId: string; now?: Date },
): Promise<string[]> {
  const now = input.now ?? new Date()
  const withdrawn = await tx.$queryRawUnsafe<Array<{ id: string; passSerial: string }>>(
    `UPDATE public."WeddingPassCredential"
        SET "revokedAt" = $1,
            "revocationReason" = $2,
            "supersededAt" = COALESCE("supersededAt", $1),
            "updatedAt" = $1
      WHERE "weddingId" = $3
        AND "guestId" = $4
        AND "revokedAt" IS NULL
      RETURNING id, "passSerial"`,
    now,
    ATTENDANCE_WITHDRAWN_REASON,
    input.weddingId,
    input.guestId,
  )
  for (const credential of withdrawn) {
    await tx.$executeRawUnsafe(
      `INSERT INTO public."AuditEvent"
        (id, action, "resourceType", "resourceId", "afterValue", "weddingId", "createdAt")
       VALUES ($1, 'wedding_pass.revoked', 'WeddingPassCredential', $2, $3, $4, CURRENT_TIMESTAMP)`,
      `audit_${randomUUID().replace(/-/g, '')}`,
      credential.id,
      JSON.stringify({
        passSerial: credential.passSerial,
        revokedAt: now.toISOString(),
        revocationReason: ATTENDANCE_WITHDRAWN_REASON,
      }),
      input.weddingId,
    )
  }
  return withdrawn.map((credential) => credential.id)
}
