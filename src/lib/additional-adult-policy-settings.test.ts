import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { normalizeAdditionalAdultPolicy } from './invitation-content-contract'

describe('Additional adults RSVP policy settings', () => {
  test('default is backward-compatible plus-ones allowed', () => {
    expect(normalizeAdditionalAdultPolicy(undefined)).toBe('plus_ones_allowed')
    expect(normalizeAdditionalAdultPolicy(null)).toBe('plus_ones_allowed')
    expect(normalizeAdditionalAdultPolicy('plus_ones_allowed')).toBe('plus_ones_allowed')
    expect(normalizeAdditionalAdultPolicy('named_guests_only')).toBe('named_guests_only')
  })

  test('Planner invitation settings persist the canonical WeddingContent field', () => {
    const route = readFileSync('src/app/api/planner/guests/invitations/route.ts', 'utf8')
    expect(route).toContain("field: 'additionalAdultPolicy'")
    expect(route).toContain('requestedAdditionalAdultPolicy')
    expect(route).toContain('normalizeAdditionalAdultPolicy')
    expect(route).toContain('value: additionalAdultPolicy')
    expect(route).toContain('additionalAdultPolicy: beforeAdditionalAdultPolicy')
    expect(route).toContain('additionalAdultPolicy,')
  })

  test('Planner and native invitation reads share the same canonical projection', () => {
    const projection = readFileSync('src/lib/planner-invitation-projection.ts', 'utf8')
    const desktop = readFileSync('src/app/api/planner/guests/invitations/route.ts', 'utf8')
    const native = readFileSync('src/app/api/native/wedding/invitations/route.ts', 'utf8')
    expect(projection).toContain("field: 'additionalAdultPolicy'")
    expect(projection).toContain('normalizeAdditionalAdultPolicy(additionalAdultPolicyRow?.value)')
    expect(projection).toContain('additionalAdultPolicy')
    expect(desktop).toContain('loadPlannerInvitationProjection(')
    expect(native).toContain('loadPlannerInvitationProjection(')
  })

  test('Invitation Studio exposes Plus-ones allowed and Named guests only', () => {
    const studio = readFileSync(
      'src/components/wedding/invitation-experience/premium-invitation-studio.tsx',
      'utf8',
    )
    const manager = readFileSync('src/components/wedding/invitation-manager.tsx', 'utf8')
    expect(studio).toContain('Additional adults')
    expect(studio).toContain('Plus-ones allowed')
    expect(studio).toContain('Named guests only')
    expect(studio).toContain('data-testid="invitation-additional-adult-policy"')
    expect(manager).toContain('draftAdditionalAdultPolicy')
    expect(manager).toContain('additionalAdultPolicy: draftAdditionalAdultPolicy')
  })

  test('both web RSVP surfaces remove plus-one controls under named-only policy', () => {
    const premium = readFileSync(
      'src/components/wedding/invitation-experience/premium-invitation-rsvp-dialog.tsx',
      'utf8',
    )
    const legacy = readFileSync('src/components/wedding/invitation-rsvp-dialog.tsx', 'utf8')

    expect(premium).toContain("additionalAdultPolicy === 'named_guests_only'")
    expect(premium).toContain('premium-rsvp-named-guests-only-note')
    expect(premium).toContain('plusOne: accepting && !professional && !namedGuestsOnly ? plusOne : false')
    expect(premium).toContain('if (!professional && !namedGuestsOnly && plusOne)')

    expect(legacy).toContain("additionalAdultPolicy === 'named_guests_only'")
    expect(legacy).toContain('legacy-rsvp-named-guests-only')
    expect(legacy).toContain("data.guest.role === 'service_provider' || data.wedding.additionalAdultPolicy === 'named_guests_only'")
    expect(legacy).toContain("form.get('plusOne') === 'on'")
  })

  test('Android and iOS consume the server policy and hide plus-one controls', () => {
    const android = readFileSync(
      'apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt',
      'utf8',
    )
    const ios = readFileSync(
      'apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift',
      'utf8',
    )
    expect(android).toContain('val namedGuestsOnly = additionalAdultPolicy == "named_guests_only"')
    expect(android).toContain('if (namedGuestsOnly)')
    expect(android).toContain('invitation-rsvp-named-guests-only-note')
    expect(ios).toContain('private var namedGuestsOnly: Bool { additionalAdultPolicy == "named_guests_only" }')
    expect(ios).toContain('if namedGuestsOnly')
    expect(ios).toContain('invitation-rsvp-named-guests-only-note')
  })

  test('historical plus-one detail is preserved while live attendance excludes it', () => {
    const mutation = readFileSync('src/lib/guest-rsvp-mutation.ts', 'utf8')
    const gate = readFileSync('src/lib/wedding-day.ts', 'utf8')
    expect(mutation).toContain('data.plusOne = false')
    expect(mutation).toContain('delete data.plusOneName')
    expect(mutation).toContain('delete data.plusOneMeal')
    expect(gate).toContain("guest.additionalAdultPolicy !== 'named_guests_only'")
    expect(gate).toContain("guest.role !== 'service_provider'")
    expect(gate).toContain('guest.plusOne')
  })
})
