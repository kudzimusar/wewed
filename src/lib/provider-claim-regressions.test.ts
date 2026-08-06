import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('provider claim and directory regression contracts', () => {
  test('serializes ownership approval before creating provider authority', () => {
    const claims = source('src/app/api/admin/providers/claims/route.ts')
    const lockIndex = claims.indexOf('FOR UPDATE OF c, p')
    const membershipIndex = claims.indexOf('INSERT INTO wewed_admin."BusinessAccountMember"')

    expect(lockIndex).toBeGreaterThan(-1)
    expect(membershipIndex).toBeGreaterThan(lockIndex)
    expect(claims).toContain("['unclaimed', 'claim_pending'].includes(lockedClaim.listingStatus)")
    expect(claims).toContain('Another ownership claim has already been approved for this provider.')
  })

  test('keeps claimed profiles out of the public claim flow', () => {
    const profile = source('src/components/providers/public-provider-profile.tsx')

    expect(profile).not.toContain('isProvisional(provider) || !provider.acceptingEnquiries')
    expect(profile).toContain(') : !provider.acceptingEnquiries ? (')
    expect(profile).toContain('Ownership verified')
    expect(profile).toContain('Secure enquiries will open after the owner confirms')
  })

  test('aborts superseded provider-directory requests before updating results', () => {
    const directory = source('src/components/providers/provider-directory.tsx')

    expect(directory).toContain('signal?: AbortSignal')
    expect(directory).toContain('const controller = new AbortController()')
    expect(directory).toContain("{ cache: 'no-store', signal }")
    expect(directory).toContain('if (signal?.aborted) return')
    expect(directory).toContain('controller.abort()')
  })

  test('deduplicates websites by complete hostname rather than prefix', () => {
    const discovery = source('src/app/api/admin/providers/discovery/import/route.ts')

    expect(discovery).not.toContain("LIKE lower($1) || '%'")
    expect(discovery).toContain("split_part(split_part(regexp_replace(p.website, '^https?://(www\\\\.)?', ''), '/', 1), ':', 1)")
    expect(discovery).toContain('= lower($1)')
  })
})
