from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]

SCRIPTS = [
    'scripts/contributions-alignment-source.py',
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
]

for relative in SCRIPTS:
    path = ROOT / relative
    if not path.exists():
        raise SystemExit(f'Missing remediation script: {relative}')
    print(f'Applying {relative}')
    runpy.run_path(str(path), run_name='__main__')

print('All Contributions second-review remediation slices applied in canonical order.')
