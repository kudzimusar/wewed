import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readBearerNativeAccountSession } from '@/lib/native-account-session'
import { resolveProductionAuthority } from '@/lib/production-authority/resolver'

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'cache-control': 'no-store' } })
}

/**
 * Minimal read-only production workspace snapshot for native Phase 5/6.
 *
 * The client supplies a grant id only as a selection hint. This route re-resolves the caller's
 * complete production authority on every request and refuses any grant that is not present in that
 * fresh contract. A wedding id/business id/vendor id/engagement id is never accepted directly from
 * the client as authority — each is validated as a child of the freshly-resolved grant (master plan
 * Phase 6 §5, §10).
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
  const requestedEngagementId = request.nextUrl.searchParams.get('engagementId')?.trim() || null

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

  // A client-supplied engagement id is authority only once it is proven to be one of THIS fresh
  // grant's own real engagements. It is never trusted merely because it decodes as a valid id, and
  // never silently picked when more than one exists (master plan Phase 6 §5). This is a distinct
  // failure from the grant itself being revoked (403/404 above): status 422 lets the client clear
  // only the stale engagement choice, not the still-valid wedding/business workspace underneath it.
  if (requestedEngagementId && !grant.serviceEngagementIds.includes(requestedEngagementId)) {
    return noStore(
      { success: false, error: 'This engagement is not part of this workspace grant.' },
      422,
    )
  }

  let resolvedEngagementId: string | null = requestedEngagementId
  let engagementSelectionRequired = false
  if (grant.vendorId && !resolvedEngagementId) {
    if (grant.serviceEngagementIds.length === 1) {
      resolvedEngagementId = grant.serviceEngagementIds[0]
    } else if (grant.serviceEngagementIds.length > 1) {
      engagementSelectionRequired = true
    }
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

  // Engagement summaries are always scoped by the grant's own vendorId AND weddingId — even though
  // membership in grant.serviceEngagementIds already proves this, the WHERE clause repeats it as
  // defense-in-depth so a summary can never be returned for another vendor/wedding's row.
  const engagementRows = grant.vendorId && grant.weddingId && grant.serviceEngagementIds.length > 0
    ? await db.serviceEngagement.findMany({
        where: {
          id: { in: grant.serviceEngagementIds },
          vendorId: grant.vendorId,
          weddingId: grant.weddingId,
        },
        select: { id: true, serviceCategory: true, serviceDescription: true, lifecycleStatus: true },
      })
    : []

  const engagementSummary = (id: string) => {
    const row = engagementRows.find((item) => item.id === id)
    return row
      ? {
          id: row.id,
          serviceCategory: row.serviceCategory,
          serviceDescription: row.serviceDescription,
          lifecycleStatus: row.lifecycleStatus,
        }
      : null
  }

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
      engagement: resolvedEngagementId ? engagementSummary(resolvedEngagementId) : null,
      engagementSelectionRequired,
      engagementOptions: engagementSelectionRequired
        ? grant.serviceEngagementIds.map(engagementSummary).filter((item): item is NonNullable<typeof item> => item !== null)
        : [],
      permissions: grant.permissions,
      platformRoles: grant.platformRoles,
      wedding,
    },
  })
}
