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

workspace = Path('src/components/wedding/planner/planner-contributions-workspace.tsx')
workspace_source = workspace.read_text()
import_anchor = "import { useToast } from '@/hooks/use-toast'\n"
if workspace_source.count(import_anchor) != 1:
    raise SystemExit(f'driver: expected one Planner refresh import anchor, found {workspace_source.count(import_anchor)}')
workspace_source = workspace_source.replace(import_anchor, import_anchor + "import { refreshPlannerWorksheet } from '@/lib/planner-workspace-events'\n", 1)

refresh_anchor = "      await load(false)\n      return true"
if workspace_source.count(refresh_anchor) != 1:
    raise SystemExit(f'driver: expected one Contributions mutate refresh anchor, found {workspace_source.count(refresh_anchor)}')
workspace_source = workspace_source.replace(refresh_anchor, "      await load(false)\n      refreshPlannerWorksheet()\n      return true", 1)

pledged_filter = "if (filter === 'pledged' && !(item.commitmentState === 'PLEDGED' && item.fulfillmentState === 'PENDING')) return false"
if workspace_source.count(pledged_filter) != 1:
    raise SystemExit(f'driver: expected one pledged filter anchor, found {workspace_source.count(pledged_filter)}')
workspace_source = workspace_source.replace(pledged_filter, "if (filter === 'pledged' && !(item.commitmentState === 'PLEDGED' && ['PENDING','PARTIALLY_RECEIVED'].includes(item.fulfillmentState))) return false", 1)

received_filter = "if (filter === 'received' && !['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(item.fulfillmentState)) return false"
if workspace_source.count(received_filter) != 1:
    raise SystemExit(f'driver: expected one received filter anchor, found {workspace_source.count(received_filter)}')
workspace_source = workspace_source.replace(received_filter, "if (filter === 'received' && !['RECEIVED','DELIVERED','PARTIALLY_RECEIVED','PAID_DIRECT','COMPLETED'].includes(item.fulfillmentState)) return false", 1)
workspace.write_text(workspace_source)

contract = Path('src/lib/contributions-source-contract.test.ts')
contract_source = contract.read_text()
old_amount = "    expect(actions).toContain('paidAmount: { increment: amount }')"
new_amount = "    expect(actions).toContain('paidAmount: { increment: paymentAmount }')\n    expect(actions).toContain(\"const nextFulfillment = complete ? 'PAID_DIRECT' : 'PARTIALLY_RECEIVED'\")\n    expect(actions).toContain('const remainingAfter = Math.max(0, promisedAmount - paidToDate)')"
if contract_source.count(old_amount) != 1:
    raise SystemExit(f'driver: expected one legacy direct-payment amount assertion, found {contract_source.count(old_amount)}')
contract_source = contract_source.replace(old_amount, new_amount, 1)

old_button = "    expect(ui).toContain('Record vendor paid')"
new_button = "    expect(ui).toContain('Record amount paid')\n    expect(ui).toContain('To pay vendor directly')\n    expect(ui).toContain('Part-paid vendor directly')\n    expect(ui).toContain('refreshPlannerWorksheet()')"
if contract_source.count(old_button) != 1:
    raise SystemExit(f'driver: expected one legacy direct-payment button assertion, found {contract_source.count(old_button)}')
contract_source = contract_source.replace(old_button, new_button, 1)
contract.write_text(contract_source)

uat_test = Path('src/lib/contributions-partial-payments-uat.test.ts')
uat_source = uat_test.read_text()
old_uat = "    expect(workspace).toContain('Part-paid vendor directly')\n    expect(workspace).toContain('directVendorPaidAmount')"
new_uat = "    expect(workspace).toContain('Part-paid vendor directly')\n    expect(workspace).toContain('refreshPlannerWorksheet()')\n    expect(workspace).toContain(\"['PENDING','PARTIALLY_RECEIVED'].includes(item.fulfillmentState)\")\n    expect(workspace).toContain('directVendorPaidAmount')"
if uat_source.count(old_uat) != 1:
    raise SystemExit(f'driver: expected one live Planner UAT assertion anchor, found {uat_source.count(old_uat)}')
uat_test.write_text(uat_source.replace(old_uat, new_uat, 1))
print('Direct-payment source contract and live Planner refresh aligned to installment accounting.')
