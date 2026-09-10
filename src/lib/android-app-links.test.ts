import { describe, expect, test } from 'bun:test'
import {
  ANDROID_APP_LINK_RELATION,
  buildAndroidAssetLinks,
  parseAndroidAppLinkFingerprints,
  WEWED_ANDROID_PACKAGE_NAME,
} from './android-app-links'

const FIRST = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99'
const SECOND = '10:20:30:40:50:60:70:80:90:A0:B0:C0:D0:E0:F0:01:12:23:34:45:56:67:78:89:9A:AB:BC:CD:DE:EF:F1:02'

describe('Android Digital Asset Links', () => {
  test('fails closed when the Play signing fingerprint is absent', () => {
    expect(buildAndroidAssetLinks('')).toEqual([])
    expect(buildAndroidAssetLinks('not-a-certificate')).toEqual([])
  })

  test('normalizes, validates and de-duplicates SHA-256 certificate fingerprints', () => {
    expect(parseAndroidAppLinkFingerprints(`${FIRST.toLowerCase()}, ${FIRST}\n${SECOND}`)).toEqual([FIRST, SECOND])
  })

  test('publishes only the Wewed package and handle-all-urls relation', () => {
    expect(buildAndroidAssetLinks(FIRST)).toEqual([
      {
        relation: [ANDROID_APP_LINK_RELATION],
        target: {
          namespace: 'android_app',
          package_name: WEWED_ANDROID_PACKAGE_NAME,
          sha256_cert_fingerprints: [FIRST],
        },
      },
    ])
    expect(WEWED_ANDROID_PACKAGE_NAME).toBe('pro.wewed.app')
  })
})
