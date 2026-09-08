import { describe, expect, it } from 'bun:test'
import {
  normalizeAiReportArea,
  normalizeAiSnapshot,
  normalizeOptionalSafetyText,
  normalizeSafetyReason,
} from '@/lib/safety-policy'

describe('safety report input policy', () => {
  it('normalizes supported reasons and AI product areas', () => {
    expect(normalizeSafetyReason(' spam ')).toBe('SPAM')
    expect(normalizeAiReportArea('notebook_ai')).toBe('NOTEBOOK_AI')
  })

  it('rejects invented reasons and product areas', () => {
    expect(() => normalizeSafetyReason('dislike')).toThrow('valid reason')
    expect(() => normalizeAiReportArea('arbitrary_page')).toThrow('cannot be reported')
  })

  it('bounds reviewer details and captured AI output', () => {
    expect(normalizeOptionalSafetyText('  context  ', 20, 'Details')).toBe('context')
    expect(() => normalizeOptionalSafetyText('x'.repeat(21), 20, 'Details')).toThrow('20 characters')
    expect(normalizeAiSnapshot('  answer  ')).toBe('answer')
    expect(() => normalizeAiSnapshot('x'.repeat(8001))).toThrow('8000 characters')
  })
})
