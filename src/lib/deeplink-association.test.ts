import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { GET as getAssetLinks, ANDROID_PACKAGE_NAME, PLAY_SIGNING_SHA256 } from '@/app/.well-known/assetlinks.json/route'
import { GET as getAasa } from '@/app/.well-known/apple-app-site-association/route'
import { GET as getRootAasa } from '@/app/apple-app-site-association/route'
import { WEWED_IOS_BUNDLE_ID, buildAppleAppSiteAssociation } from '@/lib/apple-app-site-association'

describe('Deep-link and release identity server contract', () => {
  test('serves deterministic Android assetlinks.json with exact package and certificate fingerprints', async () => {
    const response = getAssetLinks()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(response.headers.get('Cache-Control')).toContain('public')

    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(1)

    const statement = body.find((s: any) => s.target?.package_name === ANDROID_PACKAGE_NAME)
    expect(statement).toBeDefined()
    expect(statement.relation).toContain('delegate_permission/common.handle_all_urls')
    expect(statement.target.namespace).toBe('android_app')
    expect(statement.target.package_name).toBe('pro.wewed.app')
    expect(statement.target.sha256_cert_fingerprints).toEqual([PLAY_SIGNING_SHA256])
  })

  test('public/.well-known/assetlinks.json matches the route handler contract', () => {
    const fileContent = JSON.parse(readFileSync('public/.well-known/assetlinks.json', 'utf8'))
    const statement = fileContent.find((s: any) => s.target?.package_name === 'pro.wewed.app')
    expect(statement).toBeDefined()
    expect(statement.target.sha256_cert_fingerprints).toEqual([PLAY_SIGNING_SHA256])
  })

  test('Apple App Site Association fails closed (404) when prefix is unset', async () => {
    const original = process.env.WEWED_APPLE_APPLICATION_IDENTIFIER_PREFIX
    delete process.env.WEWED_APPLE_APPLICATION_IDENTIFIER_PREFIX
    try {
      const response = getAasa()
      expect(response.status).toBe(404)
      expect(response.headers.get('Cache-Control')).toBe('no-store')

      const rootResponse = getRootAasa()
      expect(rootResponse.status).toBe(404)
    } finally {
      if (original) {
        process.env.WEWED_APPLE_APPLICATION_IDENTIFIER_PREFIX = original
      }
    }
  })

  test('Apple App Site Association generates valid contract with exact bundle ID and paths when prefix is set', async () => {
    const testPrefix = 'TEAM123456'
    process.env.WEWED_APPLE_APPLICATION_IDENTIFIER_PREFIX = testPrefix
    try {
      const response = getAasa()
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('application/json')
      expect(response.headers.get('Cache-Control')).toContain('public')

      const body = await response.json()
      expect(body.applinks).toBeDefined()
      expect(body.applinks.details[0].appIDs).toEqual([`${testPrefix}.${WEWED_IOS_BUNDLE_ID}`])

      const paths = body.applinks.details[0].components.map((c: any) => c['/'])
      expect(paths).toContain('/invite/*')
      expect(paths).not.toContain('/i/*')
      expect(paths).toContain('/w/*')
      expect(paths).toContain('/pass')
      expect(paths).toContain('/pass/*')
      expect(paths).toContain('/gate/*')
      expect(paths).toContain('/planner/*')
      expect(paths).toContain('/vendor/*')
      expect(paths).toContain('/wedding/*')

      // Root route /apple-app-site-association behaves identically
      const rootResponse = getRootAasa()
      expect(rootResponse.status).toBe(200)
      const rootBody = await rootResponse.json()
      expect(rootBody).toEqual(body)
    } finally {
      delete process.env.WEWED_APPLE_APPLICATION_IDENTIFIER_PREFIX
    }
  })
})
