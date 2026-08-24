import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWewedAdmin, WewedAdminAccessError } from '@/lib/wewed-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.support.read')
    const q = request.nextUrl.searchParams.get('q')?.trim().slice(0,160) || ''
    const status = request.nextUrl.searchParams.get('status')?.trim().slice(0,40) || ''
    const rows = await db.$queryRawUnsafe<Array<Record<string,unknown>>>(
      `SELECT b.id,b."publicReference",b.status,b."bookingMode",b.currency,b."totalCents",b."depositCents",
              b."weddingId",w.title AS "weddingTitle",w.date AS "weddingDate",
              concat_ws(' & ',NULLIF(c.partner1,''),NULLIF(c.partner2,'')) AS "coupleName",
              p.slug AS "providerSlug",p."displayName" AS "providerName",o.category,
              b."serviceEngagementId",se."lifecycleStatus" AS "engagementStatus",
              ct.id AS "contractId",ct."contractNumber",ct.status AS "contractStatus",
              bi.id AS "budgetItemId",bi."estimatedCost" AS "budgetEstimatedCost",bi."actualCost" AS "budgetActualCost",bi."paidAmount" AS "budgetPaidAmount",bi.currency AS "budgetCurrency",
              COALESCE(pay."paymentCount",0)::integer AS "paymentCount",COALESCE(pay."netPaid",0)::numeric AS "netPaid",
              COALESCE(con."contributionCount",0)::integer AS "contributionCount",COALESCE(con."allocatedContributionAmount",0)::numeric AS "allocatedContributionAmount",
              COALESCE(am."amendmentCount",0)::integer AS "amendmentCount",COALESCE(am."pendingAmendmentCount",0)::integer AS "pendingAmendmentCount",
              rl.channel AS "referralChannel",rl.campaign AS "referralCampaign",
              b."confirmedAt",b."createdAt",b."updatedAt"
         FROM wewed_booking."Booking" b
         JOIN public."Wedding" w ON w.id=b."weddingId"
         JOIN public."Couple" c ON c.id=w."coupleId"
         JOIN wewed_admin."ProviderProfile" p ON p."businessAccountId"=b."businessAccountId"
         JOIN wewed_admin."ProviderServiceOffering" o ON o.id=b."offeringId"
         LEFT JOIN public."ServiceEngagement" se ON se.id=b."serviceEngagementId"
         LEFT JOIN LATERAL (SELECT x.id,x."contractNumber",x.status FROM public."Contract" x WHERE x."serviceEngagementId"=b."serviceEngagementId" AND x."weddingId"=b."weddingId" ORDER BY x."createdAt" DESC LIMIT 1) ct ON true
         LEFT JOIN LATERAL (SELECT x.id,x."estimatedCost",x."actualCost",x."paidAmount",x.currency FROM public."BudgetItem" x WHERE x."serviceEngagementId"=b."serviceEngagementId" AND x."weddingId"=b."weddingId" ORDER BY x."createdAt" DESC LIMIT 1) bi ON true
         LEFT JOIN LATERAL (
           SELECT count(*)::integer AS "paymentCount",COALESCE(SUM(CASE WHEN m."entryType"='PAYMENT' THEN m.amount WHEN m."entryType" IN ('REFUND','REVERSAL') THEN -m.amount ELSE 0 END),0) AS "netPaid"
             FROM wewed_contracts."ManagedPaymentRecord" m WHERE m."serviceEngagementId"=b."serviceEngagementId" AND m."weddingId"=b."weddingId"
         ) pay ON true
         LEFT JOIN LATERAL (
           SELECT count(DISTINCT wc.id)::integer AS "contributionCount",COALESCE(SUM(ca.amount),0) AS "allocatedContributionAmount"
             FROM wewed_contributions.wedding_contributions wc
             LEFT JOIN wewed_contributions.contribution_allocations ca ON ca.contribution_id=wc.id AND ca.budget_item_id=bi.id
            WHERE wc.wedding_id=b."weddingId" AND (wc.service_engagement_id=b."serviceEngagementId" OR ca.budget_item_id=bi.id)
         ) con ON true
         LEFT JOIN LATERAL (
           SELECT count(*)::integer AS "amendmentCount",count(*) FILTER (WHERE a.status='proposed')::integer AS "pendingAmendmentCount"
             FROM wewed_booking."BookingAmendment" a WHERE a."bookingId"=b.id
         ) am ON true
         LEFT JOIN wewed_booking."ReferralLink" rl ON rl.id=b."referralLinkId"
        WHERE ($1::text='' OR b."publicReference" ILIKE '%'||$1||'%' OR p."displayName" ILIKE '%'||$1||'%' OR w.title ILIKE '%'||$1||'%' OR concat_ws(' ',c.partner1,c.partner2) ILIKE '%'||$1||'%')
          AND ($2::text='' OR b.status=$2)
        ORDER BY b."updatedAt" DESC
        LIMIT 100`,
      q,
      status,
    )
    const counts = await db.$queryRawUnsafe<Array<{ status:string; count:bigint }>>(
      `SELECT status,count(*)::bigint AS count FROM wewed_booking."Booking" GROUP BY status ORDER BY count(*) DESC`,
    )
    return NextResponse.json({
      success:true,
      admin:{userId:context.session.userId,role:context.adminRole},
      data:{bookings:rows,statusCounts:Object.fromEntries(counts.map(row=>[row.status,Number(row.count)]))},
    })
  } catch (error) {
    if (error instanceof WewedAdminAccessError) return NextResponse.json({ success:false,error:error.message },{status:error.status})
    console.error('[ADMIN BOOKINGS GET] error:',error)
    return NextResponse.json({success:false,error:'Unable to load booking support records.'},{status:500})
  }
}
