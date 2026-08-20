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
