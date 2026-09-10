/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  buildInvitationContinuePath,
  buildSmartInvitationUrl,
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
})
