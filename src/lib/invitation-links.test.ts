/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  buildInvitationContinuePath,
  buildInvitationResumePath,
  buildPlayStoreInstallUrl,
  buildSmartInvitationUrl,
  isValidInvitationHandoffSecret,
} from '@/lib/invitation-links'

describe('smart invitation links', () => {
  test('routes personal invitation shares through the credential-stripping handoff', () => {
    const url = buildSmartInvitationUrl({
      siteUrl: 'https://wewed.pro/',
      weddingSlug: 'charity-and-kudzie',
      token: 'private-rsvp-token',
      style: 'botanical',
    })

    expect(url).toBe(
      'https://wewed.pro/invite/charity-and-kudzie?rsvp=private-rsvp-token&card=botanical',
    )
    expect(url).not.toContain('/w/charity-and-kudzie?')
  })

  test('encodes wedding slugs and sources in continuation paths', () => {
    expect(
      buildInvitationContinuePath({
        weddingSlug: 'wedding / test',
        source: 'app launch',
      }),
    ).toBe('/invite/wedding%20%2F%20test/continue?source=app+launch')
  })

  test('does not add an empty source parameter', () => {
    expect(
      buildInvitationContinuePath({ weddingSlug: 'charity-and-kudzie' }),
    ).toBe('/invite/charity-and-kudzie/continue')
  })

  test('puts only an opaque handoff into the Google Play referrer', () => {
    const handoff = 'E7kP3tQv9x2mABCDEFGHIJKLMN0123456789_-abcde'
    expect(handoff).toHaveLength(43)
    const url = buildPlayStoreInstallUrl(handoff)

    expect(url).toBe(
      `https://play.google.com/store/apps/details?id=pro.wewed.app&referrer=${encodeURIComponent(`handoff=${handoff}`)}`,
    )
    expect(url).not.toContain('rsvp=')
    expect(url).not.toContain('guest=')
    expect(url).not.toContain('email=')
    expect(url).not.toContain('wedding=')
  })

  test('builds a one-time resume path without wedding identity', () => {
    const handoff = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    expect(buildInvitationResumePath(handoff)).toBe(
      `/invite/resume?h=${handoff}`,
    )
  })

  test('rejects malformed deferred handoff values', () => {
    expect(isValidInvitationHandoffSecret('A'.repeat(43))).toBe(true)
    expect(isValidInvitationHandoffSecret('A'.repeat(42))).toBe(false)
    expect(isValidInvitationHandoffSecret('A'.repeat(44))).toBe(false)
    expect(isValidInvitationHandoffSecret('A'.repeat(42) + '!')).toBe(false)
    expect(() => buildPlayStoreInstallUrl('not-valid')).toThrow()
    expect(() => buildInvitationResumePath('not-valid')).toThrow()
  })
})
