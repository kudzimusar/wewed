import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Wewed Wedding Architect ecosystem contract', () => {
  test('documents one canonical ecosystem rather than shadow AI data', () => {
    const plan = source('docs/AI_WEDDING_ARCHITECT_ECOSYSTEM_PLAN.md')
    expect(plan).toContain('No new Wedding Architect domain may create a second source of truth')
    expect(plan).toContain('AI is the glue, not the calculator of record')
    expect(plan).toContain('Database/UI alignment rule')
    expect(plan).toContain('Couples and planners must write to the same canonical wedding requirement dataset')
  })

  test('keeps provider commercial data additive and exact-budget readiness explicit', () => {
    const migration = source('prisma/migrations/20260807195000_ai_wedding_architect_provider_commercial/migration.sql')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "pricingVisibility"')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "priceComponents"')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "aiReadinessStatus"')
    expect(migration).toContain("'not_ready'")
    expect(migration).toContain('Existing offerings remain visible and usable in the ordinary marketplace')
  })

  test('keeps wedding requirements private and wedding-scoped', () => {
    const migration = source('prisma/migrations/20260807203000_wedding_architect_requirements/migration.sql')
    expect(migration).toContain('wewed_admin."WeddingRequirementProfile"')
    expect(migration).toContain('wewed_admin."WeddingCategoryRequirement"')
    expect(migration).toContain('UNIQUE ("weddingId", "category")')
    expect(migration).toContain('REFERENCES public."Wedding"("id") ON DELETE CASCADE')
    expect(migration).toContain('REVOKE ALL ON SCHEMA wewed_admin')
    expect(migration).not.toContain('CREATE OR REPLACE VIEW public."WeddingRequirement')
    expect(migration).not.toContain('GRANT SELECT')
  })

  test('uses the governed wedding permission and preview-write boundary', () => {
    const route = source('src/app/api/wedding-requirements/route.ts')
    expect(route).toContain("requireWeddingPermission(request, 'planner.view')")
    expect(route).toContain("requireWeddingPermission(request, 'planner.edit')")
    expect(route).toContain('normalizeWeddingRequirements')
    expect(route).toContain("action: profile.confirmBrief ? 'wedding.requirements.confirmed' : 'wedding.requirements.saved'")
    expect(route).toContain('transaction.auditEvent.create')
    expect(route).not.toContain('createServerClient')
  })

  test('gives owner and planner one shared editable brief', () => {
    const editor = source('src/components/wedding/wedding-requirements-editor.tsx')
    const page = source('src/app/planner/wedding-brief/page.tsx')
    const dock = source('src/components/wedding/planner-account-dock.tsx')
    expect(editor).toContain("fetch('/api/wedding-requirements'")
    expect(editor).toContain('Confirm for AI planning')
    expect(editor).toContain('Payment comfort')
    expect(editor).toContain('WEDDING_REQUIREMENT_PRIORITIES')
    expect(page).toContain('<WeddingRequirementsEditor />')
    expect(page).toContain('<WeddingBriefAiCoach />')
    expect(dock).toContain("['/planner/wedding-brief', 'Brief'")
  })

  test('keeps AI brief coaching private, read-only and outside pricing authority', () => {
    const route = source('src/app/api/wedding-requirements/guidance/route.ts')
    const coach = source('src/components/wedding/wedding-brief-ai-coach.tsx')
    expect(route).toContain("profile: 'private'")
    expect(route).toContain('allowFallback: false')
    expect(route).toContain("scope: 'wedding-requirements-guidance'")
    expect(route).toContain('wrapUntrustedContext')
    expect(route).toContain('Never invent, estimate or recommend provider prices or a total wedding cost.')
    expect(route).toContain('Do not recommend specific vendors yet')
    expect(route).not.toContain('INSERT INTO wewed_admin')
    expect(route).not.toContain('UPDATE wewed_admin')
    expect(route).not.toContain('DELETE FROM wewed_admin')
    expect(coach).toContain('It cannot save changes, invent prices, or recommend vendors at this stage.')
  })

  test('aligns supply and demand on the same provider category taxonomy', () => {
    const providerPricing = source('src/lib/provider-pricing-catalog.ts')
    const clientRequirements = source('src/lib/wedding-requirement-catalog.ts')
    const requirementMigration = source('prisma/migrations/20260807203000_wedding_architect_requirements/migration.sql')
    for (const category of ['venue', 'planning', 'photography', 'catering', 'cakes', 'transport', 'other']) {
      expect(providerPricing).toContain(`${category}:`)
      expect(clientRequirements).toContain(`${category}:`)
      expect(requirementMigration).toContain(`'${category}'`)
    }
  })
})
