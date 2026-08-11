import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '../..')
const registerRoute = readFileSync(resolve(root, 'src/app/api/auth/register/route.ts'), 'utf8')
const registrationForm = readFileSync(resolve(root, 'src/components/public/public-registration-form.tsx'), 'utf8')
const vendorWorkspace = readFileSync(resolve(root, 'src/app/vendor/page.tsx'), 'utf8')
const signInPage = readFileSync(resolve(root, 'src/app/sign-in/page.tsx'), 'utf8')

describe('reserved Vendor owner activation', () => {
  test('matches only an unowned approved Vendor reservation for the exact email', () => {
    expect(registerRoute).toContain(`ba.type = 'vendor'`)
    expect(registerRoute).toContain(`ba.status = 'active'`)
    expect(registerRoute).toContain(`ba.\"onboardingStatus\" = 'complete'`)
    expect(registerRoute).toContain(`ba.\"ownerUserId\" IS NULL`)
    expect(registerRoute).toContain(`lower(COALESCE(ba.metadata->>'reservedOwnerEmail', '')) = $1`)
    expect(registerRoute).toContain(`profile.visibility = 'published'`)
    expect(registerRoute).toContain(`profile.\"listingStatus\" IN ('claimed', 'verified')`)
    expect(registerRoute).toContain(`profile.\"isClaimable\" = false`)
  })

  test('requires the explicit reserved profile slug and approved business identity', () => {
    expect(registerRoute).toContain(`reservedProfileSlug !== reservedVendor.profileSlug`)
    expect(registerRoute).toContain(`businessName.toLocaleLowerCase() !== reservedVendor.businessName.toLocaleLowerCase()`)
    expect(registerRoute).toContain(`requestedRole !== 'business_owner'`)
    expect(registerRoute).toContain('Open that profile’s secure owner activation link instead of creating a new application.')
  })

  test('attaches ownership instead of creating a second marketplace account', () => {
    const reservedResponse = registerRoute.indexOf('reservedProfileAttached: true')
    const ordinaryAccountCreation = registerRoute.indexOf('const accountId = `business-${randomUUID()}`')
    expect(reservedResponse).toBeGreaterThan(0)
    expect(ordinaryAccountCreation).toBeGreaterThan(reservedResponse)

    expect(registerRoute).toContain(`SET \"ownerUserId\" = $2`)
    expect(registerRoute).toContain(`'business_owner', 'active'`)
    expect(registerRoute).toContain(`'account.manage', 'profile.manage', 'enquiries.manage'`)
    expect(registerRoute).toContain(`SET \"acceptingEnquiries\" = true`)
    expect(registerRoute).toContain(`'business_account.reserved_vendor_owner_attached'`)
    expect(registerRoute).toContain(`role: 'vendor'`)
  })

  test('keeps ordinary public registrations in the existing review flow', () => {
    expect(registerRoute).toContain(`'pending_review'`)
    expect(registerRoute).toContain(`'business_account.public_application_submitted'`)
    expect(registerRoute).toContain(`registrationReceivedEmail({ name, businessName, applicationId: accountId })`)
    expect(registerRoute).toContain(`reservedProfileAttached: false`)
  })

  test('gives reserved owners a distinct activation and confirmation experience', () => {
    expect(registrationForm).toContain(`const reservedFlow = Boolean(reservedProfileSlug)`)
    expect(registrationForm).toContain(`reservedProfileSlug: reservedFlow ? reservedProfileSlug : null`)
    expect(registrationForm).toContain('Activate approved Vendor profile')
    expect(registrationForm).toContain('No duplicate marketplace listing was created.')
    expect(registrationForm).toContain(`searchParams.get('confirmed') === 'vendor'`)
  })

  test('provides a real Vendor sign-in entry point for Messages', () => {
    expect(vendorWorkspace).toContain(`allowedRoles={['vendor']}`)
    expect(vendorWorkspace).toContain(`href=\"/messages\"`)
    expect(vendorWorkspace).toContain(`href=\"/vendors/manage\"`)
    expect(signInPage).toContain(`'Vendor workspace'`)
    expect(signInPage).toContain(`'/vendor'`)
  })
})
