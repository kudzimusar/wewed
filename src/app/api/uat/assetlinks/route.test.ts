/// <reference types="bun-types" />

import { afterEach, describe, expect, test } from 'bun:test'
import { GET } from '@/app/api/uat/assetlinks/route'

const PLAY_APP_SIGNING = '32:16:B9:AE:56:44:F9:B5:B4:F8:C3:04:6A:6B:D6:BF:86:3E:A3:51:B3:2A:F3:AE:4B:32:27:99:B9:FE:DA:7B'
const LOCAL_DEBUG = '9C:6B:E8:80:7B:8B:9C:D9:5C:D5:DF:C3:60:11:DA:1D:0A:B9:4A:3A:80:23:E4:F0:7B:80:4C:12:44:B1:BC:53'
const ENV_KEYS = ['VERCEL_ENV', 'WEWED_PREVIEW_WRITABLE_WEDDING_ID', 'WEWED_UAT_ANDROID_SHA256'] as const
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

type Statement = { target: { package_name: string; sha256_cert_fingerprints: string[] } }

function usePr202Preview(localKeys?: string) {
  process.env.VERCEL_ENV = 'preview'
  process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID = 'wewed-pr202-uat-20260912'
  if (localKeys === undefined) delete process.env.WEWED_UAT_ANDROID_SHA256
  else process.env.WEWED_UAT_ANDROID_SHA256 = localKeys
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('PR #202 UAT asset links', () => {
  test('trust local UAT wrapper builds only through their own package and local keys', async () => {
    usePr202Preview(LOCAL_DEBUG)
    const statements = (await GET().json()) as Statement[]

    expect(statements.map((statement) => statement.target.package_name)).toEqual([
      'pro.wewed.app',
      'pro.wewed.app.uatdev',
    ])
    expect(statements[0].target.sha256_cert_fingerprints).toContain(PLAY_APP_SIGNING)
    expect(statements[1].target.sha256_cert_fingerprints).toEqual([LOCAL_DEBUG])
  })

  test('publish only the Play package when no local UAT key is configured', async () => {
    usePr202Preview()
    const statements = (await GET().json()) as Statement[]

    expect(statements.map((statement) => statement.target.package_name)).toEqual(['pro.wewed.app'])
  })

  test('never serve UAT asset links outside the PR #202 preview', () => {
    usePr202Preview(LOCAL_DEBUG)
    process.env.VERCEL_ENV = 'production'

    expect(GET().status).toBe(404)
  })
})
