import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROVIDER_CATEGORIES, providerServiceFields } from './provider-catalog'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('provider forms, profiles and service taxonomy', () => {
  test('documents and enforces the narrow non-regression boundary', () => {
    const plan = source('docs/vendor-forms-profiles-service-taxonomy-2026-08-05.md')
    expect(plan).toContain('Non-negotiable boundary')
    expect(plan).toContain('No unrelated change is authorised')
    expect(plan).toContain('Existing authentication, wedding isolation, marketplace authority, planner engagement and invitation privacy contracts remain unchanged')
    expect(plan).toContain('All database changes are additive')
  })

  test('includes cakes and complete category-specific schemas', () => {
    const values = PROVIDER_CATEGORIES.map((category) => category.value)
    expect(values).toContain('cakes')
    expect(values).toContain('venue')
    expect(values).toContain('photography')
    expect(values).toContain('catering')
    expect(values).toContain('beauty')
    expect(values).toContain('transport')
    expect(values.length).toBeGreaterThanOrEqual(25)
    expect(providerServiceFields('cakes').map((field) => field.key)).toContain('servingMaximum')
    expect(providerServiceFields('venue').map((field) => field.key)).toContain('seatedCapacity')
    expect(providerServiceFields('photography').map((field) => field.key)).toContain('editedImages')
    expect(providerServiceFields('catering').map((field) => field.key)).toContain('dietarySupport')
    expect(providerServiceFields('entertainment').map((field) => field.key)).toContain('technicalRequirements')
  })

  test('creates normalized private provider tables without changing wedding vendors', () => {
    const migration = source('prisma/migrations/20260805043000_provider_forms_profiles_service_taxonomy/migration.sql')
    for (const table of ['ProviderProfile', 'ProviderVerification', 'ProviderServiceOffering', 'ProviderPackage', 'ProviderPortfolioItem', 'ProviderEnquiry']) {
      expect(migration).toContain(`wewed_admin.\"${table}\"`)
    }
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE public.\"ProviderProfile\"')
    expect(migration).toContain('ALTER TABLE wewed_admin.\"PlannerProfile\"')
    expect(migration).not.toContain('ALTER TABLE public.\"Vendor\"')
    expect(migration).not.toContain('DELETE FROM public.\"Vendor\"')
  })

  test('uses progressive provider application and service-specific onboarding', () => {
    const registration = source('src/components/public/public-registration-form.tsx')
    const manager = source('src/components/providers/provider-profile-manager.tsx')
    expect(registration).toContain('requestedServices')
    expect(registration).toContain('PROVIDER_CATEGORIES')
    expect(registration).toContain('primaryServiceArea')
    expect(manager).toContain('providerServiceFields(offering.category)')
    expect(manager).toContain('Private business verification')
    expect(manager).toContain('Add structured packages')
    expect(manager).toContain('Autosaved locally')
    expect(manager).toContain('/api/providers/website-suggest')
  })

  test('keeps verification private and enquiries authority-free', () => {
    const publicDirectoryApi = source('src/app/api/providers/route.ts')
    const publicProfileApi = source('src/app/api/providers/[slug]/route.ts')
    const profileApi = source('src/app/api/providers/profile/route.ts')
    const enquiryApi = source('src/app/api/providers/enquiries/route.ts')
    expect(publicDirectoryApi).not.toContain('ProviderVerification')
    expect(publicProfileApi).not.toContain('ProviderVerification')
    expect(profileApi).toContain('wewed_admin.\"ProviderVerification\"')
    expect(enquiryApi).toContain('authorityCreated: false')
    expect(enquiryApi).not.toContain('WeddingMembership')
    expect(enquiryApi).not.toContain('PlannerEngagement')
  })

  test('does not render fabricated zero-value planner facts publicly', () => {
    const publicPlanner = source('src/components/marketplace/public-planner-profile.tsx')
    expect(publicPlanner).not.toContain('0–any guests')
    expect(publicPlanner).not.toContain('0 years')
    expect(publicPlanner).toContain('planner.yearsExperience > 0')
    expect(publicPlanner).toContain('planner.completedWeddings > 0')
    expect(publicPlanner).toContain('Planning packages')
    expect(publicPlanner).toContain('Booking policies')
  })
})
