import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { summarizeContributions } from '@/lib/contributions'

const actions = readFileSync('src/app/api/planner/contributions/[id]/actions/route.ts','utf8')
const detail = readFileSync('src/app/api/planner/contributions/[id]/route.ts','utf8')
const workspace = readFileSync('src/components/wedding/planner/planner-contributions-workspace.tsx','utf8')
const budget = readFileSync('src/components/wedding/planner/modules/planner-budget-module.tsx','utf8')

describe('Contributions partial-payment UAT accounting', () => {
  test('direct vendor installments split paid from promised remainder', () => {
    const summary = summarizeContributions([{ type:'DIRECT_VENDOR_PAYMENT', amount:250, currency:'USD', estimatedValue:null, estimatedValueCurrency:null, commitmentState:'PLEDGED', fulfillmentState:'PARTIALLY_RECEIVED', directVendorPaidAmount:100 }])
    expect(summary).toEqual([{ currency:'USD', cashReceived:0, directVendorPaid:100, inKindValue:0, pledged:150, availableCash:0 }])
  })

  test('direct vendor action creates only the installment and leaves a remainder', () => {
    expect(actions).toContain("['PENDING','PARTIALLY_RECEIVED'].includes(locked.fulfillmentState)")
    expect(actions).toContain('const paymentAmount = requestedAmount ?? remainingBefore')
    expect(actions).toContain('amount: paymentAmount')
    expect(actions).toContain("const nextFulfillment = complete ? 'PAID_DIRECT' : 'PARTIALLY_RECEIVED'")
    expect(actions).toContain('paidAmount: { increment: paymentAmount }')
  })

  test('an unreconciled pending direct pledge can be corrected without splitting its allocation', () => {
    expect(detail).toContain("current.fulfillmentState === 'PENDING' && body.amount !== undefined")
    expect(detail).toContain("allocation_kind = 'DIRECT_PAYMENT'")
    expect(detail).toContain('SET amount = ${amount}')
  })

  test('historical classifier accepts partial amounts and only eligible received cash', () => {
    expect(workspace).toContain('fundingAmounts[item.id] ?? item.unattributed')
    expect(workspace).toContain("['CASH_TO_COUPLE','HONEYMOON_GIFT'].includes(contribution.type)")
    expect(workspace).toContain("contribution.fulfillmentState === 'RECEIVED'")
    expect(workspace).toContain('No received contribution cash available')
    expect(workspace).toContain('A promise to pay a vendor is not cash received')
  })

  test('UI and Budget distinguish promise, paid and remaining', () => {
    expect(workspace).toContain("return 'To pay vendor directly'")
    expect(workspace).toContain('Part-paid vendor directly')
    expect(workspace).toContain('directVendorPaidAmount')
    expect(workspace).toContain('remainingAmount')
    expect(budget).toContain('Linked contribution:')
    expect(budget).toContain('Promised {money(contribution.promisedAmount')
    expect(budget).toContain('Note: {contribution.notes}')
  })
})
