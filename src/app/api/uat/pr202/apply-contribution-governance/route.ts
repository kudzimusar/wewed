import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BRANCH = 'feature/private-invitation-android-delivery-20260912'
const WEDDING_ID = 'wewed-pr202-uat-20260912'

export async function GET() {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== BRANCH ||
    process.env.WEWED_UAT_PROVISION !== WEDDING_ID
  ) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS wewed_contributions.wedding_settings (
      wedding_id TEXT PRIMARY KEY REFERENCES public."Wedding"(id) ON DELETE CASCADE,
      accepting_contributions BOOLEAN NOT NULL DEFAULT TRUE,
      disabled_message TEXT,
      updated_by_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await db.$executeRawUnsafe(`ALTER TABLE wewed_contributions.campaigns ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE`)
  await db.$executeRawUnsafe(`ALTER TABLE wewed_contributions.campaigns ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`)
  await db.$executeRawUnsafe(`ALTER TABLE wewed_contributions.campaigns ADD COLUMN IF NOT EXISTS accepted_types JSONB NOT NULL DEFAULT '["CASH_TO_COUPLE","DIRECT_VENDOR_PAYMENT","GOODS_IN_KIND","SERVICE_IN_KIND","TIME_LABOUR","DISCOUNT_SPONSORSHIP","HONEYMOON_GIFT","OTHER"]'::jsonb`)
  await db.$executeRawUnsafe(`ALTER TABLE wewed_contributions.campaigns ADD COLUMN IF NOT EXISTS budget_item_id TEXT REFERENCES public."BudgetItem"(id) ON DELETE SET NULL`)
  await db.$executeRawUnsafe(`ALTER TABLE wewed_contributions.campaigns ADD COLUMN IF NOT EXISTS service_engagement_id TEXT REFERENCES public."ServiceEngagement"(id) ON DELETE SET NULL`)
  await db.$executeRawUnsafe(`ALTER TABLE wewed_contributions.campaigns DROP CONSTRAINT IF EXISTS campaigns_accepted_types_array_chk`)
  await db.$executeRawUnsafe(`ALTER TABLE wewed_contributions.campaigns ADD CONSTRAINT campaigns_accepted_types_array_chk CHECK (jsonb_typeof(accepted_types) = 'array')`)
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS campaigns_wedding_public_order_idx ON wewed_contributions.campaigns(wedding_id, published, enabled, sort_order, created_at)`)
  await db.$executeRawUnsafe(`COMMENT ON TABLE wewed_contributions.wedding_settings IS 'Wedding-level public contribution acceptance switch. History is retained when disabled.'`)
  await db.$executeRawUnsafe(`COMMENT ON COLUMN wewed_contributions.campaigns.accepted_types IS 'Contribution types the couple/planner accepts for this public campaign.'`)
  await db.$executeRawUnsafe(`COMMENT ON COLUMN wewed_contributions.campaigns.budget_item_id IS 'Optional governed Budget destination for public pledges; does not itself mark the item paid.'`)
  await db.$executeRawUnsafe(`COMMENT ON COLUMN wewed_contributions.campaigns.service_engagement_id IS 'Optional governed vendor service destination required for public direct-vendor-payment pledges.'`)

  const [settings, columns] = await Promise.all([
    db.$queryRaw<Array<{ settings: string | null }>>`SELECT to_regclass('wewed_contributions.wedding_settings')::text AS settings`,
    db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='wewed_contributions' AND table_name='campaigns'
        AND column_name IN ('enabled','sort_order','accepted_types','budget_item_id','service_engagement_id')
      ORDER BY column_name
    `,
  ])

  return NextResponse.json({
    success: settings[0]?.settings === 'wewed_contributions.wedding_settings' && columns.length === 5,
    settings: settings[0]?.settings ?? null,
    columns: columns.map((row) => row.column_name),
  })
}
