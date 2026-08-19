import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'

function csv(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'export.data')
  if (access.error) return access.error
  const weddingId = access.context.weddingId
  const rows = await db.$queryRaw<Array<{
    contributor: string
    email: string | null
    relationship: string | null
    title: string
    type: string
    amount: string | null
    currency: string
    estimatedValue: string | null
    estimatedValueCurrency: string | null
    fulfillmentState: string
    route: string
    allocated: string
    thankYouState: string
    notes: string | null
  }>>`
    SELECT p.display_name AS contributor, p.email, p.relationship,
           c.title, c.type, c.amount::text AS amount, c.currency,
           c.estimated_value::text AS "estimatedValue",
           c.estimated_value_currency AS "estimatedValueCurrency",
           c.fulfillment_state AS "fulfillmentState", c.route,
           COALESCE(SUM(a.amount), 0)::text AS allocated,
           c.thank_you_state AS "thankYouState", c.notes
      FROM wewed_contributions.wedding_contributions c
      JOIN wewed_contributions.contributors p ON p.id = c.contributor_id
      LEFT JOIN wewed_contributions.contribution_allocations a ON a.contribution_id = c.id
     WHERE c.wedding_id = ${weddingId}
     GROUP BY c.id, p.id
     ORDER BY c.created_at
  `
  const header = ['Contributor','Email','Relationship','Contribution','Type','Amount','Currency','Estimated in-kind value','In-kind currency','State','Route','Allocated','Thank-you','Notes']
  const lines = [header.map(csv).join(',')]
  for (const row of rows) {
    lines.push([row.contributor,row.email,row.relationship,row.title,row.type,row.amount,row.currency,row.estimatedValue,row.estimatedValueCurrency,row.fulfillmentState,row.route,row.allocated,row.thankYouState,row.notes].map(csv).join(','))
  }
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="wewed-contributions.csv"', 'cache-control': 'private, no-store' } })
}
