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

# splice() preserves the end anchor. Do not append the same anchor inside replacement.
direct_bad = '""" + end\ns = splice(s, start, end, replacement, \'direct installment controls\')'
direct_good = '"""\ns = splice(s, start, end, replacement, \'direct installment controls\')'
if source.count(direct_bad) != 1:
    raise SystemExit(f'driver: expected one direct splice duplication, found {source.count(direct_bad)}')
source = source.replace(direct_bad, direct_good, 1)

panel_bad = "s = splice(s, panel_start, panel_end, new_panel + panel_end, 'historical funding controls')"
panel_good = "s = splice(s, panel_start, panel_end, new_panel, 'historical funding controls')"
if source.count(panel_bad) != 1:
    raise SystemExit(f'driver: expected one historical panel splice duplication, found {source.count(panel_bad)}')
source = source.replace(panel_bad, panel_good, 1)

exec(compile(source, str(impl), 'exec'), {'__name__': '__main__'})

contract = Path('src/lib/contributions-source-contract.test.ts')
contract_source = contract.read_text()
old_amount = "    expect(actions).toContain('paidAmount: { increment: amount }')"
new_amount = "    expect(actions).toContain('paidAmount: { increment: paymentAmount }')\n    expect(actions).toContain(\"const nextFulfillment = complete ? 'PAID_DIRECT' : 'PARTIALLY_RECEIVED'\")\n    expect(actions).toContain('const remainingAfter = Math.max(0, promisedAmount - paidToDate)')"
if contract_source.count(old_amount) != 1:
    raise SystemExit(f'driver: expected one legacy direct-payment amount assertion, found {contract_source.count(old_amount)}')
contract_source = contract_source.replace(old_amount, new_amount, 1)

old_button = "    expect(ui).toContain('Record vendor paid')"
new_button = "    expect(ui).toContain('Record amount paid')\n    expect(ui).toContain('To pay vendor directly')\n    expect(ui).toContain('Part-paid vendor directly')"
if contract_source.count(old_button) != 1:
    raise SystemExit(f'driver: expected one legacy direct-payment button assertion, found {contract_source.count(old_button)}')
contract_source = contract_source.replace(old_button, new_button, 1)
contract.write_text(contract_source)
print('Direct-payment source contract aligned to installment accounting.')
