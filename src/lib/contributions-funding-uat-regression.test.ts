import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const fundingRoute = readFileSync('src/app/api/planner/budget/funding/route.ts', 'utf8')
const budgetDetailRoute = readFileSync('src/app/api/planner/budget/[id]/route.ts', 'utf8')

describe('Contributions funding UAT regressions', () => {
  test('advisory locks never expose PostgreSQL void to Prisma', () => {
    expect(fundingRoute).not.toContain('await tx.$queryRaw`SELECT pg_advisory_xact_lock')
    expect(fundingRoute.match(/SELECT 1::int AS locked/g)?.length).toBeGreaterThanOrEqual(2)
    expect(fundingRoute).toContain('FROM (SELECT pg_advisory_xact_lock')
  })

  test('budget paid corrections preserve source-of-funds truth', () => {
    expect(budgetDetailRoute).toContain("source_kind <> 'LEGACY_UNATTRIBUTED'")
    expect(budgetDetailRoute).toContain("throw new Error('PAID_BELOW_ATTRIBUTED')")
    expect(budgetDetailRoute).toContain('const targetLegacy = Math.max(0, nextPaid - classified)')
    expect(budgetDetailRoute).toContain("source_kind = 'LEGACY_UNATTRIBUTED'")
    expect(budgetDetailRoute).toContain('Budget paid amount changed before source was classified; funding source not recorded.')
  })

  test('historical funding API still accepts an explicit partial amount', () => {
    expect(fundingRoute).toContain('const amount = finiteNonNegative(body.amount)')
    expect(fundingRoute).toContain('if (already + amount > budget.paidAmount + 0.0001)')
    expect(fundingRoute).toContain('let remainingToReplace = amount')
  })
})
