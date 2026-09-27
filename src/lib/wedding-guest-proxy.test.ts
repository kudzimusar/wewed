import { describe, expect, mock, test } from 'bun:test'

mock.module('server-only', () => ({}))
process.env.WEWED_SESSION_SECRET ??= 'wedding-guest-proxy-test-only'

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

  test('QRO06: only the exact Guest browser handoff routes and methods bypass dashboard auth', async () => {
    const { proxy } = await import('@/proxy')
    const { NextRequest } = await import('next/server')
    const blocked = async (method: string, path: string) =>
      (await proxy(new NextRequest(`http://localhost${path}`, { method })))?.status === 401
    expect(await blocked('POST', '/api/weddings/w/guest-browser-handoff')).toBe(false)
    expect(await blocked('GET', '/api/weddings/w/guest-browser-handoff/redeem')).toBe(false)
    for (const [method, path] of [
      ['GET', '/api/weddings/w/guest-browser-handoff'],
      ['POST', '/api/weddings/w/guest-browser-handoff/redeem'],
      ['POST', '/api/weddings/w/guest-browser-handoff/extra'],
      ['GET', '/api/weddings/w/guest-browser-handoff/redeem/x'],
      ['GET', '/api/weddings/w/guests'],
    ]) {
      expect(await blocked(method, path)).toBe(true)
    }
  })
})
