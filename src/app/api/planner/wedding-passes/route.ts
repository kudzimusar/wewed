import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { isWeddingDayWW2Enabled } from '@/lib/wedding-day-feature'
import { weddingPassIssuanceWindow } from '@/lib/wedding-day'
import {
  resolveWeddingArrivalState,
  resolveWeddingPassCredentialAdminState,
  weddingHouseholdAttendeeKeys,
} from '@/lib/wedding-pass-availability'

export const dynamic = 'force-dynamic'

interface GuestPassRow {
  guestId: string
  name: string
  tableNumber: number | null
  tableName: string | null
  attending: boolean | null
  plusOne: boolean | null
  plusOneName: string | null
  kidsAttending: boolean | null
  kidsCount: number | null
  credentialId: string | null
  passSerial: string | null
  tokenVersion: string | null
  issueSeq: number | null
  issuedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
  revocationReason: string | null
  supersededAt: Date | null
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

/**
 * Couple/Planner Wedding Pass metadata. Read-only by construction: it never issues a credential
 * and never selects token, nonce or signature material, so opening the Guest list cannot mint
 * hundreds of bearer credentials or leak one. The exact credential is only rendered through the
 * separate, audited `POST /api/planner/wedding-passes/view` action.
 */
export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return access.error
  const weddingId = access.context.weddingId

  const weddings = await db.$queryRawUnsafe<Array<{ date: Date }>>(
    `SELECT date FROM public."Wedding" WHERE id = $1 LIMIT 1`,
    weddingId,
  )
  const wedding = weddings[0]
  if (!wedding) return noStore({ success: false, error: 'Wedding not found.' }, 404)

  const [rows, checkIns] = await Promise.all([
    db.$queryRawUnsafe<GuestPassRow[]>(
      `SELECT g.id AS "guestId", g.name, g."tableNumber", st.name AS "tableName",
              r.attending, r."plusOne", r."plusOneName", r."kidsAttending", r."kidsCount",
              c.id AS "credentialId", c."passSerial", c."tokenVersion", c."issueSeq",
              c."issuedAt", c."expiresAt", c."revokedAt", c."revocationReason", c."supersededAt"
         FROM public."Guest" g
         LEFT JOIN public."RSVP" r ON r."guestId" = g.id
         LEFT JOIN public."SeatingTable" st ON st.id = g."seatingTableId"
         LEFT JOIN LATERAL (
           SELECT id, "passSerial", "tokenVersion", "issueSeq", "issuedAt", "expiresAt",
                  "revokedAt", "revocationReason", "supersededAt"
             FROM public."WeddingPassCredential"
            WHERE "weddingId" = g."weddingId" AND "guestId" = g.id
            ORDER BY "issueSeq" DESC
            LIMIT 1
         ) c ON TRUE
        WHERE g."weddingId" = $1
        ORDER BY g.name ASC, g.id ASC`,
      weddingId,
    ),
    db.$queryRawUnsafe<Array<{ guestId: string; attendeeKey: string }>>(
      `SELECT "guestId", "attendeeKey"
         FROM public."WeddingCheckIn"
        WHERE "weddingId" = $1 AND "eventKey" = 'wedding-day'`,
      weddingId,
    ),
  ])

  const admittedByGuest = new Map<string, Set<string>>()
  for (const checkIn of checkIns) {
    const keys = admittedByGuest.get(checkIn.guestId) ?? new Set<string>()
    keys.add(checkIn.attendeeKey)
    admittedByGuest.set(checkIn.guestId, keys)
  }

  const now = new Date()
  const window = weddingPassIssuanceWindow(wedding.date)
  const guests = rows.map((row) => {
    const household = weddingHouseholdAttendeeKeys(row)
    const admitted = admittedByGuest.get(row.guestId) ?? new Set<string>()
    const admittedAttendeeKeys = household.filter((key) => admitted.has(key))
    const credentialState = resolveWeddingPassCredentialAdminState({
      attending: row.attending,
      weddingDate: wedding.date,
      latest: row.credentialId
        ? {
            revokedAt: row.revokedAt,
            revocationReason: row.revocationReason,
            supersededAt: row.supersededAt,
            expiresAt: row.expiresAt,
          }
        : null,
      now,
    })
    const arrivalState = resolveWeddingArrivalState({
      householdSize: household.length,
      admittedCount: admittedAttendeeKeys.length,
    })
    return {
      guestId: row.guestId,
      name: row.name,
      // Two independent dimensions; never one compressed status (QRO 01 §19).
      credentialState,
      arrivalState,
      party: {
        size: household.length,
        attendeeKeys: household,
        plusOneName: row.plusOne ? row.plusOneName : null,
      },
      table: { number: row.tableNumber, name: row.tableName },
      checkIn: { admittedCount: admittedAttendeeKeys.length, admittedAttendeeKeys },
      credential: row.credentialId
        ? {
            passSerial: row.passSerial,
            tokenVersion: row.tokenVersion,
            issueSeq: row.issueSeq,
            issuedAt: row.issuedAt?.toISOString() ?? null,
            expiresAt: row.expiresAt?.toISOString() ?? null,
            revokedAt: row.revokedAt?.toISOString() ?? null,
            revocationReason: row.revocationReason,
            supersededAt: row.supersededAt?.toISOString() ?? null,
          }
        : null,
    }
  })

  return noStore({
    success: true,
    data: {
      enabled: isWeddingDayWW2Enabled(),
      issuanceWindow: {
        opensAt: window.opensAt.toISOString(),
        cutoffAt: window.cutoffAt.toISOString(),
        expiresAt: window.expiresAt.toISOString(),
      },
      guests,
    },
  })
}
