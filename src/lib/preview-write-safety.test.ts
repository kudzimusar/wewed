import { describe, expect, test } from 'bun:test'
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
})
