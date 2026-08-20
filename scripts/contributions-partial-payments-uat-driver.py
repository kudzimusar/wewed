from pathlib import Path

impl = Path('scripts/contributions-partial-payments-uat.py')
source = impl.read_text()
old = """    '  allocatedAmount?: number\\n}',
    '  allocatedAmount?: number\\n  directVendorPaidAmount?: number\\n}',
    'summary row paid field',
"""
new = """    '  fulfillmentState: string\\n  allocatedAmount?: number\\n}',
    '  fulfillmentState: string\\n  allocatedAmount?: number\\n  directVendorPaidAmount?: number\\n}',
    'summary row paid field',
"""
if source.count(old) != 1:
    raise SystemExit(f'driver: expected one summary-row anchor block, found {source.count(old)}')
source = source.replace(old, new, 1)
exec(compile(source, str(impl), 'exec'), {'__name__': '__main__'})
