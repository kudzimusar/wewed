# Wewed Mobile Shadow Setup

This directory contains the implementation-facing contract for the isolated Wewed Mobile Shadow environment.

## Current status

The native apps are still running with deterministic fixture repositories. No production database or production API write path is enabled.

The next safe transition is:

```
production (read-only discovery)
    -> scoped snapshot
    -> private shadow import
    -> sanitized repository fixture
    -> shadow API adapters
    -> native repositories
```

## Hard rules

- Production is a read-only source during the shadow phase.
- No native client receives production database credentials.
- Shadow never syncs mutations back to production.
- Production secrets, sessions, invitation secrets, payment credentials, signing private keys and private message bodies are excluded from exports.
- Real guest/vendor PII is not committed to Git.
- Email, WhatsApp/SMS, push, payments, contract signing and external webhooks must use sandbox/null adapters in Shadow.

## Reference wedding

The product reference is the Charity & Kudzie wedding managed through the Eleven Eleven Testing planner context.

The repository fixture in `mobile/fixtures/shadow-reference/` is intentionally sanitized and synthetic. It is **not** a production export and must never be described as one.

## Snapshot manifest

Every private snapshot must validate against `snapshot-manifest.schema.json` and include:

- snapshot ID;
- source wedding ID;
- source environment;
- exported domains;
- excluded domains;
- export timestamp;
- schema/sanitization version;
- row counts;
- checksum;
- operator;
- explicit confirmation that no production writes occurred.

## Agent handoff rule

Before implementation, read:

1. `docs/native-mobile/WEWED_NATIVE_SHADOW_INTEGRATION_REAL_WEDDING_PARITY_PLAN_2026-09-18.md`
2. this file
3. `snapshot-manifest.schema.json`
4. current platform repository interfaces.

If the local and remote branch are not aligned, stop before changing code.
