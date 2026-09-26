import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import { guestPartySize, guestRsvpStatus, guestSeatingIdentity } from '@/lib/guest-record-authority'

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
      checkedIn: guest.rsvp?.checkedIn ?? false,
      createdAt: guest.createdAt.toISOString(),
      updatedAt: guest.updatedAt.toISOString(),
    })),
  })
}
