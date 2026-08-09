import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

function source(path: string) { return readFileSync(path, 'utf8') }

const integrityMigration = source('prisma/migrations/20260809030000_planner_marketplace_onboarding_integrity/migration.sql')
const adminProfiles = source('src/app/api/admin/planner-profiles/route.ts')
const adminOnboarding = source('src/app/api/admin/onboarding/route.ts')
const adminOnboardingUi = source('src/components/admin/admin-onboarding-management.tsx')
const profileRoute = source('src/app/api/marketplace/profile/route.ts')
const submitRoute = source('src/app/api/marketplace/profile/submit/route.ts')
const publicDirectory = source('src/app/api/marketplace/planners/route.ts')
const quickStart = source('src/components/marketplace/planner-profile-quick-start.tsx')
const plannerMarketplacePage = source('src/app/planner/marketplace/page.tsx')
const postgresIntegration = source('scripts/planner-marketplace-postgres-integration.sql')
const browserFixture = source('tests/e2e/support/marketplace-fixture.ts')

describe('planner marketplace onboarding integrity', () => {
  test('automatically provisions a private draft profile for every active completed planning company', () => {
    expect(integrityMigration).toContain('ensure_planner_profile_for_business')
    expect(integrityMigration).toContain("NEW.type = 'planning_company'")
    expect(integrityMigration).toContain("NEW.status = 'active'")
    expect(integrityMigration).toContain('NEW."onboardingStatus" = \'complete\'')
    expect(integrityMigration).toContain("'draft'")
    expect(integrityMigration).toContain('BusinessAccount_planner_profile_provision')
    expect(integrityMigration).toContain("ba.type = 'planning_company'")
    expect(integrityMigration).toContain("ba.status = 'active'")
    expect(integrityMigration).toContain('ba."onboardingStatus" = \'complete\'')
  })

  test('backfill is scoped to modern planning businesses and does not fabricate legacy businesses from user roles', () => {
    const backfill = integrityMigration.slice(integrityMigration.indexOf('-- Backfill only the safe modern lifecycle'))
    expect(backfill).toContain('FROM wewed_admin."BusinessAccount" ba')
    expect(backfill).not.toContain('FROM public."User"')
    expect(backfill).not.toContain("role = 'planner'")
  })

  test('planner onboarding no longer requires an existing client wedding', () => {
    expect(adminOnboarding).toContain('Planning-company onboarding is intentionally independent from having a client wedding.')
    expect(adminOnboarding).toContain('if (weddingId)')
    expect(adminOnboarding).toContain('currentWeddingId: weddingId || null')
    expect(adminOnboarding).toContain('plannerMarketplaceReady: true')
    expect(adminOnboarding).not.toContain('Assign an existing wedding to complete planner onboarding.')
    expect(adminOnboardingUi).toContain('No wedding yet — activate planner marketplace only')
    expect(adminOnboardingUi).toContain('Normal appointment authorization can grant wedding access later.')
    expect(adminOnboardingUi).not.toContain('name="weddingId" required')
  })

  test('admin governance starts from planning businesses so missing profiles remain visible', () => {
    expect(adminProfiles).toContain('FROM public."BusinessAccount" ba')
    expect(adminProfiles).toContain('LEFT JOIN public."PlannerProfile" p')
    expect(adminProfiles).toContain("ba.type = 'planning_company'")
    expect(adminProfiles).toContain("'not_started'")
  })

  test('planner quick start saves incomplete drafts and requires only essentials for review', () => {
    expect(quickStart).toContain('Start with the four details couples need')
    expect(quickStart).toContain('submitForReview && (!bio || serviceAreas.length === 0 || services.length === 0)')
    expect(quickStart).toContain('Save draft')
    expect(quickStart).toContain('Save & submit for review')
    expect(submitRoute).toContain('Display name, biography, service area and at least one service are required.')
    expect(plannerMarketplacePage).toContain('Start with the four essentials')
  })

  test('editing a live profile cannot silently delist it and review-state profiles cannot be overwritten', () => {
    expect(profileRoute).toContain("existing[0]?.status === 'published' ? 'published' : 'draft'")
    expect(profileRoute).toContain("existing[0]?.status === 'submitted'")
    expect(profileRoute).toContain('currently under review')
    expect(profileRoute).toContain('"publishedAt"=EXCLUDED."publishedAt"')
  })

  test('public discovery remains explicitly published-only', () => {
    expect(publicDirectory).toContain("p.status = 'published'")
    expect(publicDirectory).toContain("ba.type = 'planning_company'")
    expect(publicDirectory).toContain("ba.status = 'active'")
    expect(publicDirectory).toContain('ba."onboardingStatus" = \'complete\'')
  })

  test('postgres integration proves provisioning before the appointment lifecycle', () => {
    expect(postgresIntegration).toContain('Active complete planning company must automatically receive a private draft PlannerProfile')
    expect(postgresIntegration).toContain("status='draft'")
    expect(postgresIntegration).toContain("status='published'")
  })

  test('browser fixtures promote the provisioned profile instead of inserting a duplicate', () => {
    expect(browserFixture).toContain('UPDATE wewed_admin."PlannerProfile"')
    expect(browserFixture).toContain('expected exactly one auto-provisioned profile')
    expect(browserFixture).not.toContain('INSERT INTO wewed_admin."PlannerProfile"')
  })
})
