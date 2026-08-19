import { describe, expect, test } from 'bun:test'
import { contributionAvailableAmount, summarizeContributions, validateContributionInput } from './contributions'

describe('Contributions financial truth', () => {
  test('pledge is not received cash', () => {
    const summary = summarizeContributions([{ type: 'CASH_TO_COUPLE', amount: 1000, currency: 'USD', estimatedValue: null, estimatedValueCurrency: null, commitmentState: 'PLEDGED', fulfillmentState: 'PENDING', allocatedAmount: 0 }])
    expect(summary[0].pledged).toBe(1000)
    expect(summary[0].cashReceived).toBe(0)
    expect(summary[0].availableCash).toBe(0)
  })

  test('direct vendor payment is not available cash', () => {
    const summary = summarizeContributions([{ type: 'DIRECT_VENDOR_PAYMENT', amount: 600, currency: 'USD', estimatedValue: null, estimatedValueCurrency: null, commitmentState: 'NOT_APPLICABLE', fulfillmentState: 'PAID_DIRECT', allocatedAmount: 0 }])
    expect(summary[0].directVendorPaid).toBe(600)
    expect(summary[0].cashReceived).toBe(0)
  })

  test('received cash is reduced only by its allocations', () => {
    expect(contributionAvailableAmount({ type: 'CASH_TO_COUPLE', amount: 2000, fulfillmentState: 'RECEIVED', allocatedAmount: 1500 })).toBe(500)
  })

  test('in-kind remains separate from cash', () => {
    const summary = summarizeContributions([{ type: 'GOODS_IN_KIND', amount: null, currency: 'USD', estimatedValue: 480, estimatedValueCurrency: 'USD', commitmentState: 'NOT_APPLICABLE', fulfillmentState: 'DELIVERED', allocatedAmount: 0 }])
    expect(summary[0].inKindValue).toBe(480)
    expect(summary[0].cashReceived).toBe(0)
  })

  test('currencies never silently combine', () => {
    const summary = summarizeContributions([
      { type: 'CASH_TO_COUPLE', amount: 100, currency: 'USD', estimatedValue: null, estimatedValueCurrency: null, commitmentState: 'NOT_APPLICABLE', fulfillmentState: 'RECEIVED', allocatedAmount: 0 },
      { type: 'CASH_TO_COUPLE', amount: 1000, currency: 'ZAR', estimatedValue: null, estimatedValueCurrency: null, commitmentState: 'NOT_APPLICABLE', fulfillmentState: 'RECEIVED', allocatedAmount: 0 },
    ])
    expect(summary).toHaveLength(2)
    expect(summary.find((item) => item.currency === 'USD')?.cashReceived).toBe(100)
    expect(summary.find((item) => item.currency === 'ZAR')?.cashReceived).toBe(1000)
  })

  test('cash record requires positive amount', () => {
    expect(validateContributionInput({ type: 'CASH_TO_COUPLE', title: 'Family help', amount: 0 })).toContain('amount')
  })
})
