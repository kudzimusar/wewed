import { describe, expect, test } from 'bun:test'
import {
  EXPECTED_WEWED_SUPABASE_REF,
  fingerprintDatabaseUrl,
} from './phase3-database-fingerprint'

describe('Phase 3 database fingerprint', () => {
  test('extracts the Wewed project ref from a Supabase pooler username without exposing the password', () => {
    const result = fingerprintDatabaseUrl(
      `postgresql://postgres.${EXPECTED_WEWED_SUPABASE_REF}:super-secret@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
    )

    expect(result.matchesExpectedProject).toBe(true)
    expect(result.projectRef).toBe(EXPECTED_WEWED_SUPABASE_REF)
    expect(result.projectRefSource).toBe('username')
    expect(result.database).toBe('postgres')
    expect(result.applicationRoleHint).toBe('postgres')
    expect(JSON.stringify(result)).not.toContain('super-secret')
    expect(JSON.stringify(result)).not.toContain('pgbouncer=true')
  })

  test('extracts the project ref from a direct Supabase database host', () => {
    const result = fingerprintDatabaseUrl(
      `postgresql://postgres:super-secret@db.${EXPECTED_WEWED_SUPABASE_REF}.supabase.co:5432/postgres`,
    )

    expect(result.matchesExpectedProject).toBe(true)
    expect(result.projectRefSource).toBe('host')
    expect(result.host).toBe(`db.${EXPECTED_WEWED_SUPABASE_REF}.supabase.co`)
  })

  test('fails closed when a Postgres URL cannot be tied to the expected project', () => {
    const result = fingerprintDatabaseUrl(
      'postgresql://custom_role:super-secret@some.pooler.example.com:6543/app',
    )

    expect(result.projectRef).toBeNull()
    expect(result.matchesExpectedProject).toBe(false)
    expect(JSON.stringify(result)).not.toContain('super-secret')
  })

  test('fails closed for a different Supabase project', () => {
    const result = fingerprintDatabaseUrl(
      'postgresql://postgres.aaaaaaaaaaaaaaaaaaaa:super-secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
    )

    expect(result.projectRef).toBe('aaaaaaaaaaaaaaaaaaaa')
    expect(result.matchesExpectedProject).toBe(false)
  })

  test('handles a missing value without inventing identity', () => {
    expect(fingerprintDatabaseUrl(undefined)).toEqual({
      available: false,
      protocol: null,
      host: null,
      database: null,
      connectionUsername: null,
      applicationRoleHint: null,
      projectRef: null,
      projectRefSource: null,
      matchesExpectedProject: false,
      parseError: false,
    })
  })
})
