# Wewed repository agent instructions

Before any implementation work, fetch and read the canonical governance documents from branch:

`docs/native-pwa-production-convergence-plan-20260922`

Required files:
1. `docs/WEWED_IMPLEMENTATION_GOVERNANCE.md`
2. `docs/WEWED_NATIVE_PWA_PRODUCTION_CONVERGENCE_MASTER_PLAN.md`

Master plan ID: `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`.

Key execution rule: an implementation agent's self-report never closes a phase. Independent review inspects the actual remote code, patches ordinary defects directly, verifies the patched result, records acceptance, and only then issues the next task.

Do not merge, deploy, mutate production, apply production migrations, rotate secrets, configure production signing keys, or touch controlled live-UAT data without explicit approval.
