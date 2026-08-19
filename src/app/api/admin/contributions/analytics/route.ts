import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { summarizeContributions } from '@/lib/contributions'
import { requireAdmin } from '@/lib/admin-gate'

interface AdminSummaryRow {
  type: string
  amount: number | null
  currency: string
  estimatedValue: number | null
  estimatedValueCurrency: string | null
  commitmentState: string
  fulfillmentState: string
  allocatedAmount: number
}

export async function GET(request: NextRequest) {
  const gate = requireAdmin(request)
  if (gate) return gate
  try {
    const [totals, rows] = await Promise.all([
      db.$queryRaw<Array<{ contributions: bigint; weddings: bigint; campaigns: bigint; directVendor: bigint; inKind: bigint; toThank: bigint; unattributedFunding: bigint }>>`
        SELECT
          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions) AS contributions,
          (SELECT COUNT(DISTINCT wedding_id) FROM wewed_contributions.wedding_contributions) AS weddings,
          (SELECT COUNT(*) FROM wewed_contributions.campaigns) AS campaigns,
          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions WHERE type = 'DIRECT_VENDOR_PAYMENT') AS "directVendor",
          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions WHERE type IN ('GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP')) AS "inKind",
          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions WHERE thank_you_state IN ('TO_THANK','PREPARED')) AS "toThank",
          (SELECT COUNT(*) FROM wewed_contributions.payment_funding_allocations WHERE source_kind = 'LEGACY_UNATTRIBUTED') AS "unattributedFunding"
      `,
      db.$queryRaw<AdminSummaryRow[]>`
        SELECT c.type, c.amount::float8 AS amount, c.currency,
               c.estimated_value::float8 AS "estimatedValue", c.estimated_value_currency AS "estimatedValueCurrency",
               c.commitment_state AS "commitmentState", c.fulfillment_state AS "fulfillmentState",
               COALESCE(SUM(a.amount) FILTER (WHERE a.allocation_kind = 'CASH'), 0)::float8 AS "allocatedAmount"
          FROM wewed_contributions.wedding_contributions c
          LEFT JOIN wewed_contributions.contribution_allocations a ON a.contribution_id = c.id AND a.wedding_id = c.wedding_id
         GROUP BY c.id
      `,
    ])
    const counts = totals[0]
    return NextResponse.json({
      success: true,
      data: {
        contributions: Number(counts?.contributions ?? 0),
        weddingsUsingContributions: Number(counts?.weddings ?? 0),
        campaigns: Number(counts?.campaigns ?? 0),
        directVendorPayments: Number(counts?.directVendor ?? 0),
        inKindContributions: Number(counts?.inKind ?? 0),
        thankYousOutstanding: Number(counts?.toThank ?? 0),
        explicitlyUnattributedFundingRows: Number(counts?.unattributedFunding ?? 0),
        summaryByCurrency: summarizeContributions(rows),
      },
    })
  } catch (error) {
    console.error('[ADMIN CONTRIBUTIONS ANALYTICS] error', error)
    return NextResponse.json({ success: false, error: 'Contribution analytics are unavailable.' }, { status: 500 })
  }
}
