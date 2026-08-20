from pathlib import Path

workspace = Path('src/components/wedding/planner/planner-contributions-workspace.tsx')
source = workspace.read_text()

import_anchor = "import { useToast } from '@/hooks/use-toast'\n"
refresh_import = "import { refreshPlannerWorksheet } from '@/lib/planner-workspace-events'\n"
if refresh_import not in source:
    if source.count(import_anchor) != 1:
        raise SystemExit(f'finalizer: expected one Planner refresh import anchor, found {source.count(import_anchor)}')
    source = source.replace(import_anchor, import_anchor + refresh_import, 1)

refresh_anchor = "      await load(false)\n      return true"
if '      refreshPlannerWorksheet()\n      return true' not in source:
    if source.count(refresh_anchor) != 1:
        raise SystemExit(f'finalizer: expected one Contributions mutate refresh anchor, found {source.count(refresh_anchor)}')
    source = source.replace(refresh_anchor, "      await load(false)\n      refreshPlannerWorksheet()\n      return true", 1)

pledged_old = "if (filter === 'pledged' && !(item.commitmentState === 'PLEDGED' && item.fulfillmentState === 'PENDING')) return false"
pledged_new = "if (filter === 'pledged' && !(item.commitmentState === 'PLEDGED' && ['PENDING','PARTIALLY_RECEIVED'].includes(item.fulfillmentState))) return false"
if pledged_new not in source:
    if source.count(pledged_old) != 1:
        raise SystemExit(f'finalizer: expected one pledged filter anchor, found {source.count(pledged_old)}')
    source = source.replace(pledged_old, pledged_new, 1)

received_old = "if (filter === 'received' && !['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(item.fulfillmentState)) return false"
received_new = "if (filter === 'received' && !['RECEIVED','DELIVERED','PARTIALLY_RECEIVED','PAID_DIRECT','COMPLETED'].includes(item.fulfillmentState)) return false"
if received_new not in source:
    if source.count(received_old) != 1:
        raise SystemExit(f'finalizer: expected one received filter anchor, found {source.count(received_old)}')
    source = source.replace(received_old, received_new, 1)
workspace.write_text(source)

contract = Path('src/lib/contributions-source-contract.test.ts')
contract_source = contract.read_text()
button_anchor = "    expect(ui).toContain('Part-paid vendor directly')"
refresh_assertion = "    expect(ui).toContain('refreshPlannerWorksheet()')"
if refresh_assertion not in contract_source:
    if contract_source.count(button_anchor) != 1:
        raise SystemExit(f'finalizer: expected one direct-payment contract anchor, found {contract_source.count(button_anchor)}')
    contract_source = contract_source.replace(button_anchor, button_anchor + "\n" + refresh_assertion, 1)
contract.write_text(contract_source)

uat = Path('src/lib/contributions-partial-payments-uat.test.ts')
uat_source = uat.read_text()
uat_anchor = "    expect(workspace).toContain('Part-paid vendor directly')"
extra = "    expect(workspace).toContain('refreshPlannerWorksheet()')\n    expect(workspace).toContain(\"['PENDING','PARTIALLY_RECEIVED'].includes(item.fulfillmentState)\")"
if "expect(workspace).toContain('refreshPlannerWorksheet()')" not in uat_source:
    if uat_source.count(uat_anchor) != 1:
        raise SystemExit(f'finalizer: expected one partial-payment UAT anchor, found {uat_source.count(uat_anchor)}')
    uat_source = uat_source.replace(uat_anchor, uat_anchor + "\n" + extra, 1)
uat.write_text(uat_source)

for path, needles in {
    workspace: ["refreshPlannerWorksheet()", "['PENDING','PARTIALLY_RECEIVED'].includes(item.fulfillmentState)", "No received contribution cash available", "Record amount paid"],
    contract: ["paidAmount: { increment: paymentAmount }", "refreshPlannerWorksheet()"],
    uat: ["refreshPlannerWorksheet()"],
}.items():
    value = path.read_text()
    for needle in needles:
        if needle not in value:
            raise SystemExit(f'{path}: missing final invariant: {needle}')

print('Materialized Contributions live Planner synchronization finalized.')
