import { describe, expect, test } from 'bun:test'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('planner UAT remediation contracts', () => {
  test('planner workspace treats module fetches as independently recoverable', async () => {
    const workspace = await source('src/components/wedding/planner-workspace.tsx')
    const portal = await source('src/components/wedding/planner-portal.tsx')

    expect(workspace).toContain('Promise.allSettled')
    expect(workspace).toContain("response.json().catch(() => null)")
    expect(workspace).toContain('Your last loaded data is still shown')
    expect(workspace).toContain('Retry')
    expect(portal).toContain("[PLANNER PORTAL CLIENT] session refresh failed")
    expect(portal).toContain("response.json().catch(() => null)")
    expect(portal).toContain('All weddings')
    expect(portal).toContain('Portfolio')
  })

  test('portfolio uses compact mobile metrics and an explicit wedding CTA', async () => {
    const portfolio = await source(
      'src/components/wedding/planner-portfolio-command-centre.tsx',
    )

    expect(portfolio).toContain('grid grid-cols-2')
    expect(portfolio).toContain('Open wedding workspace')
    expect(portfolio).toContain("router.push(`/planner/${module}#planner-workspace`)")
    expect(portfolio).toContain('Retry')
  })

  test('vendor email and budget vendor relationship are represented in schema and migration', async () => {
    const schema = await source('prisma/schema.prisma')
    const migration = await source(
      'prisma/migrations/20260809080000_planner_vendor_budget_link/migration.sql',
    )
    const vendorsRoute = await source('src/app/api/planner/vendors/route.ts')

    expect(schema).toContain('email          String?')
    expect(schema).toContain('budgetItems BudgetItem[]')
    expect(schema).toContain('vendor    Vendor? @relation(fields: [vendorId], references: [id], onDelete: SetNull)')
    expect(schema).toContain('@@index([vendorId])')
    expect(migration).toContain('ADD COLUMN "email" TEXT')
    expect(migration).toContain('CONSTRAINT "BudgetItem_vendorId_fkey"')
    expect(migration).toContain('ON DELETE SET NULL ON UPDATE CASCADE')
    expect(vendorsRoute).toContain('email: v.email')
    expect(vendorsRoute).toContain('Enter a valid vendor email address')
  })

  test('budget vendor picker links by canonical id and preserves manual fallback', async () => {
    const picker = await source(
      'src/components/wedding/planner/planner-vendor-picker.tsx',
    )
    const budgetModule = await source(
      'src/components/wedding/planner/modules/planner-budget-module.tsx',
    )
    const workspace = await source('src/components/wedding/planner-workspace.tsx')
    const budgetRoute = await source('src/app/api/planner/budget/route.ts')

    expect(picker).toContain("onChange({ vendorId: vendor.id, vendorName: vendor.name })")
    expect(picker).toContain("onChange({ vendorId: '', vendorName: event.target.value })")
    expect(picker).toContain('external/manual vendor')
    expect(budgetModule).toContain('<PlannerVendorPicker')
    expect(budgetModule).toContain('Vendor linked')
    expect(workspace).toContain('vendorId: budgetForm.vendorId || null')
    expect(budgetRoute).toContain('id: body.vendorId, weddingId: access.context.weddingId')
  })

  test('planner enquiry decisions close safely without granting appointment authority', async () => {
    const enquiryRoute = await source('src/app/api/marketplace/enquiries/[id]/route.ts')
    const marketplaceFrame = await source('src/components/marketplace/marketplace-frame.tsx')

    expect(enquiryRoute).toContain("const PLANNER_DECISION_STATUSES = new Set(['accepted_interest', 'declined'])")
    expect(enquiryRoute).toContain('idempotent: true')
    expect(enquiryRoute).toContain('This enquiry decision is already closed.')
    expect(enquiryRoute).not.toContain('PlannerAppointment')
    expect(marketplaceFrame).toContain("? 'Interest accepted'")
    expect(marketplaceFrame).toContain("data-marketplace-status={normalized}")
    expect(marketplaceFrame).toContain("article:has([data-marketplace-status='accepted_interest'])")
  })
})