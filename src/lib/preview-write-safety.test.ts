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
