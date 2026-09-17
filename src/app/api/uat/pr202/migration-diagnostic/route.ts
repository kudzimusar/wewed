import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const BRANCH = 'feature/private-invitation-android-delivery-20260912'
const BUSINESS_TABLES = [
  'BusinessAccount',
  'BusinessAccountMember',
  'BusinessAccountLink',
  'PaymentRecord',
  'SupportCase',
  'PlatformIncident',
  'BusinessAuditLog',
] as const

type MigrationRow = {
  migration_name: string
  started_at: Date
  finished_at: Date | null
  rolled_back_at: Date | null
  applied_steps_count: number
}
type RelationRow = { schema_name: string; name: string; relkind: string; rls: boolean }
type IndexRow = { table_name: string; index_name: string }
type ConstraintRow = { table_name: string; constraint_name: string; constraint_type: string; validated: boolean }
type TriggerRow = { table_name: string; trigger_name: string }
type FunctionRow = { function_name: string }
type GrantRow = { schema_name: string; grantee: string; grant_count: bigint }

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== BRANCH) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const [unresolved, ledger, relations, indexes, constraints, triggers, functions, grants] = await Promise.all([
    db.$queryRaw<MigrationRow[]>`
      SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
      FROM public._prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
      ORDER BY started_at ASC
    `,
    db.$queryRaw<MigrationRow[]>`
      SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
      FROM public._prisma_migrations
      WHERE migration_name IN (
        '20260730173000_wewed_business_admin_console',
        '20260730174500_wewed_business_admin_console_rls',
        '20260730175500_move_business_console_to_private_schema',
        '20260730224000_harden_wewed_data_pipeline',
        '20260731173000_repair_planner_blockers',
        '20260731214500_complete_planner_gap_closure',
        '20260801065000_fix_governance_trigger_record_returns'
      )
      ORDER BY migration_name
    `,
    db.$queryRaw<RelationRow[]>`
      SELECT n.nspname AS schema_name, c.relname AS name, c.relkind::text AS relkind, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public','wewed_admin')
        AND c.relname IN (
          'BusinessAccount','BusinessAccountMember','BusinessAccountLink','PaymentRecord',
          'SupportCase','PlatformIncident','BusinessAuditLog'
        )
      ORDER BY n.nspname, c.relname
    `,
    db.$queryRaw<IndexRow[]>`
      SELECT tablename AS table_name, indexname AS index_name
      FROM pg_indexes
      WHERE schemaname = 'wewed_admin'
        AND tablename IN (
          'BusinessAccount','BusinessAccountMember','BusinessAccountLink','PaymentRecord',
          'SupportCase','PlatformIncident','BusinessAuditLog'
        )
      ORDER BY tablename, indexname
    `,
    db.$queryRaw<ConstraintRow[]>`
      SELECT c.relname AS table_name, con.conname AS constraint_name, con.contype::text AS constraint_type,
        con.convalidated AS validated
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'wewed_admin'
        AND c.relname IN (
          'BusinessAccount','BusinessAccountMember','BusinessAccountLink','PaymentRecord',
          'SupportCase','PlatformIncident','BusinessAuditLog'
        )
      ORDER BY c.relname, con.conname
    `,
    db.$queryRaw<TriggerRow[]>`
      SELECT c.relname AS table_name, t.tgname AS trigger_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal
        AND n.nspname = 'wewed_admin'
        AND c.relname IN (
          'BusinessAccount','BusinessAccountMember','BusinessAccountLink','PaymentRecord',
          'SupportCase','PlatformIncident','BusinessAuditLog'
        )
      ORDER BY c.relname, t.tgname
    `,
    db.$queryRaw<FunctionRow[]>`
      SELECT p.proname AS function_name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'wewed_admin'
      ORDER BY p.proname
    `,
    db.$queryRaw<GrantRow[]>`
      SELECT table_schema AS schema_name, grantee, count(*)::bigint AS grant_count
      FROM information_schema.role_table_grants
      WHERE table_schema IN ('public','wewed_admin')
        AND table_name IN (
          'BusinessAccount','BusinessAccountMember','BusinessAccountLink','PaymentRecord',
          'SupportCase','PlatformIncident','BusinessAuditLog'
        )
        AND grantee IN ('anon','authenticated','PUBLIC')
      GROUP BY table_schema, grantee
      ORDER BY table_schema, grantee
    `,
  ])

  return NextResponse.json({
    success: true,
    unresolved: unresolved.map((row) => ({
      migrationName: row.migration_name,
      appliedStepsCount: row.applied_steps_count,
    })),
    businessConsole: {
      expectedTables: BUSINESS_TABLES,
      ledger: ledger.map((row) => ({
        migrationName: row.migration_name,
        finished: Boolean(row.finished_at),
        rolledBack: Boolean(row.rolled_back_at),
        appliedStepsCount: row.applied_steps_count,
      })),
      relations,
      indexes,
      constraints,
      triggers,
      functions: functions.map((row) => row.function_name),
      restrictedRoleGrants: grants.map((row) => ({
        schemaName: row.schema_name,
        grantee: row.grantee,
        grantCount: Number(row.grant_count),
      })),
    },
  })
}
