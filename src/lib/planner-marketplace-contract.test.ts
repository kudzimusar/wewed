import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

function source(path: string) { return readFileSync(path, 'utf8') }

const migration = source('prisma/migrations/20260803020000_planner_marketplace_secure_appointment/migration.sql')
const access = source('src/lib/marketplace-access.ts')
const authorize = source('src/app/api/marketplace/engagements/[id]/authorize/route.ts')
const action = source('src/app/api/marketplace/engagements/[id]/action/route.ts')
const enquiries = source('src/app/api/marketplace/enquiries/route.ts')
const planners = source('src/app/api/marketplace/planners/route.ts')
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
    for (const implementation of [migration, access, authorize, action, enquiries]) {
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

  test('enquiries do not create wedding authority', () => {
    expect(enquiries).toContain('planner_enquiry.submitted')
    expect(enquiries).not.toContain('WeddingMembership')
    expect(enquiries).not.toContain('BusinessAccountLink')
  })

  test('authority requires the two-step appointment handshake and is atomic', () => {
    expect(authorize).toContain("engagement.status !== 'planner_accepted'")
    expect(authorize).toContain('db.$transaction')
    expect(authorize).toContain('INSERT INTO public."WeddingMembership"')
    expect(authorize).toContain("relationship = 'manages'")
    expect(authorize).toContain('planner_engagement.authorized')
    expect(authorize).toContain('AUTHORITY_BUNDLES')
  })

  test('couples can pause, resume and revoke authority without deleting history', () => {
    expect(action).toContain("SET status = 'revoked'")
    expect(action).toContain("status = 'paused'")
    expect(action).toContain("status = 'active'")
    expect(action).not.toContain('DELETE FROM public."WeddingMembership"')
    expect(action).not.toContain('DELETE FROM wewed_admin."PlannerEngagement"')
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
