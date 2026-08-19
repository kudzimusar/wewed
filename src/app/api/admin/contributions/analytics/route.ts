import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-gate'

export async function GET(request: NextRequest) {
  const gate = requireAdmin(request)
  if (gate) return gate
  try {
    const [totals] = await db.$queryRaw<Array<{
      contributions: bigint
      weddings: bigint
      campaigns: bigint
      directVendor: bigint
      inKind: bigint
      toThank: bigint
      unattributedFunding: bigint
    }>>`
      SELECT
        (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions) AS contributions,
        (SELECT COUNT(DISTINCT wedding_id) FROM wewed_contributions.wedding_contributions) AS weddings,
        (SELECT COUNT(*) FROM wewed_contributions.campaigns) AS campaigns,
        (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions WHERE type = 'DIRECT_VENDOR_PAYMENT') AS "directVendor",
        (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions WHERE type IN ('GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP')) AS "inKind",
        (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions WHERE thank_you_state IN ('TO_THANK','PREPARED')) AS "toThank",
        (SELECT COUNT(*) FROM wewed_contributions.payment_funding_allocations WHERE source_kind = 'LEGACY_UNATTRIBUTED') AS "unattributedFunding"
    `
    return NextResponse.json({
      success: true,
      data: {
        contributions: Number(totals?.contributions ?? 0),
        weddingsUsingContributions: Number(totals?.weddings ?? 0),
        campaigns: Number(totals?.campaigns ?? 0),
        directVendorPayments: Number(totals?.directVendor ?? 0),
        inKindContributions: Number(totals?.inKind ?? 0),
        thankYousOutstanding: Number(totals?.toThank ?? 0),
        explicitlyUnattributedFundingRows: Number(totals?.unattributedFunding ?? 0),
      },
    })
  } catch (error) {
    console.error('[ADMIN CONTRIBUTIONS ANALYTICS] error', error)
    return NextResponse.json({ success: false, error: 'Contribution analytics are unavailable.' }, { status: 500 })
  }
}
