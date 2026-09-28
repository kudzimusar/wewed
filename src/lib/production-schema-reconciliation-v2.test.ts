import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  'prisma/migrations/20260929013000_production_schema_reconciliation_v2/migration.sql',
  'utf8',
)

describe('production schema reconciliation v2', () => {
  test('codifies the established production integrity objects', () => {
    expect(migration).toContain('WeddingMembership_role_check')
    expect(migration).toContain('WeddingMembership_status_check')
    expect(migration).toContain('BusinessAccount_vendor_normalized_name_unique')
    expect(migration).toContain('ProviderDiscoveryCandidate_active_normalized_identity_unique')
    expect(migration).toContain('ProviderProfile_normalized_identity_unique')
    expect(migration).toContain('wewed_delete_guest_contribution_before_guest')
  })

  test('does not seed or rewrite Charity & Kudzie business data', () => {
    expect(migration).not.toContain('JXVAA')
    expect(migration).not.toContain('charity-and-kudzie')
    expect(migration).not.toContain('CHRTYKDZ23')
    expect(migration).not.toMatch(/\bINSERT\s+INTO\b/i)
    expect(migration).not.toMatch(/\bUPDATE\s+[^;]*\s+SET\b/i)
    expect(migration).not.toMatch(/\bTRUNCATE\b/i)
  })

  test('is additive and does not drop live schema objects', () => {
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|INDEX|CONSTRAINT|FUNCTION|TRIGGER)\b/i)
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS')
    expect(migration).toContain('NOT VALID')
    expect(migration).toContain('VALIDATE CONSTRAINT')
  })
})
