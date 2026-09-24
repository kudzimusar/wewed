import { describe, expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

mock.module('server-only', () => ({}))

process.env.WEWED_SESSION_SECRET = 'phase12-test-session-secret-key-at-least-32-chars'

import { NextRequest } from 'next/server'

let createAppSessionToken: typeof import('@/lib/app-session')['createAppSessionToken']
let APP_SESSION_COOKIE: typeof import('@/lib/app-session')['APP_SESSION_COOKIE']

async function getSessionHelpers() {
  if (!createAppSessionToken) {
    const mod = await import('@/lib/app-session')
    createAppSessionToken = mod.createAppSessionToken
    APP_SESSION_COOKIE = mod.APP_SESSION_COOKIE
  }
  return { createAppSessionToken, APP_SESSION_COOKIE }
}

async function createValidSessionToken(
  role: 'admin' | 'couple' | 'planner' | 'vendor',
  opts: { userId?: string; coupleId?: string | null; activeWeddingId?: string } = {},
) {
  const { createAppSessionToken } = await getSessionHelpers()
  return createAppSessionToken({
    userId: opts.userId ?? `${role}-user-1`,
    authUserId: `auth-${role}-1`,
    email: `${role}@example.test`,
    role,
    coupleId: opts.coupleId ?? (role === 'couple' ? 'couple-1' : null),
    activeWeddingId: opts.activeWeddingId ?? 'wedding-1',
  })
}

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Phase 12: Single-Tenant and Unsafe PWA Remnants Remediation', () => {

  // ── Invariant 1: Root & Shared APIs Fail Closed Without Context ──────────
  describe('Invariant 1: Root route and shared APIs fail closed without wedding context', () => {
    test('root page renders platform home and does NOT redirect ?rsvp=token to charity-and-kudzie', () => {
      const pageSource = source('src/app/page.tsx')
      expect(pageSource).not.toContain("redirect('/w/charity-and-kudzie")
      expect(pageSource).not.toContain('charity-and-kudzie')
    })

    test('GET /api/wedding fails closed (400) without slug', async () => {
      const { GET } = await import('@/app/api/wedding/route')
      const req = new NextRequest('http://localhost/api/wedding')
      const res = await GET(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ success: false, error: 'Wedding slug is required.' })
    })

    test('GET /api/wedding-content fails closed (400) without slug', async () => {
      const { GET } = await import('@/app/api/wedding-content/route')
      const req = new NextRequest('http://localhost/api/wedding-content')
      const res = await GET(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ success: false, error: 'Wedding slug is required.' })
    })

    test('GET /api/comments fails closed (400) without wedding slug or id', async () => {
      const { GET } = await import('@/app/api/comments/route')
      const req = new NextRequest('http://localhost/api/comments')
      const res = await GET(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ success: false, error: 'weddingSlug or weddingId is required.' })
    })

    test('POST /api/comments fails closed (400) without wedding slug or id', async () => {
      const { POST } = await import('@/app/api/comments/route')
      const req = new NextRequest('http://localhost/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName: 'Guest', content: 'Best wishes!' }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ success: false, error: 'weddingSlug or weddingId is required.' })
    })

    test('GET /api/content fails closed (400) without weddingId', async () => {
      const { APP_SESSION_COOKIE } = await getSessionHelpers()
      const { GET } = await import('@/app/api/content/route')
      const adminCookie = await createValidSessionToken('admin')
      const req = new NextRequest('http://localhost/api/content', {
        headers: { cookie: `${APP_SESSION_COOKIE}=${adminCookie}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ success: false, error: 'weddingId is required' })
    })

    test('POST /api/content fails closed (400) without weddingId', async () => {
      const { APP_SESSION_COOKIE } = await getSessionHelpers()
      const { POST } = await import('@/app/api/content/route')
      const adminCookie = await createValidSessionToken('admin')
      const req = new NextRequest('http://localhost/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${APP_SESSION_COOKIE}=${adminCookie}`,
        },
        body: JSON.stringify({
          section: 'our-story',
          fieldKey: 'title',
          value: 'Our Story',
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ success: false, error: 'weddingId is required' })
    })

    test('GET /api/privacy fails closed (400) without slug', async () => {
      const { GET } = await import('@/app/api/privacy/route')
      const req = new NextRequest('http://localhost/api/privacy')
      const res = await GET(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ success: false, error: 'slug is required' })
    })
  })

  // ── Invariant 2: Comments Fail Closed Without Wedding Context ─────────────
  describe('Invariant 2: Comments fail closed without explicit wedding slug or id', () => {
    test('comments route source has no hardcoded WEDDING_SLUG', () => {
      const commentsSource = source('src/app/api/comments/route.ts')
      expect(commentsSource).not.toContain("const WEDDING_SLUG = 'charity-and-kudzie'")
      expect(commentsSource).not.toContain("const WEDDING_SLUG = \"charity-and-kudzie\"")
      expect(commentsSource).not.toContain("|| 'charity-and-kudzie'")
    })
  })

  // ── Invariant 2b: Comment reply relationships remain wedding-scoped ──────
  describe('Invariant 2b: comment replies cannot cross wedding boundaries', () => {
    test('parent comments are checked against the resolved wedding before reply creation', () => {
      const commentsSource = source('src/app/api/comments/route.ts')
      expect(commentsSource).toContain('select: { id: true, weddingId: true, targetType: true, targetId: true }')
      expect(commentsSource).toContain('parent.weddingId !== wedding.id')
    })
  })

  // ── Invariant 3: Contributions & Royalty Require Explicit Slug ────────────
  describe('Invariant 3: Contributions and royalty endpoints require explicit slug', () => {
    test('GET /api/contributions fails closed (400) without slug', async () => {
      const { APP_SESSION_COOKIE } = await getSessionHelpers()
      const { GET } = await import('@/app/api/contributions/route')
      const adminCookie = await createValidSessionToken('admin')
      const req = new NextRequest('http://localhost/api/contributions', {
        headers: { cookie: `${APP_SESSION_COOKIE}=${adminCookie}` },
      })
      const res = await GET(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ success: false, error: 'Wedding slug is required.' })
    })

    test('POST /api/contributions fails closed (400) without slug', async () => {
      const { APP_SESSION_COOKIE } = await getSessionHelpers()
      const { POST } = await import('@/app/api/contributions/route')
      const adminCookie = await createValidSessionToken('admin')
      const req = new NextRequest('http://localhost/api/contributions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${APP_SESSION_COOKIE}=${adminCookie}`,
        },
        body: JSON.stringify({ amount: 100 }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data).toEqual({ success: false, error: 'Wedding slug is required.' })
    })

    test('contributions route has no named-wedding special case and binds requested slug to active wedding authority', () => {
      const contribSource = source('src/app/api/contributions/route.ts')
      expect(contribSource).not.toContain('FLAGSHIP_SLUG')
      expect(contribSource).not.toContain("wedding.slug === 'charity-and-kudzie'")
      expect(contribSource).not.toContain('wedding.slug === "charity-and-kudzie"')
      expect(contribSource).toContain('requireWeddingPermission(request, "content.edit")')
      expect(contribSource).toContain('requireWeddingPermission(request, "guests.edit")')
      expect(contribSource).toContain('wedding.id !== access.context.weddingId')
    })

    test('all 7 royalty route sources have no FLAGSHIP_SLUG declarations', () => {
      const royaltyFiles = [
        'src/app/api/royalty/route.ts',
        'src/app/api/royalty/payout/route.ts',
        'src/app/api/royalty/payout-account/route.ts',
        'src/app/api/royalty/dispute/route.ts',
        'src/app/api/royalty/revenue-event/route.ts',
        'src/app/api/royalty/ledger/route.ts',
        'src/app/api/royalty/preferences/route.ts',
      ]
      for (const file of royaltyFiles) {
        const fileSource = source(file)
        expect(fileSource).not.toContain('FLAGSHIP_SLUG')
        expect(fileSource).not.toContain("|| 'charity-and-kudzie'")
        expect(fileSource).not.toContain('|| "charity-and-kudzie"')
      }
    })
  })

  // ── Invariant 4: Seed Routes Reject Anonymous & Non-Platform-Admin ────────
  describe('Invariant 4: /api/seed and /api/wedding-content/seed reject unauthorized callers and cannot execute in production', () => {
    test('POST /api/seed rejects anonymous caller with 401', async () => {
      const { POST } = await import('@/app/api/seed/route')
      const req = new NextRequest('http://localhost/api/seed', { method: 'POST' })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    test('POST /api/wedding-content/seed rejects anonymous caller with 401', async () => {
      const { POST } = await import('@/app/api/wedding-content/seed/route')
      const req = new NextRequest('http://localhost/api/wedding-content/seed', { method: 'POST' })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    test('POST /api/seed rejects ordinary couple/guest/planner with 403', async () => {
      const { APP_SESSION_COOKIE } = await getSessionHelpers()
      const { POST } = await import('@/app/api/seed/route')
      const coupleCookie = await createValidSessionToken('couple')
      const req = new NextRequest('http://localhost/api/seed', {
        method: 'POST',
        headers: { cookie: `${APP_SESSION_COOKIE}=${coupleCookie}` },
      })
      const res = await POST(req)
      expect(res.status).toBe(403)
    })

    test('POST /api/wedding-content/seed rejects ordinary couple/guest/planner with 403', async () => {
      const { APP_SESSION_COOKIE } = await getSessionHelpers()
      const { POST } = await import('@/app/api/wedding-content/seed/route')
      const plannerCookie = await createValidSessionToken('planner')
      const req = new NextRequest('http://localhost/api/wedding-content/seed', {
        method: 'POST',
        headers: { cookie: `${APP_SESSION_COOKIE}=${plannerCookie}` },
      })
      const res = await POST(req)
      expect(res.status).toBe(403)
    })

    test('both seed routes guard against production execution', () => {
      const seedSource = source('src/app/api/seed/route.ts')
      const wcSeedSource = source('src/app/api/wedding-content/seed/route.ts')

      for (const src of [seedSource, wcSeedSource]) {
        expect(src).toContain('isProductionRuntime()')
        expect(src).toContain("NODE_ENV === \"production\"")
        expect(src).toContain("Database seeding is disabled in production.")
      }
    })
  })

  // ── Invariant 5: Physical Invitation Bootstrap Route Retired ──────────────
  describe('Invariant 5: Physical invitation bootstrap route returns 410 with zero database mutations', () => {
    test('GET /api/internal/bootstrap-physical-invitation returns 410 Gone', async () => {
      const { GET } = await import('@/app/api/internal/bootstrap-physical-invitation/route')
      const res = await GET()
      expect(res.status).toBe(410)
    })

    test('POST /api/internal/bootstrap-physical-invitation returns 410 Gone', async () => {
      const { POST } = await import('@/app/api/internal/bootstrap-physical-invitation/route')
      const res = await POST()
      expect(res.status).toBe(410)
    })

    test('bootstrap route source has zero DB calls and zero hardcoded slugs', () => {
      const bootstrapSource = source(
        'src/app/api/internal/bootstrap-physical-invitation/route.ts',
      )
      expect(bootstrapSource).not.toContain('db.')
      expect(bootstrapSource).not.toContain('prisma')
      expect(bootstrapSource).not.toContain('charity-and-kudzie')
      expect(bootstrapSource).not.toContain('QRDestination')
    })
  })

  // ── Invariant 6: Legacy Admin Receives [] and null Without Membership ─────
  describe('Invariant 6: Legacy admin receives [] from listAccessibleWeddings and null from getWeddingContext', () => {
    test('wedding-access.ts contains no globalRole === admin or session.role === admin bypass', () => {
      const accessSource = source('src/lib/wedding-access.ts')
      expect(accessSource).not.toContain("globalRole === 'admin'")
      expect(accessSource).not.toContain("session.role === 'admin'")
      expect(accessSource).not.toContain("'admin'::text AS \"membershipRole\"")
    })
  })

  // ── Invariant 7: Genuine Platform Admin Multi-Tenant Governance ───────────
  describe('Invariant 7: Platform admin cannot silently inherit ambient tenant data', () => {
    test('platform admin routes enforce explicit business and admin workspace grants', () => {
      const wewedAdminSource = source('src/lib/wewed-admin.ts')
      expect(wewedAdminSource).toContain('requireWewedAdmin')
      expect(wewedAdminSource).toContain('readPlatformRegistry')
      expect(wewedAdminSource).toContain('hasWewedAdminPermission')
    })

    test('legacy admin role cannot bypass active-wedding authority on content mutation routes', () => {
      const contentSource = source('src/app/api/content/route.ts')
      const weddingContentSource = source('src/app/api/wedding-content/route.ts')
      expect(contentSource).toContain("requireWeddingPermission(request, 'content.edit')")
      expect(contentSource).toContain('weddingId !== access.context.weddingId')
      expect(weddingContentSource).toContain("requireWeddingPermission(request, 'content.edit')")
      expect(weddingContentSource).not.toContain("session.role === 'admin'")
      expect(weddingContentSource).toContain('wedding.id !== access.context.weddingId')
    })
  })

  // ── Invariant 8: Multi-Wedding Separation Intact ───────────────────────────
  describe('Invariant 8: Multi-wedding separation remains intact with zero leaks', () => {
    test('inline-content-db.ts has no hardcoded WEDDING_SLUG', () => {
      const inlineSource = source('src/lib/inline-content-db.ts')
      expect(inlineSource).not.toContain("const WEDDING_SLUG = 'charity-and-kudzie'")
      expect(inlineSource).not.toContain("const WEDDING_SLUG = \"charity-and-kudzie\"")
      expect(inlineSource).toContain('weddingSlug')
    })

    test('admin-dashboard.tsx has no hardcoded couple greeting', () => {
      const dashboardSource = source('src/components/wedding/admin-dashboard.tsx')
      expect(dashboardSource).not.toContain("'Welcome back, Charity & Kudzie'")
      expect(dashboardSource).not.toContain('"Welcome back, Charity & Kudzie"')
      expect(dashboardSource).toContain("wedding?.title || 'Couple'")
    })

    test('preview and uat invitation pages are guarded against production', () => {
      const previewSource = source(
        'src/app/preview/invitation/ivory-floral-gold/page.tsx',
      )
      const uatSource = source(
        'src/app/uat/invitation/ivory-floral-gold/page.tsx',
      )

      for (const src of [previewSource, uatSource]) {
        expect(src).toContain("NODE_ENV === 'production'")
        expect(src).toContain("VERCEL_ENV === 'production'")
        expect(src).toContain('notFound()')
      }
    })
  })

  // ── Invariant 9: Guest Invariants Intact ───────────────────────────────────
  describe('Invariant 9: Guest invitation and session invariants remain untouched', () => {
    test('guest session cookie and exchange routes are intact', () => {
      const guestSession = source('src/lib/wedding-guest-session.ts')
      expect(guestSession).toContain("WEDDING_GUEST_SESSION_COOKIE = 'wewed_wedding_guest'")
      expect(guestSession).toContain('httpOnly: true')
      expect(guestSession).toContain("sameSite: 'lax'")
    })
  })

  // ── Invariant 10: Native-Facing APIs Have Zero Single-Tenant Fallbacks ────
  describe('Invariant 10: Native-facing mature APIs have zero single-tenant fallbacks', () => {
    test('mature shared APIs require explicit parameters and contain no Charity & Kudzie fallbacks', () => {
      const weddingRoute = source('src/app/api/wedding/route.ts')
      const weddingContentRoute = source('src/app/api/wedding-content/route.ts')
      const commentsRoute = source('src/app/api/comments/route.ts')

      expect(weddingRoute).not.toContain("|| 'charity-and-kudzie'")
      expect(weddingContentRoute).not.toContain("|| 'charity-and-kudzie'")
      expect(commentsRoute).not.toContain("|| 'charity-and-kudzie'")
    })
  })
})
