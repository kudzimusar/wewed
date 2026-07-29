import { describe, expect, test } from 'bun:test'
import { KNOWN_ACTIVE_PARITY_GAPS, ORIGINAL_PLANNER_SOURCE } from './planner-parity-contract'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

const RESTORED_STAGE5_CAPABILITIES = [
  'vendors.operational-fields',
  'vendors.delete',
  'guests.create-complete',
  'guests.search-filter',
  'guests.delete',
  'guests.seating-assignment',
  'guests.rsvp-readiness',
] as const

describe('Stage 5 Vendors and Guests parity', () => {
  test('restored vendor workflows remain grounded in the original VendorsTab', async () => {
    const original = await source(ORIGINAL_PLANNER_SOURCE)

    for (const marker of [
      'function VendorsTab',
      "contractStatus: 'pending'",
      "paymentStatus: 'unpaid'",
      "rating: '4'",
      "notes: ''",
      'newVendor.contact',
      'newVendor.contractStatus',
      'newVendor.paymentStatus',
      'newVendor.rating',
      'newVendor.notes',
      'const handleDelete',
      "fetch(`/api/planner/vendors/${vendor.id}`, { method: 'DELETE' })",
    ]) {
      expect(original).toContain(marker)
    }
  })

  test('vendor module restores complete operational entry, editing and confirmed deletion', async () => {
    const vendors = await source(
      'src/components/wedding/planner/modules/planner-vendors-module.tsx',
    )

    for (const marker of [
      'workspace-vendor-contact',
      'workspace-vendor-phone',
      'workspace-vendor-website',
      'workspace-vendor-contract',
      'workspace-vendor-payment',
      'workspace-vendor-rating',
      'workspace-vendor-notes',
      'Edit operational details',
      'Save vendor details',
      'onUpdateVendor(vendor',
      'window.confirm',
      'onDeleteVendor(vendor)',
    ]) {
      expect(vendors).toContain(marker)
    }
  })

  test('workspace writes normalized vendor fields and uses scoped update/delete routes', async () => {
    const [workspace, collectionRoute, itemRoute, pipelineSync] = await Promise.all([
      source('src/components/wedding/planner-workspace.tsx'),
      source('src/app/api/planner/vendors/route.ts'),
      source('src/app/api/planner/vendors/[id]/route.ts'),
      source('src/lib/planner-vendor-pipeline-sync.ts'),
    ])

    for (const marker of [
      'phone: vendorForm.phone.trim() || null',
      'website: vendorForm.website.trim() || null',
      'contractStatus: vendorForm.contractStatus',
      'paymentStatus: vendorForm.paymentStatus',
      'rating: vendorForm.rating',
      'notes: vendorForm.notes.trim() || null',
      'async function updateVendor',
      'async function deleteVendor',
      'onUpdateVendor={updateVendor}',
      'onDeleteVendor={deleteVendor}',
    ]) {
      expect(workspace).toContain(marker)
    }

    expect(collectionRoute).toContain('contact: body.contact?.trim() || null')
    expect(collectionRoute).toContain('planningRating: rating')
    expect(collectionRoute).toContain('syncVendorPipelineFromNormalizedVendor')
    expect(itemRoute).toContain('updates.contact = body.contact?.trim() || null')
    expect(itemRoute).toContain('updates.contractStatus = body.contractStatus')
    expect(itemRoute).toContain('updates.paymentStatus = body.paymentStatus')
    expect(itemRoute).toContain('updates.planningRating = body.rating')
    expect(itemRoute).toContain("where: { id, weddingId: access.context.weddingId }")
    expect(itemRoute).toContain("requireWeddingPermission(request, 'vendors.edit')")
    expect(itemRoute).not.toContain('encodeLegacyVendorDescription')
    expect(itemRoute).not.toContain('__wewed_meta__:')

    for (const retainedPipelineField of [
      'current?.quoteAmount',
      'current?.currency',
      'current?.contractUrl',
      'current?.depositAmount',
      'current?.depositDueDate',
      'current?.balanceDueDate',
      'current?.ownerUserId',
      'current?.ownerName',
    ]) {
      expect(pipelineSync).toContain(retainedPipelineField)
    }
  })

  test('restored guest workflows remain grounded in the original GuestsTab', async () => {
    const original = await source(ORIGINAL_PLANNER_SOURCE)

    for (const marker of [
      'function GuestsTab',
      "phone: ''",
      "role: 'guest'",
      "side: 'neutral'",
      "seatingTableId: ''",
      'sideFilter',
      'statusFilter',
      'Search by name or email',
      'const handleAssignTable',
      'body: JSON.stringify({ seatingTableId: tableId })',
      'mealChoice',
      'plusOneName',
      'kidsCount',
      'checkedIn',
      "fetch(`/api/planner/guests/${guest.id}`, { method: 'DELETE' })",
    ]) {
      expect(original).toContain(marker)
    }
  })

  test('guest module restores complete create, filters, seating, readiness and deletion', async () => {
    const guests = await source(
      'src/components/wedding/planner/modules/planner-guests-module.tsx',
    )

    for (const marker of [
      'workspace-guest-phone',
      'workspace-guest-role',
      'workspace-guest-side',
      'workspace-guest-table',
      'guestSearch',
      'guestSideFilter',
      'guestStatusFilter',
      'Search by name or email',
      'onAssignGuestTable(guest',
      'Meal choice',
      'Plus-one name',
      'Kids count',
      'Dietary notes',
      'Checked in',
      'window.confirm',
      'onDeleteGuest(guest)',
    ]) {
      expect(guests).toContain(marker)
    }
  })

  test('workspace and guest APIs keep all guest mutations wedding scoped', async () => {
    const [workspace, collectionRoute, itemRoute] = await Promise.all([
      source('src/components/wedding/planner-workspace.tsx'),
      source('src/app/api/planner/guests/route.ts'),
      source('src/app/api/planner/guests/[id]/route.ts'),
    ])

    for (const marker of [
      'phone: guestForm.phone.trim() || null',
      'role: guestForm.role',
      'side: guestForm.side',
      'seatingTableId: guestForm.seatingTableId || null',
      'async function assignGuestTable',
      'body: JSON.stringify({ seatingTableId: tableId })',
      'async function deleteGuest',
      'onAssignGuestTable={assignGuestTable}',
      'onDeleteGuest={deleteGuest}',
    ]) {
      expect(workspace).toContain(marker)
    }

    expect(collectionRoute).toContain('requireWeddingPermission(')
    expect(collectionRoute).toContain("body.kind === 'table' ? 'seating.edit' : 'guests.edit'")
    expect(collectionRoute).toContain('where: { weddingId: access.context.weddingId }')
    expect(collectionRoute).toContain('include: {')
    expect(collectionRoute).toContain('rsvp: true')
    expect(collectionRoute).toContain('mealChoice: string | null')
    expect(collectionRoute).toContain('plusOneName: string | null')
    expect(collectionRoute).toContain('dietaryNotes: string | null')
    expect(collectionRoute).toContain('checkedIn: boolean')

    expect(itemRoute).toContain("where: { id, weddingId: access.context.weddingId }")
    expect(itemRoute).toContain("kind === 'table' ? 'seating.edit' : 'guests.edit'")
    expect(itemRoute).toContain('updates.seatingTableId = body.seatingTableId')
    expect(itemRoute).toContain('db.rSVP.deleteMany({ where: { guestId: existing.id } })')
  })

  test('Stage 5 capabilities remain restored after worksheet completion', () => {
    for (const capability of RESTORED_STAGE5_CAPABILITIES) {
      expect(KNOWN_ACTIVE_PARITY_GAPS).not.toContain(capability)
    }
    expect(KNOWN_ACTIVE_PARITY_GAPS).not.toContain('vendors.worksheet')
    expect(KNOWN_ACTIVE_PARITY_GAPS).not.toContain('guests.worksheet')
  })

  test('restoration does not reactivate the retired shell or sample client data', async () => {
    const activeSurface = (
      await Promise.all([
        source('src/components/wedding/planner-workspace.tsx'),
        source('src/components/wedding/planner/modules/planner-vendors-module.tsx'),
        source('src/components/wedding/planner/modules/planner-guests-module.tsx'),
      ])
    ).join('\n')

    expect(activeSurface).not.toContain('<Dialog')
    expect(activeSurface).not.toContain('SEED_')
    expect(activeSurface).not.toContain('admin-auth')
    expect(activeSurface).not.toContain('isAdminLoggedIn')
    expect(activeSurface).not.toContain('Charity')
    expect(activeSurface).not.toContain('Kudzie')
  })
})
