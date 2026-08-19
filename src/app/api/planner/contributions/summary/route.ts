import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { summarizeContributions } from '@/lib/contributions'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface SummaryRow {
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
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const weddingId = access.context.weddingId
  try {
    const [rows, counts] = await Promise.all([
      db.$queryRaw<SummaryRow[]>`
        SELECT c.type, c.amount::float8 AS amount, c.currency,
               c.estimated_value::float8 AS "estimatedValue",
               c.estimated_value_currency AS "estimatedValueCurrency",
               c.commitment_state AS "commitmentState",
               c.fulfillment_state AS "fulfillmentState",
               COALESCE(SUM(a.amount) FILTER (WHERE a.allocation_kind = 'CASH'), 0)::float8 AS "allocatedAmount"
          FROM wewed_contributions.wedding_contributions c
          LEFT JOIN wewed_contributions.contribution_allocations a
            ON a.contribution_id = c.id AND a.wedding_id = c.wedding_id
         WHERE c.wedding_id = ${weddingId}
         GROUP BY c.id
      `,
      db.$queryRaw<Array<{ contributors: bigint; pledged: bigint; overdue: bigint; unverified: bigint; toThank: bigint }>>`
        SELECT
          (SELECT COUNT(*) FROM wewed_contributions.contributors WHERE wedding_id = ${weddingId}) AS contributors,
          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions
            WHERE wedding_id = ${weddingId}
              AND commitment_state = 'PLEDGED'
              AND fulfillment_state NOT IN ('RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED')) AS pledged,
          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions
            WHERE wedding_id = ${weddingId} AND expected_at < NOW() AND fulfillment_state IN ('PENDING','PARTIALLY_RECEIVED')) AS overdue,
          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions
            WHERE wedding_id = ${weddingId} AND verification_state = 'UNVERIFIED'
              AND fulfillment_state IN ('RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED')) AS unverified,
          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions
            WHERE wedding_id = ${weddingId}
              AND thank_you_state IN ('TO_THANK','PREPARED')) AS "toThank"
      `,
    ])
    return NextResponse.json({
      success: true,
      summaryByCurrency: summarizeContributions(rows),
      counts: {
        contributors: Number(counts[0]?.contributors ?? 0),
        pledged: Number(counts[0]?.pledged ?? 0),
        overdue: Number(counts[0]?.overdue ?? 0),
        unverified: Number(counts[0]?.unverified ?? 0),
        toThank: Number(counts[0]?.toThank ?? 0),
      },
    })
  } catch (error) {
    console.error('[CONTRIBUTION SUMMARY GET] error', error)
    return NextResponse.json({ success: false, error: 'Could not load contribution summary.' }, { status: 500 })
  }
}
