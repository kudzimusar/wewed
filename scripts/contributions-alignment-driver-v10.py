from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]

# Product-only canonical Planner alignment: section 10 of the historical script mutates CI,
# which is owned exclusively by the qualification wrapper.
alignment = ROOT / 'scripts/contributions-alignment-source.py'
source = alignment.read_text()
marker = '# 10. Dedicated workflow watches the canonical Planner files and executes the new browser gate.'
if source.count(marker) != 1:
    raise SystemExit('Canonical alignment workflow marker missing or ambiguous.')
product_source = source.split(marker, 1)[0] + "\nprint('Contributions canonical Planner alignment applied (product-only).')\n"
print('Applying scripts/contributions-alignment-source.py (product-only sections 1-9)')
exec(compile(product_source, str(alignment), 'exec'), {'__name__': '__main__', '__file__': str(alignment)})

# Execution order follows proven patch dependencies, not phase numbering.
SCRIPTS = [
    'scripts/contributions-second-review-expansion.py',
    'scripts/contributions-lifecycle-audit.py',
    'scripts/contributions-integrity-permissions.py',
    'scripts/contributions-final-hardening.py',
    'scripts/contributions-phase2-detail-evidence.py',
    'scripts/contributions-phase1-phase3-financial-truth.py',
    'scripts/contributions-phase4-operational-integration.py',
    'scripts/contributions-phase5-campaign-governance.py',
    'scripts/contributions-phase6-productivity.py',
    'scripts/contributions-final-invariants.py',
    'scripts/contributions-wewed-contract-normalization.py',
]

for relative in SCRIPTS:
    path = ROOT / relative
    if not path.exists():
        raise SystemExit(f'Missing remediation script: {relative}')
    print(f'Applying {relative}')

    if relative == 'scripts/contributions-phase1-phase3-financial-truth.py':
        # Permissions hardening runs earlier and adds canEdit to the legacy funding panel.
        # Preserve that guard while Phase 1/3 inserts payment-level funding UI.
        phase_source = path.read_text()
        old = '{funding.some((item) => item.unattributed > 0) && <Panel className='
        new = '{canEdit && funding.some((item) => item.unattributed > 0) && <Panel className='
        if phase_source.count(old) != 2:
            raise SystemExit(f'Phase 1/3 funding-panel anchor count changed: {phase_source.count(old)}')
        phase_source = phase_source.replace(old, new)
        exec(compile(phase_source, str(path), 'exec'), {'__name__': '__main__', '__file__': str(path)})
        continue

    if relative == 'scripts/contributions-phase5-campaign-governance.py':
        phase_source = path.read_text()

        # Lifecycle emits campaign SQL with 15-space continuation indentation;
        # Phase 5 was authored against an older 13-space snapshot.
        old_invite = '             invitation_visible = COALESCE(${invitationVisible}, invitation_visible),'
        new_invite = '               invitation_visible = COALESCE(${invitationVisible}, invitation_visible),'
        old_updated = '             updated_at = NOW()'
        new_updated = '               updated_at = NOW()'
        if phase_source.count(old_invite) != 2:
            raise SystemExit(f'Phase 5 invitation SQL literal count changed: {phase_source.count(old_invite)}')
        if phase_source.count(old_updated) != 2:
            raise SystemExit(f'Phase 5 updated_at SQL literal count changed: {phase_source.count(old_updated)}')
        phase_source = phase_source.replace(old_invite, new_invite).replace(old_updated, new_updated)

        # Permissions hardening also precedes Phase 5. Preserve canEdit on the existing
        # show-target control and apply the same guard to the new recognition toggle.
        escaped_target = '<Button size=\\"sm\\" variant=\\"outline\\" onClick={() => void patchCampaign(campaign,{showTarget:!campaign.showTarget})}'
        escaped_guarded_target = '<Button size=\\"sm\\" variant=\\"outline\\" disabled={!canEdit} onClick={() => void patchCampaign(campaign,{showTarget:!campaign.showTarget})}'
        plain_target = '<Button size="sm" variant="outline" onClick={() => void patchCampaign(campaign,{showTarget:!campaign.showTarget})}'
        plain_guarded_target = '<Button size="sm" variant="outline" disabled={!canEdit} onClick={() => void patchCampaign(campaign,{showTarget:!campaign.showTarget})}'
        if phase_source.count(escaped_target) != 1:
            raise SystemExit(f'Phase 5 escaped showTarget literal count changed: {phase_source.count(escaped_target)}')
        if phase_source.count(plain_target) != 1:
            raise SystemExit(f'Phase 5 plain showTarget literal count changed: {phase_source.count(plain_target)}')
        phase_source = phase_source.replace(escaped_target, escaped_guarded_target, 1)
        phase_source = phase_source.replace(plain_target, plain_guarded_target, 1)

        recognition = '<Button size="sm" variant="outline" onClick={() => void patchCampaign(campaign,{showContributorRecognition:!campaign.showContributorRecognition})}'
        guarded_recognition = '<Button size="sm" variant="outline" disabled={!canEdit} onClick={() => void patchCampaign(campaign,{showContributorRecognition:!campaign.showContributorRecognition})}'
        if phase_source.count(recognition) != 1:
            raise SystemExit(f'Phase 5 recognition button literal count changed: {phase_source.count(recognition)}')
        phase_source = phase_source.replace(recognition, guarded_recognition, 1)
        exec(compile(phase_source, str(path), 'exec'), {'__name__': '__main__', '__file__': str(path)})
        continue

    runpy.run_path(str(path), run_name='__main__')

print('All Contributions second-review remediation slices and Wewed contract normalization applied.')
