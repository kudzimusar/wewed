import { describe, expect, test } from 'bun:test'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('wedding guest API proxy boundary', () => {
  test('guest session and exchange routes bypass dashboard authentication only', async () => {
    const proxy = await source('src/proxy.ts')

    expect(proxy).toContain('function isGuestWeddingSessionRoute')
    expect(proxy).toContain('/^\\/api\\/weddings\\/[^/]+\\/guest-session(?:\\/exchange)?$/')
    expect(proxy).toContain('if (isGuestWeddingSessionRoute(pathname)) return false')
    expect(proxy).toContain("if (pathname.startsWith('/api/weddings/')) return true")
    expect(proxy.indexOf('isGuestWeddingSessionRoute(pathname)')).toBeLessThan(
      proxy.indexOf("pathname.startsWith('/api/weddings/')"),
    )
  })
})
