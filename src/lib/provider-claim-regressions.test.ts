import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

// Release contract for provider-claim concurrency, presentation, directory and dedupe regressions.
describe('provider claim and directory regression contracts', () => {
  test('serializes ownership approval before creating provider authority', () => {
    const claims = source('src/app/api/admin/providers/claims/route.ts')
    const providerLockIndex = claims.indexOf('SELECT "listingStatus"')
    const claimLockIndex = claims.indexOf('SELECT status\n         FROM wewed_admin."ProviderClaimRequest"')
    const membershipIndex = claims.indexOf('INSERT INTO wewed_admin."BusinessAccountMember"')

    expect(providerLockIndex).toBeGreaterThan(-1)
    expect(claimLockIndex).toBeGreaterThan(providerLockIndex)
    expect(membershipIndex).toBeGreaterThan(claimLockIndex)
    expect(claims).toContain('CLAIMABLE_LISTING_STATUSES.includes(lockedProfile.listingStatus)')
    expect(claims).toContain('OPEN_CLAIM_STATUSES.includes(lockedClaim.status)')
    expect(claims).toContain('Another ownership claim has already been approved or resolved for this provider.')
  })

  test('serializes verification and rejection without overwriting a resolved claim', () => {
    const claims = source('src/app/api/admin/providers/claims/route.ts')

    expect(claims.split('SELECT id FROM wewed_admin."ProviderProfile" WHERE id = $1 FOR UPDATE').length - 1).toBe(2)
    expect(claims.split("WHERE id = $1 AND status IN ('pending', 'verification_required')").length - 1).toBeGreaterThanOrEqual(2)
    expect(claims.split('RETURNING id').length - 1).toBeGreaterThanOrEqual(2)
    expect(claims).toContain("WHERE id = $1 AND \"listingStatus\" IN ('unclaimed', 'claim_pending')")
  })

  test('serializes public submission against Admin review', () => {
    const submission = source('src/app/api/providers/[slug]/claims/route.ts')
    const providerLockIndex = submission.indexOf('SELECT "listingStatus", "isClaimable"')
    const duplicateCheckIndex = submission.indexOf('lower("claimantEmail") = lower($2)')
    const insertIndex = submission.indexOf('INSERT INTO wewed_admin."ProviderClaimRequest"')

    expect(providerLockIndex).toBeGreaterThan(-1)
    expect(duplicateCheckIndex).toBeGreaterThan(providerLockIndex)
    expect(insertIndex).toBeGreaterThan(duplicateCheckIndex)
    expect(submission).toContain("!['unclaimed', 'claim_pending'].includes(lockedProfile.listingStatus)")
    expect(submission).toContain('This business listing is no longer available to claim.')
    expect(submission).toContain("WHERE id = $1 AND \"isClaimable\" = true")
  })

  test('keeps claimed profiles out of the public claim flow', () => {
    const profile = source('src/components/providers/public-provider-profile.tsx')

    expect(profile).not.toContain('isProvisional(provider) || !provider.acceptingEnquiries')
    expect(profile).toContain(') : !provider.acceptingEnquiries ? (')
    expect(profile).toContain('Ownership verified')
    expect(profile).toContain('Secure enquiries will open after the owner confirms')
  })

  test('aborts every superseded provider-directory request including load more', () => {
    const directory = source('src/components/providers/provider-directory.tsx')

    expect(directory).toContain('useRef<Set<AbortController>>(new Set())')
    expect(directory).toContain('requestControllers.current.add(controller)')
    expect(directory).toContain('signal: controller.signal')
    expect(directory).toContain('requestControllers.current.delete(controller)')
    expect(directory).toContain('for (const controller of requestControllers.current) controller.abort()')
    expect(directory).toContain('abortActiveRequests()')
    expect(directory).toContain('await fetchPage(page + 1, true)')
    expect(directory).toContain("error.name === 'AbortError'")
  })

  test('deduplicates websites by complete hostname rather than prefix', () => {
    const discovery = source('src/app/api/admin/providers/discovery/import/route.ts')

    expect(discovery).not.toContain("LIKE lower($1) || '%'")
    expect(discovery).toContain("split_part(split_part(regexp_replace(p.website, '^https?://(www\\\\.)?', ''), '/', 1), ':', 1)")
    expect(discovery).toContain('= lower($1)')
  })
})
