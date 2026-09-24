import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { GET as getWellKnownAasa } from '@/app/.well-known/apple-app-site-association/route'
import { GET as getRootAasa } from '@/app/apple-app-site-association/route'
import { buildAppleAppSiteAssociation } from '@/lib/apple-app-site-association'

const PLAY_SIGNING_SHA256 =
  '32:16:B9:AE:56:44:F9:B5:B4:F8:C3:04:6A:6B:D6:BF:86:3E:A3:51:B3:2A:F3:AE:4B:32:27:99:B9:FE:DA:7B'

afterEach(() => {
  delete process.env.WEWED_APPLE_APPLICATION_IDENTIFIER_PREFIX
})

describe('Phase 13 production association release candidate', () => {
  test('assetlinks delegates wewed.pro only to the Play-delivered Android signer', () => {
    const statements = JSON.parse(
      readFileSync('public/.well-known/assetlinks.json', 'utf8'),
    )

    expect(statements).toHaveLength(1)
    expect(statements[0].relation).toEqual([
      'delegate_permission/common.handle_all_urls',
    ])
    expect(statements[0].target).toEqual({
      namespace: 'android_app',
      package_name: 'pro.wewed.app',
      sha256_cert_fingerprints: [PLAY_SIGNING_SHA256],
    })
  })

  test('AASA advertises only native-owned routes and never intercepts the physical QR resolver', () => {
    const association = buildAppleAppSiteAssociation('ABCDE12345')
    const paths = association.applinks.details[0].components.map(
      (component) => component['/'],
    )

    expect(paths).toEqual(
      expect.arrayContaining([
        '/invite/*',
        '/w/*',
        '/pass',
        '/pass/*',
        '/planner/*',
        '/vendor/*',
        '/gate/*',
        '/wedding/*',
      ]),
    )
    expect(paths).not.toContain('/i/*')
  })

  test('root and well-known AASA endpoints are identical when the real prefix is configured', async () => {
    process.env.WEWED_APPLE_APPLICATION_IDENTIFIER_PREFIX = 'ABCDE12345'

    const wellKnown = getWellKnownAasa()
    const root = getRootAasa()

    expect(wellKnown.status).toBe(200)
    expect(root.status).toBe(200)
    expect(await root.json()).toEqual(await wellKnown.json())
  })

  test('AASA endpoints fail closed until the owner supplies a valid application identifier prefix', () => {
    expect(getWellKnownAasa().status).toBe(404)
    expect(getRootAasa().status).toBe(404)
  })
})
