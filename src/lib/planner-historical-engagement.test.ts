import { describe, expect, test } from 'bun:test'
import {
  HistoricalEngagementInputError,
  normalizeHistoricalEngagementInput,
  sumHistoricalPayments,
} from '@/lib/planner-historical-engagement'

describe('Phase 0 historical engagement contract', () => {
  test('normalizes truthful historical facts without creating contract history', () => {
    const input = normalizeHistoricalEngagementInput({
      vendorId: 'vendor-1',
      serviceCategory: 'Photography',
      serviceDescription: 'Wedding-day photography coverage',
      agreedAmount: '3500',
      currency: 'usd',
      serviceDate: '2026-12-20',
      externalAgreementStatus: 'exists',
      externalAgreementReference: 'Signed paper agreement held by planner',
      budgetItemIds: ['budget-1', 'budget-1', 'budget-2'],
      payments: [
        { amount: '1000', paidAt: '2026-07-01', method: 'bank transfer', reference: 'TX-001' },
        { amount: 500.5, paidAt: '2026-08-02', method: 'cash' },
      ],
    })

    expect(input.origin).toBe('historical')
    expect(input.recordMode).toBe('record_only')
    expect(input.currency).toBe('USD')
    expect(input.agreedAmount).toBe('3500.00')
    expect(input.budgetItemIds).toEqual(['budget-1', 'budget-2'])
    expect(input.payments[1].amount).toBe('500.50')
    expect(sumHistoricalPayments(input.payments)).toBe('1500.50')
    expect('acceptedAt' in input).toBe(false)
    expect('effectiveAt' in input).toBe(false)
  })

  test.each(['origin', 'recordMode', 'acceptedAt', 'effectiveAt', 'contractAcceptedAt', 'contractEffectiveAt'])(
    'rejects caller-supplied historical contract field %s',
    (field) => {
      expect(() => normalizeHistoricalEngagementInput({
        vendorId: 'vendor-1',
        serviceCategory: 'Decor',
        currency: 'USD',
        [field]: field.includes('At') ? '2026-01-01' : 'effective',
      })).toThrow(HistoricalEngagementInputError)
    },
  )

  test('permits unknown commercial terms instead of inventing them', () => {
    const input = normalizeHistoricalEngagementInput({
      vendorId: 'vendor-1',
      serviceCategory: 'Decor',
      currency: 'USD',
      agreedAmount: null,
      serviceDate: null,
      externalAgreementStatus: 'unknown',
      payments: [{ amount: '250.00' }],
    })

    expect(input.agreedAmount).toBeNull()
    expect(input.serviceDate).toBeNull()
    expect(input.externalAgreementStatus).toBe('unknown')
  })

  test('rejects zero/negative/malformed payment amounts and invalid currency', () => {
    for (const amount of ['0', '-1', '12.345', 'abc']) {
      expect(() => normalizeHistoricalEngagementInput({
        vendorId: 'vendor-1',
        serviceCategory: 'Catering',
        currency: 'USD',
        payments: [{ amount }],
      })).toThrow(HistoricalEngagementInputError)
    }

    expect(() => normalizeHistoricalEngagementInput({
      vendorId: 'vendor-1',
      serviceCategory: 'Catering',
      currency: 'USDD',
    })).toThrow(HistoricalEngagementInputError)
  })
})
