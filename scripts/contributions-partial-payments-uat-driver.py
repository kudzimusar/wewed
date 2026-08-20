from pathlib import Path

impl = Path('scripts/contributions-partial-payments-uat.py')
source = impl.read_text()
old = """s = replace_once(
    s,
    '  allocatedAmount?: number\\n}',
    '  allocatedAmount?: number\\n  directVendorPaidAmount?: number\\n}',
    'summary row paid field',
)
"""
new = """s = replace_once(
    s,
    \"export interface ContributionSummaryRow {\\n  type: string\\n  amount: number | null\\n  currency: string\\n  estimatedValue: number | null\\n  estimatedValueCurrency: string | null\\n  commitmentState: string\\n  fulfillmentState: string\\n  allocatedAmount?: number\\n}\",
    \"export interface ContributionSummaryRow {\\n  type: string\\n  amount: number | null\\n  currency: string\\n  estimatedValue: number | null\\n  estimatedValueCurrency: string | null\\n  commitmentState: string\\n  fulfillmentState: string\\n  allocatedAmount?: number\\n  directVendorPaidAmount?: number\\n}\",
    'summary row paid field',
)
"""
if source.count(old) != 1:
    raise SystemExit(f'driver: expected one summary-row replacement call, found {source.count(old)}')
source = source.replace(old, new, 1)
exec(compile(source, str(impl), 'exec'), {'__name__': '__main__'})

contract = Path('src/lib/contributions-source-contract.test.ts')
contract_source = contract.read_text()
old_contract = "    expect(actions).toContain('paidAmount: { increment: amount }')"
new_contract = "    expect(actions).toContain('paidAmount: { increment: paymentAmount }')\n    expect(actions).toContain(\"const nextFulfillment = complete ? 'PAID_DIRECT' : 'PARTIALLY_RECEIVED'\")\n    expect(actions).toContain('const remainingAfter = Math.max(0, promisedAmount - paidToDate)')"
if contract_source.count(old_contract) != 1:
    raise SystemExit(f'driver: expected one legacy direct-payment assertion, found {contract_source.count(old_contract)}')
contract.write_text(contract_source.replace(old_contract, new_contract, 1))
print('Direct-payment source contract aligned to installment accounting.')
