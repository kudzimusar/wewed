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

type MigrationLedgerRow = {
  migration_name: string
  started_at: Date
  finished_at: Date | null
  rolled_back_at: Date | null
  applied_steps_count: number
}

type ColumnRow = { table_name: string; column_name: string }
type TriggerRow = { trigger_name: string }
type FunctionRow = { function_name: string }
type NamedRow = { name: string }
type RelationRow = {
  schema_name: string
  name: string
  relkind: string
  rls: boolean
}
type BusinessIndexRow = {
  schema_name: string
  table_name: string
  index_name: string
}
type BusinessConstraintRow = {
  schema_name: string
  table_name: string
  constraint_name: string
  constraint_type: string
}
type GrantCountRow = {
  schema_name: string
  grantee: string
  grant_count: bigint
}

export async function GET() {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== BRANCH
  ) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const [
    rows,
    columns,
    triggers,
    functions,
    taskColumns,
    taskIndexes,
    taskConstraints,
    taskTriggers,
    taskFunctions,
    businessLedger,
    businessRelations,
    businessIndexes,
    businessConstraints,
    businessGrantCounts,
  ] = await Promise.all([
    db.$queryRaw<MigrationLedgerRow[]>`
      SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
      FROM public._prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
      ORDER BY started_at ASC
    `,
    db.$queryRaw<ColumnRow[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'Vendor' AND column_name IN ('contact','contractStatus','paymentStatus','planningRating','notes'))
          OR (table_name = 'ProgrammeItem' AND column_name IN ('duration','location','displayIcon'))
        )
      ORDER BY table_name, column_name
    `,
    db.$queryRaw<TriggerRow[]>`
      SELECT tgname AS trigger_name
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname IN ('sync_vendor_planner_metadata_trigger','sync_programme_item_metadata_trigger')
      ORDER BY tgname
    `,
    db.$queryRaw<FunctionRow[]>`
      SELECT p.proname AS function_name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('sync_vendor_planner_metadata','sync_programme_item_metadata')
      ORDER BY p.proname
    `,
    db.$queryRaw<ColumnRow[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'PlannerTask' AND column_name = 'assigneeUserId'
    `,
    db.$queryRaw<NamedRow[]>`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'PlannerTask' AND indexname = 'PlannerTask_assigneeUserId_idx'
    `,
    db.$queryRaw<NamedRow[]>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE conname = 'PlannerTask_assigneeUserId_fkey' AND conrelid = 'public."PlannerTask"'::regclass
    `,
    db.$queryRaw<NamedRow[]>`
      SELECT tgname AS name
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgrelid = 'public."PlannerTask"'::regclass
        AND tgname = 'preserve_planner_task_text_assignee_trigger'
    `,
    db.$queryRaw<NamedRow[]>`
      SELECT p.proname AS name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'preserve_planner_task_text_assignee'
    `,
    db.$queryRaw<MigrationLedgerRow[]>`
      SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
      FROM public._prisma_migrations
      WHERE migration_name IN (
        '20260730173000_wewed_business_admin_console',
        '20260730174500_wewed_business_admin_console_rls',
        '20260730175500_move_business_console_to_private_schema'
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
    db.$queryRaw<BusinessIndexRow[]>`
      SELECT schemaname AS schema_name, tablename AS table_name, indexname AS index_name
      FROM pg_indexes
      WHERE schemaname = 'wewed_admin'
        AND tablename IN (
          'BusinessAccount','BusinessAccountMember','BusinessAccountLink','PaymentRecord',
          'SupportCase','PlatformIncident','BusinessAuditLog'
        )
      ORDER BY tablename, indexname
    `,
    db.$queryRaw<BusinessConstraintRow[]>`
      SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name,
        con.contype::text AS constraint_type
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
    db.$queryRaw<GrantCountRow[]>`
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
    unresolved: rows.map((row) => ({
      migrationName: row.migration_name,
      startedAt: row.started_at,
      appliedStepsCount: row.applied_steps_count,
    })),
    effects: {
      plannerMetadata: {
        columns,
        triggers: triggers.map((row) => row.trigger_name),
        functions: functions.map((row) => row.function_name),
      },
      taskAssignee: {
        columns: taskColumns,
        indexes: taskIndexes.map((row) => row.name),
        constraints: taskConstraints.map((row) => row.name),
        triggers: taskTriggers.map((row) => row.name),
        functions: taskFunctions.map((row) => row.name),
      },
      businessConsole: {
        expectedTables: BUSINESS_TABLES,
        ledger: businessLedger.map((row) => ({
          migrationName: row.migration_name,
          finished: Boolean(row.finished_at),
          rolledBack: Boolean(row.rolled_back_at),
          appliedStepsCount: row.applied_steps_count,
        })),
        relations: businessRelations,
        indexes: businessIndexes,
        constraints: businessConstraints,
        restrictedRoleGrants: businessGrantCounts.map((row) => ({
          schemaName: row.schema_name,
          grantee: row.grantee,
          grantCount: Number(row.grant_count),
        })),
      },
    },
  })
}
