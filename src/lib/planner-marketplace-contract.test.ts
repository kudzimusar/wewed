import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

function source(path: string) { return readFileSync(path, 'utf8') }

const migration = source('prisma/migrations/20260803020000_planner_marketplace_secure_appointment/migration.sql')
const hardening = source('prisma/migrations/20260803021500_harden_planner_marketplace_relationships/migration.sql')
const migrationStatements = `${migration}\n${hardening}`.replace(/^--.*$/gm, '')
const access = source('src/lib/marketplace-access.ts')
const authorize = source('src/app/api/marketplace/engagements/[id]/authorize/route.ts')
const action = source('src/app/api/marketplace/engagements/[id]/action/route.ts')
const accept = source('src/app/api/marketplace/engagements/[id]/accept/route.ts')
const enquiries = source('src/app/api/marketplace/enquiries/route.ts')
const appoint = source('src/app/api/marketplace/enquiries/[id]/appoint/route.ts')
const planners = source('src/app/api/marketplace/planners/route.ts')
const shortlist = source('src/app/api/marketplace/shortlist/route.ts')
const directory = source('src/components/marketplace/planner-directory.tsx')
const profile = source('src/app/api/marketplace/profile/route.ts')
const adminProfiles = source('src/app/api/admin/planner-profiles/route.ts')
const coupleCentre = source('src/components/marketplace/couple-planner-centre.tsx')
const plannerCentre = source('src/components/marketplace/planner-marketplace-centre.tsx')
const weddingHome = source('src/components/wedding/wedding-home.tsx')

describe('planner marketplace secure appointment contract', () => {
  test('keeps the marketplace in the private governed business schema', () => {
    expect(migration).toContain('wewed_admin."PlannerProfile"')
    expect(migration).toContain('wewed_admin."PlannerEnquiry"')
    expect(migration).toContain('wewed_admin."PlannerEngagement"')
    expect(migration).toContain('REVOKE ALL ON SCHEMA wewed_admin')
    expect(migration).toContain("ARRAY['anon', 'authenticated']")
    expect(migration).toContain('security_invoker = true')
  })

  test('does not modify Stripe, subscriptions or the payment ledger', () => {
    for (const implementation of [migrationStatements, access, authorize, action, enquiries]) {
      expect(implementation).not.toContain('PaymentRecord')
      expect(implementation).not.toContain('stripeRequest')
      expect(implementation).not.toContain('STRIPE_SECRET_KEY')
    }
  })

  test('public discovery returns published active planners only', () => {
    expect(planners).toContain("p.status = 'published'")
    expect(planners).toContain("ba.type = 'planning_company'")
    expect(planners).toContain("ba.status = 'active'")
    expect(planners).toContain('toPublicProfile')
    expect(planners).not.toContain('client')
  })

  test('public directory exposes every supported discovery filter', () => {
    for (const marker of [
      'Filter planners by service',
      'Filter planners by wedding style',
      'Filter planners by price band',
      'Filter planners by availability',
      'service, style, priceBand, availability',
    ]) expect(directory).toContain(marker)
  })

  test('shortlist writes use the exact user-scoped unique key and support removal', () => {
    expect(shortlist).toContain('ON CONFLICT ("weddingId", "plannerProfileId", "createdByUserId") DO NOTHING')
    expect(shortlist).toContain('DELETE FROM wewed_admin."PlannerShortlist"')
    expect(shortlist).toContain('AND "createdByUserId" = $3')
    expect(coupleCentre).toContain('Remove saved')
  })

  test('public profile writes require HTTPS portfolio links and unique slugs', () => {
    expect(profile).toContain("new URL(entry).protocol !== 'https:'")
    expect(profile).toContain('Portfolio links must be valid HTTPS URLs.')
    expect(profile).toContain('That public planner URL is already in use.')
  })

  test('enquiries do not create wedding authority', () => {
    expect(enquiries).toContain('planner_enquiry.submitted')
    expect(enquiries).not.toContain('WeddingMembership')
    expect(enquiries).not.toContain('BusinessAccountLink')
  })

  test('duplicate enquiries and appointments fail as explicit conflicts', () => {
    expect(enquiries).toContain('ON CONFLICT DO NOTHING')
    expect(enquiries).toContain('An open enquiry already exists')
    expect(appoint).toContain('ON CONFLICT DO NOTHING')
    expect(appoint).toContain('already has a current planner appointment')
  })

  test('authority requires the two-step appointment handshake and is atomic', () => {
    expect(authorize).toContain("engagement.status !== 'planner_accepted'")
    expect(authorize).toContain('db.$transaction')
    expect(authorize).toContain('INSERT INTO public."WeddingMembership"')
    expect(authorize).toContain("relationship = 'manages'")
    expect(authorize).toContain('planner_engagement.authorized')
    expect(authorize).toContain('AUTHORITY_BUNDLES')
  })

  test('pending appointments can be declined or cancelled before authority', () => {
    expect(accept).toContain("body?.decision === 'decline'")
    expect(accept).toContain("SET status = 'cancelled'")
    expect(accept).toContain('planner_engagement.planner_declined')
    expect(plannerCentre).toContain('Decline appointment')
    expect(coupleCentre).toContain('Cancel appointment request')
    expect(coupleCentre).toContain('Cancel before granting authority')
  })

  test('couples can pause, resume, complete and revoke authority without deleting history', () => {
    expect(action).toContain("SET status = 'revoked'")
    expect(action).toContain("status = 'paused'")
    expect(action).toContain("status = 'active'")
    expect(action).toContain("action === 'complete'")
    expect(coupleCentre).toContain('Complete engagement')
    expect(action).not.toContain('DELETE FROM public."WeddingMembership"')
    expect(action).not.toContain('DELETE FROM wewed_admin."PlannerEngagement"')
  })

  test('resume revalidates planner business state before restoring access', () => {
    expect(action).toContain('activePlanner')
    expect(action).toContain("bam.status = 'active'")
    expect(action).toContain("ba.status = 'active'")
    expect(action).toContain("ba.\"onboardingStatus\" = 'complete'")
    expect(action).toContain('The planner business is no longer active')
  })

  test('database constraints bind shortlists and engagements to the correct users and graph', () => {
    expect(hardening).toContain('"PlannerShortlist_wedding_profile_user_key"')
    expect(hardening).toContain('UNIQUE ("weddingId", "plannerProfileId", "createdByUserId")')
    expect(hardening).toContain('"PlannerEngagement_membershipId_fkey"')
    expect(hardening).toContain('validate_planner_engagement_graph')
    expect(hardening).toContain('Planner engagement must match its enquiry stakeholder graph.')
  })

  test('suspended profiles have audited recovery paths', () => {
    expect(adminProfiles).toContain("status = 'suspended' AND $2 IN ('published','changes_requested')")
    expect(adminProfiles).toContain('planner_profile.${status}')
  })

  test('permission bundles exclude account ownership and billing', () => {
    expect(access).toContain("'full_coordination'")
    expect(access).not.toContain('billing.manage')
    expect(access).not.toContain('account.manage')
    expect(access).not.toContain('wedding.delete')
  })

  test('each couple keeps a slug-resolved public wedding homepage', () => {
    expect(weddingHome).toContain('WeddingDataProvider slug={slug}')
    expect(weddingHome).toContain('Printed from wewed.app/w/{slug}')
    expect(weddingHome).not.toContain('Charity &')
  })
})
