/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test'
import {
  buildAndroidInvitationIntentUrl,
  buildInvitationContinuePath,
  buildInvitationResumePath,
  buildPhysicalInvitationResumePath,
  buildPhysicalPlayStoreInstallUrl,
  buildPlayStoreInstallUrl,
  buildSmartInvitationUrl,
  isValidInvitationHandoffSecret,
  isValidPhysicalInvitationHandoff,
  resolveAndroidIntentPackage,
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

  test('puts only an opaque personal handoff into the Google Play referrer', () => {
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

  test('puts the encrypted shared physical handoff in its own Play referrer key', () => {
    const handoff = `p1.${'A'.repeat(120)}`
    expect(isValidPhysicalInvitationHandoff(handoff)).toBe(true)
    const url = buildPhysicalPlayStoreInstallUrl(handoff)
    const play = new URL(url)
    expect(play.searchParams.get('id')).toBe('pro.wewed.app')
    const referrer = new URLSearchParams(play.searchParams.get('referrer') || '')
    expect([...referrer.keys()]).toEqual(['physical_handoff'])
    expect(referrer.get('physical_handoff')).toBe(handoff)
    expect(url).not.toContain('rsvp=')
    expect(url).not.toContain('guest=')
    expect(url).not.toContain('email=')
  })

  test('builds personal and physical resume paths without wedding identity', () => {
    const personal = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const physical = `p1.${'B'.repeat(120)}`
    expect(buildInvitationResumePath(personal)).toBe(`/invite/resume?h=${personal}`)
    expect(buildPhysicalInvitationResumePath(physical)).toBe(
      `/invite/physical-resume?h=${physical}`,
    )
  })


  test('keeps installed Android invitation handoff on the active Wewed origin', () => {
    const handoff = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const path = buildInvitationResumePath(handoff)

    const uat = buildAndroidInvitationIntentUrl({
      origin: 'https://uat.wewed.pro',
      appResumePath: path,
      fallbackUrl: 'https://uat.wewed.pro/invite/example/open',
    })
    expect(uat).toBe(
      `intent://invite/resume#Intent;scheme=wewed;package=pro.wewed.app;S.wewed_handoff=${handoff};S.browser_fallback_url=${encodeURIComponent('https://uat.wewed.pro/invite/example/open')};end`,
    )
    expect(uat).not.toContain('rsvp=')
    expect(uat).not.toContain('guest=')
    expect(uat).not.toContain('email=')
    expect(uat).not.toContain('wedding=')

    const production = buildAndroidInvitationIntentUrl({
      origin: 'https://wewed.pro',
      appResumePath: path,
      fallbackUrl: 'https://wewed.pro/invite/example/open',
    })
    expect(production).toContain('intent://invite/resume#Intent;scheme=wewed;')
    expect(production).toContain(`S.wewed_handoff=${handoff}`)
    expect(production).toContain(
      `S.browser_fallback_url=${encodeURIComponent('https://wewed.pro/invite/example/open')}`,
    )
  })

  test('rejects cross-origin Android invitation resume construction', () => {
    const handoff = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    expect(() =>
      buildAndroidInvitationIntentUrl({
        origin: 'https://uat.wewed.pro',
        appResumePath: `https://wewed.pro/invite/resume?h=${handoff}`,
        fallbackUrl: 'https://uat.wewed.pro/invite/example/open',
      }),
    ).toThrow('current Wewed origin')
  })

  test('targets the Play package unless a local UAT intent package is explicitly allowed', () => {
    expect(resolveAndroidIntentPackage(undefined, undefined)).toBe('pro.wewed.app')
    expect(resolveAndroidIntentPackage('', 'preview')).toBe('pro.wewed.app')
    expect(resolveAndroidIntentPackage('pro.wewed.app.uatdev', undefined)).toBe('pro.wewed.app.uatdev')
    expect(resolveAndroidIntentPackage(' pro.wewed.app.uatdev ', 'preview')).toBe('pro.wewed.app.uatdev')
    expect(resolveAndroidIntentPackage('pro.wewed.app.dev', undefined)).toBe('pro.wewed.app')
    expect(resolveAndroidIntentPackage('com.attacker.app', undefined)).toBe('pro.wewed.app')
    expect(resolveAndroidIntentPackage('pro.wewed.app.uatdev', 'production')).toBe('pro.wewed.app')
  })

  test('rejects malformed deferred handoff values', () => {
    expect(isValidInvitationHandoffSecret('A'.repeat(43))).toBe(true)
    expect(isValidInvitationHandoffSecret('A'.repeat(42))).toBe(false)
    expect(isValidInvitationHandoffSecret('A'.repeat(44))).toBe(false)
    expect(isValidInvitationHandoffSecret('A'.repeat(42) + '!')).toBe(false)
    expect(isValidPhysicalInvitationHandoff(`p1.${'A'.repeat(80)}`)).toBe(true)
    expect(isValidPhysicalInvitationHandoff(`p1.${'A'.repeat(79)}`)).toBe(false)
    expect(isValidPhysicalInvitationHandoff(`p1.${'A'.repeat(513)}`)).toBe(false)
    expect(() => buildPlayStoreInstallUrl('not-valid')).toThrow()
    expect(() => buildInvitationResumePath('not-valid')).toThrow()
    expect(() => buildPhysicalPlayStoreInstallUrl('not-valid')).toThrow()
    expect(() => buildPhysicalInvitationResumePath('not-valid')).toThrow()
  })
})
