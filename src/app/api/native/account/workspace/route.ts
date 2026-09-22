import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readBearerNativeAccountSession } from '@/lib/native-account-session'
import { resolveProductionAuthority } from '@/lib/production-authority/resolver'

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'cache-control': 'no-store' } })
}

/**
 * Minimal read-only production workspace snapshot for native Phase 5.
 *
 * The client supplies a grant id only as a selection hint. This route re-resolves the caller's
 * complete production authority on every request and refuses any grant that is not present in that
 * fresh contract. A wedding id/business id/vendor id is never accepted directly from the client.
 *
 * Phase 5 deliberately exposes only enough real data to render an authenticated, scoped native
 * workspace shell. Full Planner/Couple/Admin/Vendor domain parity stays in Phase 8.
 */
export async function GET(request: NextRequest) {
  const session = readBearerNativeAccountSession(request)
  if (!session) {
    return noStore({ success: false, error: 'Your session is no longer valid.' }, 401)
  }

  const grantId = request.nextUrl.searchParams.get('grantId')?.trim() ?? ''
  if (!grantId) {
    return noStore({ success: false, error: 'A workspace grant is required.' }, 400)
  }

  const authority = await resolveProductionAuthority(session.accessUserId, {
    authUserId: session.authUserId,
  })

  if (authority.accountStatus !== 'authorized') {
    return noStore({ success: false, error: 'This account has no active workspace authority.' }, 403)
  }

  const grant = authority.workspaceGrants.find((item) => item.grantId === grantId)
  if (!grant) {
    return noStore({ success: false, error: 'This workspace is no longer authorized.' }, 403)
  }

  let wedding: null | {
    id: string
    slug: string
    title: string
    date: string
    venue: string
    venueCity: string
    venueCountry: string
    lifecycle: string
    coupleNames: string
  } = null

  if (grant.scopeKind === 'wedding') {
    if (!grant.weddingId) {
      return noStore({ success: false, error: 'The workspace grant is invalid.' }, 403)
    }

    const record = await db.wedding.findUnique({
      where: { id: grant.weddingId },
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        venue: true,
        venueCity: true,
        venueCountry: true,
        lifecycle: true,
        couple: { select: { partner1: true, partner2: true } },
      },
    })

    if (!record) {
      return noStore({ success: false, error: 'The authorized wedding no longer exists.' }, 404)
    }

    wedding = {
      id: record.id,
      slug: record.slug,
      title: record.title,
      date: record.date.toISOString(),
      venue: record.venue,
      venueCity: record.venueCity,
      venueCountry: record.venueCountry,
      lifecycle: record.lifecycle,
      coupleNames: [record.couple.partner1, record.couple.partner2].filter(Boolean).join(' & '),
    }
  }

  const business = grant.businessAccountId
    ? authority.businessMemberships.find((item) => item.businessAccountId === grant.businessAccountId) ?? null
    : null

  return noStore({
    success: true,
    workspace: {
      grantId: grant.grantId,
      workspaceKind: grant.workspaceKind,
      scopeKind: grant.scopeKind,
      weddingId: grant.weddingId,
      weddingTitle: grant.weddingTitle,
      businessAccountId: grant.businessAccountId,
      businessName: business?.businessName ?? null,
      vendorId: grant.vendorId,
      serviceEngagementIds: grant.serviceEngagementIds,
      permissions: grant.permissions,
      platformRoles: grant.platformRoles,
      wedding,
    },
  })
}
