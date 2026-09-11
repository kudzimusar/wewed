import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const SHA256_FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/
const assetLinks = JSON.parse(readFileSync('public/.well-known/assetlinks.json', 'utf8')) as Array<{
  relation?: string[]
  target?: {
    namespace?: string
    package_name?: string
    sha256_cert_fingerprints?: string[]
  }
}>

describe('Android Digital Asset Links', () => {
  test('publishes an Android application association for the stable Wewed Play identity', () => {
    expect(assetLinks.length).toBeGreaterThan(0)
    const association = assetLinks.find((entry) => entry.target?.package_name === 'pro.wewed.app')
    expect(association).toBeDefined()
    expect(association?.relation).toContain('delegate_permission/common.handle_all_urls')
    expect(association?.target?.namespace).toBe('android_app')
  })

  test('contains only valid, unique SHA-256 signing certificate fingerprints', () => {
    const association = assetLinks.find((entry) => entry.target?.package_name === 'pro.wewed.app')
    const fingerprints = association?.target?.sha256_cert_fingerprints ?? []
    expect(fingerprints.length).toBeGreaterThan(0)
    expect(new Set(fingerprints).size).toBe(fingerprints.length)
    for (const fingerprint of fingerprints) {
      expect(fingerprint).toBe(fingerprint.toUpperCase())
      expect(SHA256_FINGERPRINT.test(fingerprint)).toBe(true)
    }
  })

  test('does not delegate URL handling to an unrelated Android package', () => {
    for (const entry of assetLinks) {
      expect(entry.target?.package_name).toBe('pro.wewed.app')
    }
  })
})
