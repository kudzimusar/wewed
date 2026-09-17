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

type ColumnRow = {
  table_name: string
  column_name: string
}

type TriggerRow = {
  trigger_name: string
}

type FunctionRow = {
  function_name: string
}

export async function GET() {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== BRANCH
  ) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const [rows, columns, triggers, functions] = await Promise.all([
    db.$queryRaw<MigrationLedgerRow[]>`
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
    `,
    db.$queryRaw<ColumnRow[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'Vendor' AND column_name IN (
            'contact', 'contractStatus', 'paymentStatus', 'planningRating', 'notes'
          ))
          OR
          (table_name = 'ProgrammeItem' AND column_name IN (
            'duration', 'location', 'displayIcon'
          ))
        )
      ORDER BY table_name, column_name
    `,
    db.$queryRaw<TriggerRow[]>`
      SELECT tgname AS trigger_name
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname IN (
          'sync_vendor_planner_metadata_trigger',
          'sync_programme_item_metadata_trigger'
        )
      ORDER BY tgname
    `,
    db.$queryRaw<FunctionRow[]>`
      SELECT p.proname AS function_name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'sync_vendor_planner_metadata',
          'sync_programme_item_metadata'
        )
      ORDER BY p.proname
    `,
  ])

  return NextResponse.json({
    success: true,
    unresolved: rows.map((row) => ({
      migrationName: row.migration_name,
      startedAt: row.started_at,
      appliedStepsCount: row.applied_steps_count,
    })),
    effects: {
      columns,
      triggers: triggers.map((row) => row.trigger_name),
      functions: functions.map((row) => row.function_name),
    },
  })
}
