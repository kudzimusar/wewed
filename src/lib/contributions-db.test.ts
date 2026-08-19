import { afterAll, describe, expect, test } from 'bun:test'
import { db } from '@/lib/db'

afterAll(async () => { await db.$disconnect() })

describe('Contributions database migration', () => {
  test('private contribution tables exist', async () => {
    const rows = await db.$queryRaw<Array<{ contributors: string | null; contributions: string | null; funding: string | null }>>`
      SELECT to_regclass('wewed_contributions.contributors')::text AS contributors,
             to_regclass('wewed_contributions.wedding_contributions')::text AS contributions,
             to_regclass('wewed_contributions.payment_funding_allocations')::text AS funding
    `
    expect(rows[0]?.contributors).toBe('wewed_contributions.contributors')
    expect(rows[0]?.contributions).toBe('wewed_contributions.wedding_contributions')
    expect(rows[0]?.funding).toBe('wewed_contributions.payment_funding_allocations')
  })

  test('source-of-funds check constraints are installed', async () => {
    const rows = await db.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
        FROM pg_constraint
       WHERE conname IN ('payment_funding_target_chk','payment_funding_contribution_chk','contribution_fulfillment_chk','contribution_campaign_type_chk','contributor_kind_chk','contributor_preferred_contact_chk')
       ORDER BY conname
    `
    expect(rows.map((row) => row.name)).toEqual(['contribution_campaign_type_chk','contribution_fulfillment_chk','contributor_kind_chk','contributor_preferred_contact_chk','payment_funding_contribution_chk','payment_funding_target_chk'])
  })
})
