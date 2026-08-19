import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

describe('Contributions canonical source contract', () => {
  test('financial Contributions remain separate from GuestContribution', () => {
    const migration = read('prisma/migrations/20260819033000_contributions_resource_accounting/migration.sql')
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS wewed_contributions')
    expect(migration).toContain('wedding_contributions')
    expect(migration).not.toContain('ALTER TABLE public."GuestContribution"')
  })

  test('direct vendor payments remain EngagementPayment facts', () => {
    const route = read('src/app/api/planner/contributions/route.ts')
    expect(route).toContain('tx.engagementPayment.create')
    expect(route).toContain("'CONTRIBUTION'")
    expect(route).toContain('alreadyIncludedInBudgetPaid')
  })

  test('legacy paid amount is never silently classified as couple-funded', () => {
    const budget = read('src/app/api/planner/budget/route.ts')
    expect(budget).toContain('legacyUnattributed')
    expect(budget).toContain('item.paidAmount - attributed')
    expect(budget).not.toContain("sourceKind: 'COUPLE', amount: item.paidAmount")
  })

  test('Planner UI is responsive and uses plain language', () => {
    const ui = read('src/components/wedding/planner/planner-contributions-workspace.tsx')
    expect(ui).toContain('Record the help, not accounting jargon')
    expect(ui).toContain('md:hidden')
    expect(ui).toContain('hidden overflow-x-auto md:block')
    expect(ui).toContain('source not recorded')
  })

  test('Notebook links use the existing entity-link action', () => {
    const ui = read('src/components/wedding/planner/planner-contributions-workspace.tsx')
    expect(ui).toContain("action: 'add-link'")
    expect(ui).toContain("entityType: 'WeddingContribution'")
  })

  test('public campaign endpoint never selects contributor identity', () => {
    const publicRoute = read('src/app/api/contribution-campaigns/public/route.ts')
    expect(publicRoute).not.toContain('display_name')
    expect(publicRoute).not.toContain('email')
    expect(publicRoute).toContain('invitation_visible')
  })
})
