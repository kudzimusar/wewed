import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('provider booking UX interaction contract', () => {
  test('provider profile is progressive and booking-first rather than a permanent enquiry wall', () => {
    const profile = source('src/components/providers/public-provider-profile-v2.tsx')
    expect(profile).toContain('provider-booking-slot')
    expect(profile).toContain('Explore services & book')
    expect(profile).toContain('Ask a question')
    expect(profile).toContain('enquiryOpen')
    expect(profile).toContain('role="dialog"')
    expect(profile).toContain('Add wedding details')
    expect(profile).toContain('Marketplace')
  })

  test('catalogue is mounted into the provider content flow and uses explicit media provenance', () => {
    const page = source('src/app/vendors/[slug]/page.tsx')
    const showcase = source('src/components/providers/provider-booking-showcase-v2.tsx')
    expect(page).toContain('ProviderBookingShowcaseV2')
    expect(showcase).toContain("'#provider-booking-slot'")
    expect(showcase).toContain("provenance: 'Wewed editorial'")
    expect(showcase).toContain("provenance: 'Vendor photo'")
    expect(showcase).toContain('Illustrative Wewed-owned art; not vendor inventory.')
    expect(showcase).toContain('snap-x')
  })

  test('direct booking uses progressive steps instead of rendering logistics up front', () => {
    const bookingPage = source('src/app/vendors/[slug]/book/[itemSlug]/page.tsx')
    const form = source('src/components/providers/provider-booking-form-v2.tsx')
    expect(bookingPage).toContain('ProviderBookingFormV2')
    expect(bookingPage).toContain('ProviderShareQrButton')
    expect(form).toContain("type Step = 1 | 2 | 3")
    expect(form).toContain("Step {value}")
    expect(form).toContain('When and what?')
    expect(form).toContain('Pickup, delivery & return')
    expect(form).toContain('Review and send')
  })

  test('QR API and consumers share one compatible response contract', () => {
    const qrRoute = source('src/app/api/qrcode/route.ts')
    const shareButton = source('src/components/providers/provider-share-qr-button.tsx')
    const showcase = source('src/components/providers/provider-booking-showcase-v2.tsx')
    expect(qrRoute).toContain('qr: qrDataUrl')
    expect(qrRoute).toContain('qrCode: qrDataUrl')
    expect(shareButton).toContain('payload.qr')
    expect(showcase).toContain('payload.qr')
  })

  test('planner and vendor booking workspaces are next-action triage surfaces', () => {
    const plannerPage = source('src/app/planner/bookings/page.tsx')
    const vendorPage = source('src/app/vendor/bookings/page.tsx')
    const planner = source('src/components/booking/planner-bookings-workspace-v2.tsx')
    const vendor = source('src/components/booking/vendor-bookings-workspace-v2.tsx')
    expect(plannerPage).toContain('PlannerBookingsWorkspaceV2')
    expect(vendorPage).toContain('VendorBookingsWorkspaceV2')
    expect(planner).toContain('Needs action')
    expect(planner).toContain('Commercial & operational details')
    expect(vendor).toContain('Needs action')
    expect(vendor).toContain('Next action')
    expect(vendor).toContain('Create commercial quote')
  })
})
