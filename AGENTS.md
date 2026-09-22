# Wewed repository agent instructions

Before any implementation work, read and follow:

1. `docs/WEWED_IMPLEMENTATION_GOVERNANCE.md`
2. `docs/WEWED_NATIVE_PWA_PRODUCTION_CONVERGENCE_MASTER_PLAN.md`

The master plan ID is `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`.

Key rule: an implementation agent's self-report does not close a phase. Independent review must inspect actual remote code, patch ordinary defects directly, verify the patched result, record acceptance, and only then issue the next task.

Do not merge, deploy, mutate production, apply production migrations, rotate secrets, configure production signing keys, or touch controlled live-UAT data without explicit approval.
