import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BRANCH = 'feature/private-invitation-android-delivery-20260912'

type MigrationLedgerRow = {
  migration_name: string
  started_at: Date
  finished_at: Date | null
  rolled_back_at: Date | null
  applied_steps_count: number
}

export async function GET() {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== BRANCH
  ) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const rows = await db.$queryRaw<MigrationLedgerRow[]>`
    SELECT
      migration_name,
      started_at,
      finished_at,
      rolled_back_at,
      applied_steps_count
    FROM public._prisma_migrations
    WHERE finished_at IS NULL
      AND rolled_back_at IS NULL
    ORDER BY started_at ASC
  `

  return NextResponse.json({
    success: true,
    unresolved: rows.map((row) => ({
      migrationName: row.migration_name,
      startedAt: row.started_at,
      appliedStepsCount: row.applied_steps_count,
    })),
  })
}
