import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const ui = readFileSync('src/components/wedding/planner/planner-contributions-workspace.tsx', 'utf8')
const engagementCore = readFileSync('src/lib/planner-engagement-route-core.ts', 'utf8')
const budgetApi = readFileSync('src/app/api/planner/budget/route.ts', 'utf8')
const vendorApi = readFileSync('src/app/api/planner/vendors/route.ts', 'utf8')
const engagementApi = readFileSync('src/app/api/planner/engagements/route.ts', 'utf8')

describe('Contributions inline dependency UAT contract', () => {
  test('keeps the planner in Contributions when the Budget cost is missing', () => {
    expect(ui).toContain('Add budget item here')
    expect(ui).toContain("fetch('/api/planner/budget'")
    expect(ui).toContain('paidAmount: 0')
    expect(ui).toContain('Create & use Budget item')
    expect(ui).toContain('budgetItemId: String(body.data.id)')
    expect(budgetApi).toContain("requireWeddingPermission(request, 'budget.edit')")
  })

  test('creates canonical vendor and service records without fabricating payment', () => {
    expect(ui).toContain('Add vendor / service here')
    expect(ui).toContain("fetch('/api/planner/vendors'")
    expect(ui).toContain("fetch('/api/planner/engagements'")
    expect(ui).toContain('budgetItemIds: [form.budgetItemId]')
    expect(ui).toContain('payments: []')
    expect(ui).toContain('No payment is created here.')
    expect(vendorApi).toContain("requireWeddingPermission(request, 'vendors.edit')")
    expect(engagementApi).toContain("requireWeddingPermission(request, 'vendors.edit')")
  })

  test('links the same Budget item to the engagement and vendor identity', () => {
    expect(engagementCore).toContain('select: { id: true, name: true }')
    expect(engagementCore).toContain('serviceEngagementId: engagement.id, vendorId: vendor.id, vendorName: vendor.name')
    expect(engagementCore).toContain('item.vendorId && item.vendorId !== vendor.id')
  })

  test('replaces native dead-end validation with guided prerequisites', () => {
    expect(ui).toContain('Choose or add the Budget cost in Step 3 before saving this direct vendor contribution.')
    expect(ui).toContain('Choose or add the vendor service in Step 3 before saving this direct vendor contribution.')
    expect(ui).not.toContain('select required value={form.serviceEngagementId}')
    expect(ui).toContain('Add or choose the Budget cost first. Wewed will then link the vendor service to that same cost.')
  })

  test('does not close the contribution dialog while dependencies are created', () => {
    const budgetStart = ui.indexOf('async function createInlineBudgetDependency')
    const vendorStart = ui.indexOf('async function createInlineVendorServiceDependency')
    const contributionStart = ui.indexOf('async function addContribution')
    expect(budgetStart).toBeGreaterThan(-1)
    expect(vendorStart).toBeGreaterThan(budgetStart)
    expect(contributionStart).toBeGreaterThan(vendorStart)
    const dependencyFunctions = ui.slice(budgetStart, contributionStart)
    expect(dependencyFunctions).not.toContain('setAddOpen(false)')
    expect(dependencyFunctions).toContain('setForm((current) => ({ ...current, budgetItemId: String(body.data.id) }))')
    expect(dependencyFunctions).toContain('setForm((current) => ({ ...current, serviceEngagementId: String(engagementBody.data.id) }))')
  })
})
