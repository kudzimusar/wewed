import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { shouldBlockPreviewWrite } from '@/lib/preview-write-safety'

const LIVE_WEDDING_ID = 'live-wedding'
const UAT_WEDDING_ID = 'uat-wedding'

describe('preview write safety', () => {
  test('keeps preview reads available', () => {
    expect(
      shouldBlockPreviewWrite({
        method: 'GET',
        weddingId: LIVE_WEDDING_ID,
        vercelEnvironment: 'preview',
      }),
    ).toBe(false)
  })

  test('blocks preview mutations when no UAT wedding is allow-listed', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(
        shouldBlockPreviewWrite({
          method,
          weddingId: LIVE_WEDDING_ID,
          vercelEnvironment: 'preview',
        }),
      ).toBe(true)
    }
  })

  test('does not treat a legacy PR branch name as write authorization', () => {
    expect(
      shouldBlockPreviewWrite({
        method: 'POST',
        weddingId: 'wewed-pr202-uat-20260912',
        vercelEnvironment: 'preview',
        gitCommitRef: 'feature/private-invitation-android-delivery-20260912',
      }),
    ).toBe(true)
  })

  test('blocks a live wedding even when another preview wedding is allow-listed', () => {
    expect(
      shouldBlockPreviewWrite({
        method: 'PATCH',
        weddingId: LIVE_WEDDING_ID,
        vercelEnvironment: 'preview',
        writablePreviewWeddingId: UAT_WEDDING_ID,
      }),
    ).toBe(true)
  })

  test('allows mutations only for the exact preview UAT wedding', () => {
    expect(
      shouldBlockPreviewWrite({
        method: 'POST',
        weddingId: UAT_WEDDING_ID,
        vercelEnvironment: 'preview',
        writablePreviewWeddingId: UAT_WEDDING_ID,
      }),
    ).toBe(false)
  })

  test('does not change production, local, or CI mutation behavior', () => {
    for (const vercelEnvironment of ['production', 'development', undefined]) {
      expect(
        shouldBlockPreviewWrite({
          method: 'DELETE',
          weddingId: LIVE_WEDDING_ID,
          vercelEnvironment,
        }),
      ).toBe(false)
    }
  })

  test('is enforced centrally by the wedding permission boundary', () => {
    const source = readFileSync('src/lib/wedding-access.ts', 'utf8')
    expect(source).toContain('shouldBlockPreviewWrite({')
    expect(source).toContain("code: 'PREVIEW_WRITE_BLOCKED'")
    expect(source).toContain('status: 423')
    expect(source).toContain("'x-wewed-preview-write-blocked': 'true'")
  })
})

import { previewWriteError } from '@/lib/preview-write-response'
import { previewWeddingMutationBlocked } from '@/lib/preview-write-safety'

test('guest mutation response permits only the configured wedding and fails closed', async () => {
  const previousEnvironment = process.env.VERCEL_ENV
  const previousWedding = process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID
  try {
    process.env.VERCEL_ENV = 'preview'
    process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID = UAT_WEDDING_ID
    expect(previewWriteError(UAT_WEDDING_ID)).toBeNull()
    const blocked = previewWriteError(LIVE_WEDDING_ID)!
    expect(blocked.status).toBe(423)
    expect(blocked.headers.get('x-wewed-preview-write-blocked')).toBe('true')
    expect(await blocked.json()).toMatchObject({ success: false, code: 'PREVIEW_WRITE_BLOCKED' })
    expect(previewWeddingMutationBlocked(LIVE_WEDDING_ID)).toBe(true)
    delete process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID
    expect(previewWriteError(UAT_WEDDING_ID)?.status).toBe(423)
  } finally {
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousEnvironment
    if (previousWedding === undefined) delete process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID
    else process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID = previousWedding
  }
})

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P13-LIVE-1 regression guard. Preview shares the live database, so a new wedding-scoped writer
 * must not be able to appear without the Preview backstop. Every exported function in the Wedding
 * Day / Wedding Pass / Gate domain modules whose body issues a write statement must call
 * `assertPreviewWeddingMutationAllowed`, and every non-GET handler under /api/native must reference
 * a Preview guard (directly or through `requireWeddingPermission`).
 */
const WRITE_STATEMENT = /INSERT INTO|UPDATE public\.|DELETE FROM|\$executeRaw|\btx\.[a-zA-Z]+\.(create|update|upsert|delete)/

function exportedFunctionBodies(source: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = []
  const header = /^export async function (\w+)\(/gm
  let match: RegExpExecArray | null
  while ((match = header.exec(source))) {
    const next = source.slice(match.index + match[0].length).search(/^(export |function |async function |const [A-Z_]+ =)/m)
    const body = next === -1 ? source.slice(match.index) : source.slice(match.index, match.index + match[0].length + next)
    out.push({ name: match[1], body })
  }
  return out
}

describe('P13-LIVE-1 Preview backstop coverage', () => {
  for (const file of ['src/lib/wedding-day.ts', 'src/lib/gate-authority.ts', 'src/lib/wedding-pass-attendance.ts']) {
    test(`every exported writer in ${file} calls the Preview backstop`, () => {
      const writers = exportedFunctionBodies(readFileSync(file, 'utf8')).filter(({ body }) => WRITE_STATEMENT.test(body))
      expect(writers.length).toBeGreaterThan(0)
      const unguarded = writers.filter(({ body }) => !body.includes('assertPreviewWeddingMutationAllowed(')).map(({ name }) => name)
      expect(unguarded).toEqual([])
    })
  }

  test('the shared Guest RSVP mutation refuses Preview writes itself', () => {
    const source = readFileSync('src/lib/guest-rsvp-mutation.ts', 'utf8')
    expect(source).toContain('previewWeddingMutationBlocked(weddingId)')
    expect(source).toContain("code: 'PREVIEW_WRITE_BLOCKED', status: 423")
  })

  test('every non-GET /api/native handler references a Preview guard', () => {
    const routes: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) walk(path)
        else if (entry === 'route.ts') routes.push(path)
      }
    }
    walk('src/app/api/native')
    const guard = /shouldBlockPreviewWrite|previewWriteError|requireWeddingPermission|assertPreviewWeddingMutationAllowed/
    // POST handlers that write nothing. The exemption is itself verified: the route must stay
    // free of write statements, so adding a write later re-opens this gate.
    const WRITE_FREE_POST = new Set([join('src/app/api/native/account/signin/route.ts')])
    for (const path of WRITE_FREE_POST) {
      const source = readFileSync(path, 'utf8')
      expect(/\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\(|INSERT INTO|UPDATE public|DELETE FROM|\$executeRaw/.test(source)).toBe(false)
    }
    const unguarded = routes.filter((path) => {
      const source = readFileSync(path, 'utf8')
      return /export (async )?function (POST|PUT|PATCH|DELETE)\b/.test(source) && !guard.test(source) && !WRITE_FREE_POST.has(path)
    })
    expect(routes.length).toBeGreaterThan(20)
    expect(unguarded).toEqual([])
  })

  test('Preview sign-in never performs account bookkeeping or unscoped invitation acceptance', () => {
    for (const route of ['signin', 'me', 'wedding']) {
      expect(readFileSync(`src/app/api/auth/${route}/route.ts`, 'utf8')).toContain('previewAccountBookkeepingSuppressed()')
    }
    expect(readFileSync('src/lib/wedding-access.ts', 'utf8')).toContain('pendingMembershipAcceptanceScope()')
  })
})
