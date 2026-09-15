import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BRANCH = 'feature/private-invitation-android-delivery-20260912'

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== BRANCH) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const [identity, relations, campaignColumns, migration] = await Promise.all([
    db.$queryRaw<Array<{ database: string; schema: string; server: string | null }>>`
      SELECT current_database() AS database,
             current_schema() AS schema,
             inet_server_addr()::text AS server
    `,
    db.$queryRaw<Array<{ settings: string | null; campaigns: string | null }>>`
      SELECT to_regclass('wewed_contributions.wedding_settings')::text AS settings,
             to_regclass('wewed_contributions.campaigns')::text AS campaigns
    `,
    db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema='wewed_contributions'
         AND table_name='campaigns'
         AND column_name IN ('enabled','sort_order','accepted_types','budget_item_id','service_engagement_id')
       ORDER BY column_name
    `,
    db.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at
        FROM public._prisma_migrations
       WHERE migration_name='20260915121500_contribution_public_governance'
       ORDER BY started_at DESC
       LIMIT 1
    `.catch(() => []),
  ])

  return NextResponse.json({
    success: true,
    identity: identity[0] ?? null,
    relations: relations[0] ?? null,
    campaignColumns: campaignColumns.map((row) => row.column_name),
    migration: migration[0] ?? null,
  })
}
