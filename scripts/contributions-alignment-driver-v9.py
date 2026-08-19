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

SCRIPTS = [
    'scripts/contributions-second-review-expansion.py',
    'scripts/contributions-lifecycle-audit.py',
    'scripts/contributions-integrity-permissions.py',
    'scripts/contributions-final-hardening.py',
    'scripts/contributions-phase1-phase3-financial-truth.py',
    'scripts/contributions-phase2-detail-evidence.py',
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
    runpy.run_path(str(path), run_name='__main__')

print('All Contributions second-review remediation slices and Wewed contract normalization applied.')
