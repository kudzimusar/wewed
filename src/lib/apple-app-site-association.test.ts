import { describe, expect, test } from 'bun:test'
import {
  WEWED_IOS_BUNDLE_ID,
  buildAppleAppSiteAssociation,
  normalizeAppleApplicationIdentifierPrefix,
} from '@/lib/apple-app-site-association'

describe('Apple App Site Association contract', () => {
  test('fails closed on missing or malformed application identifier prefixes', () => {
    expect(normalizeAppleApplicationIdentifierPrefix(undefined)).toBeNull()
    expect(normalizeAppleApplicationIdentifierPrefix('')).toBeNull()
    expect(normalizeAppleApplicationIdentifierPrefix('not-a-team')).toBeNull()
  })

  test('binds universal links only to the configured Wewed iOS application', () => {
    const prefix = 'ABCDE12345'
    const association = buildAppleAppSiteAssociation(prefix)
    const details = association.applinks.details[0]

    expect(details.appIDs).toEqual([`${prefix}.${WEWED_IOS_BUNDLE_ID}`])
    expect(details.components.map((component) => component['/'])).toEqual(
      expect.arrayContaining(['/invite/*', '/i/*', '/w/*', '/app*', '/planner/*', '/pass*', '/pass/*', '/gate/*']),
    )
  })
})
