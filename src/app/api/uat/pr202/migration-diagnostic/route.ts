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
type SchemaObjectRow = { schema_name: string; object_name: string; object_type: string }

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== BRANCH) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const [
    allLedger,
    relations,
    indexes,
    constraints,
    triggers,
    functions,
    grants,
    schemaObjects,
  ] = await Promise.all([
    db.$queryRaw<MigrationRow[]>`
      SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
      FROM public._prisma_migrations
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
    db.$queryRaw<SchemaObjectRow[]>`
      SELECT n.nspname AS schema_name, c.relname AS object_name,
        CASE c.relkind
          WHEN 'r' THEN 'table'
          WHEN 'v' THEN 'view'
          WHEN 'm' THEN 'materialized_view'
          WHEN 'S' THEN 'sequence'
          ELSE c.relkind::text
        END AS object_type
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('private','wewed_planner','wewed_admin')
      ORDER BY n.nspname, c.relname
    `,
  ])

  const ledger = allLedger.map((row) => ({
    migrationName: row.migration_name,
    state: row.rolled_back_at
      ? 'rolled_back'
      : row.finished_at
        ? 'finished'
        : 'unresolved',
    appliedStepsCount: row.applied_steps_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }))

  return NextResponse.json({
    success: true,
    ledger,
    unresolved: ledger.filter((row) => row.state === 'unresolved'),
    ledgerSummary: {
      totalRows: ledger.length,
      finished: ledger.filter((row) => row.state === 'finished').length,
      unresolved: ledger.filter((row) => row.state === 'unresolved').length,
      rolledBack: ledger.filter((row) => row.state === 'rolled_back').length,
      firstRecorded: ledger.at(0)?.migrationName ?? null,
      lastRecorded: ledger.at(-1)?.migrationName ?? null,
    },
    businessConsole: {
      expectedTables: BUSINESS_TABLES,
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
    schemaObjects,
  })
}
