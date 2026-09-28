import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantPermission, noStoreJson } from '@/lib/native-domain-context'

/**
 * Master plan Phase 8 §9 — a lightweight Overview: real counts derived from the same domains this
 * phase wires (Tasks/Guests/Budget/Vendors), not the PWA's full `/api/planner/overview` (readiness
 * score, attention items, imports, reminders) — that richer aggregation is UNSUPPORTED in this
 * phase and tracked as remaining work, not approximated here.
 *
 * A Planner-portfolio grant (`scopeKind === 'portfolio'`, zero weddings) returns wedding-less
 * identity only — it must never fabricate a wedding to answer this endpoint (§9: "A Planner
 * portfolio with zero weddings must still work... must not fabricate a wedding").
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant, authority } = result.context

  if (grant.scopeKind === 'portfolio') {
    // A portfolio grant's `permissions[]` is the raw BusinessAccountMember JSON (business-level
    // permissions like `account.manage`), not the wedding-permission vocabulary
    // (`resolveWeddingPermissions`) — there is no wedding to view yet, so holding the grant itself
    // is the only gate, exactly as `deriveBusinessGrants` (grants.ts) already treats it.
    const business = authority.businessMemberships.find((m) => m.businessAccountId === grant.businessAccountId)
    return noStoreJson({
      success: true,
      scopeKind: 'portfolio',
      businessAccountId: grant.businessAccountId,
      businessName: business?.businessName ?? null,
      wedding: null,
      counts: null,
    })
  }

  if (grant.scopeKind !== 'wedding' || !grant.weddingId) {
    return noStoreJson({ success: false, error: 'This workspace grant is not wedding-scoped.' }, 403)
  }
  const permission = requireGrantPermission(grant, 'planner.view')
  if (!permission.ok) return permission.response

  const weddingId = grant.weddingId
  const wedding = await db.wedding.findUnique({
    where: { id: weddingId },
    select: { id: true, slug: true, title: true, date: true, venue: true, lifecycle: true, couple: { select: { partner1: true, partner2: true } } },
  })
  if (!wedding) return noStoreJson({ success: false, error: 'The authorized wedding no longer exists.' }, 404)

  const [taskCount, tasksDone, guestCount, guestsAttending, budgetItems, vendorCount, timelineCount] = await Promise.all([
    db.plannerTask.count({ where: { weddingId } }),
    db.plannerTask.count({ where: { weddingId, status: 'done' } }),
    db.guest.count({ where: { weddingId } }),
    db.guest.count({ where: { weddingId, rsvp: { attending: true } } }),
    db.budgetItem.findMany({ where: { weddingId }, select: { estimatedCost: true, paidAmount: true } }),
    db.vendor.count({ where: { weddingId } }),
    db.programmeItem.count({ where: { weddingId } }),
  ])

  const totalEstimated = budgetItems.reduce((sum, item) => sum + item.estimatedCost, 0)
  const totalPaid = budgetItems.reduce((sum, item) => sum + item.paidAmount, 0)

  return noStoreJson({
    success: true,
    scopeKind: 'wedding',
    wedding: {
      id: wedding.id,
      slug: wedding.slug,
      title: wedding.title,
      date: wedding.date.toISOString(),
      venue: wedding.venue,
      lifecycle: wedding.lifecycle,
      coupleNames: [wedding.couple.partner1, wedding.couple.partner2].filter(Boolean).join(' & '),
    },
    counts: {
      tasksTotal: taskCount,
      tasksDone,
      guestsTotal: guestCount,
      guestsAttending,
      budgetEstimatedTotal: totalEstimated,
      budgetPaidTotal: totalPaid,
      vendorsTotal: vendorCount,
      timelineEntries: timelineCount,
    },
  })
}
