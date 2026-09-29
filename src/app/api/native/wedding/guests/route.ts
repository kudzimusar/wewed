import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import { guestPartySize, guestRsvpStatus, guestSeatingIdentity } from '@/lib/guest-record-authority'
import { nativeGuestSummary, resolveNativeGuestWrite } from '@/lib/native-planner-guest-write'
import { createPlannerGuest } from '@/lib/planner-guest-operations'

/**
 * Master plan Phase 8 §9 — Guests (Planner/Couple account access to guest management, read-only in
 * this phase). This is the account-side guest list, never Guest Session v2 identity (§9: "Do not
 * mix these account reads with Guest Session v2").
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context

  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'guests.view')
  if (!permission.ok) return permission.response

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  const guests = await db.guest.findMany({
    where: {
      weddingId: scope.weddingId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { seatingTable: { name: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: { seatingTable: { select: { id: true, name: true, weddingId: true } }, rsvp: true },
    orderBy: [{ createdAt: 'asc' }],
  })

  return noStoreJson({
    success: true,
    count: guests.length,
    // Shared Guest-record projection (desktop Planner list, Guest session and this route).
    data: guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      side: guest.side,
      role: guest.role,
      tableNumber: guest.tableNumber,
      ...guestSeatingIdentity(guest.seatingTable, scope.weddingId),
      rsvpStatus: guestRsvpStatus(guest.rsvp?.attending),
      partySize: guestPartySize(guest.rsvp),
      rsvpMessage: guest.rsvp?.message ?? null,
      checkedIn: guest.rsvp?.checkedIn ?? false,
      createdAt: guest.createdAt.toISOString(),
      updatedAt: guest.updatedAt.toISOString(),
    })),
  })
}

/**
 * NATIVE-MOBILE-QRO08 — native twin of the desktop "Add guest" (POST /api/planner/guests, guest
 * mode). Same shared operation: validation, duplicate-email rule, personal-link RSVP row and audit.
 * The response carries only non-credential fields; the client re-reads the invitations projection.
 */
export async function POST(request: NextRequest) {
  const write = await resolveNativeGuestWrite(request)
  if (!write.ok) return write.response
  try {
    const body = (await request.json().catch(() => null)) as {
      name?: unknown
      email?: unknown
      phone?: unknown
    } | null
    const result = await createPlannerGuest(write.actor, {
      name: typeof body?.name === 'string' ? body.name : undefined,
      email: typeof body?.email === 'string' ? body.email : undefined,
      phone: typeof body?.phone === 'string' ? body.phone : undefined,
    })
    if (!result.ok) {
      return noStoreJson(
        { success: false, error: result.error, ...('field' in result && result.field ? { field: result.field } : {}) },
        result.status,
      )
    }
    return noStoreJson({ success: true, data: nativeGuestSummary(result.data) }, 201)
  } catch (error) {
    console.error('[native wedding guests POST] failed', error instanceof Error ? error.name : 'unknown')
    return noStoreJson({ success: false, error: 'Failed to create guest.' }, 500)
  }
}
