# Wewed Mobile Shadow Setup

This directory contains the implementation-facing contract for the isolated Wewed Mobile Shadow environment.

## Current status

The native SwiftUI and Jetpack Compose clients now support three isolated data modes:

- sanitized Shadow reference data committed to the repository;
- `PRIVATE_REAL_SHADOW`, loaded only from a protected local production-derived snapshot outside Git;
- deterministic fixture data for lower-level tests.

Production runtime remains disabled. No native production database credential, production API write path, or reverse-sync path is enabled.

The active safety chain is:

```
production (read-only discovery)
    -> scoped private snapshot outside Git
    -> PRIVATE_REAL_SHADOW native repositories
    -> isolated mutable native state
    -> no reverse sync
```

A future network-backed Shadow service remains a separate acceptance gate; local private-real parity does not authorize production integration.

## Hard rules

- Production is a read-only source during the shadow phase.
- No native client receives production database credentials.
- Shadow never syncs mutations back to production.
- Production secrets, sessions, invitation secrets, payment credentials, signing private keys and private message bodies are excluded from exports.
- Real guest/vendor PII is not committed to Git.
- Private-real snapshots must stay in protected local storage: Android app-private files and iOS Application Support excluded from backup. Public `/sdcard`, `/data/local/tmp`, Documents/iCloud, and cloud backup are prohibited for retained snapshots.
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


## Implemented setup tooling

The setup branch now includes:

- `tools/01_discover_reference_wedding_readonly.sql` — read-only Charity & Kudzie / Eleven Eleven Testing identity discovery.
- `tools/02_audit_reference_wedding_counts_readonly.sql` — count/status audit after the wedding ID is confirmed.
- `tools/validate_shadow_material.py` — manifest/checksum/secret-key validation.
- `tools/native_local_preflight.sh` — one-command repository alignment + iOS/Android non-simulator qualification.

The SQL files are templates only. They have **not** been executed against production from this repository branch. They must be run only with an authorized read-only database credential.

## First local qualification

Before opening a simulator, a local agent should align to the exact remote setup branch and run:

```bash
cd "/Users/shadreckmusarurwa/Project AI/wewed-native-mobile"
git fetch origin --prune
git switch native-mobile/wedding-identity-ui-20260918
git pull --ff-only
bash mobile/shadow/tools/native_local_preflight.sh
```

The script stops on branch mismatch, local/remote divergence, dirty worktree, scope contamination, iOS test/build failure, or Android test/build failure.

Do not proceed to Maestro/simulator qualification until this script returns PASS.


## Native environment selection

The apps now use the same repository factory boundary on both platforms.

### iOS

The executable reads:

- `WEWED_NATIVE_ENV`
- `WEWED_SHADOW_API_BASE_URL`

Recognized values are:

```
fixture
shadow
sanitized_shadow
private_real_shadow
production_read_verify
production
```

During this sprint:

- `fixture`, `shadow`, `sanitized_shadow`, and `private_real_shadow` are allowed;
- every mutable Shadow mode rejects production hosts;
- `production_read_verify` deliberately throws until separately authorized and configured;
- `production` deliberately throws.

For authentic Charity & Kudzie qualification, use `WEWED_NATIVE_ENV=private_real_shadow` only after provisioning the protected snapshot. For sanitized automation, use `shadow` or `sanitized_shadow`.

### Android

`MainActivity` accepts these development intent extras:

```
wewed_native_env
wewed_shadow_base_url
```

The same safety rules apply. A production value does not silently fall back to fixtures.

## Reference guest tokens

The sanitized Shadow reference repository intentionally exposes separate non-secret development tokens:

```
shadow-attending-guest
shadow-pending-guest
shadow-declined-guest
```

They exist only to exercise different guest states.

- Home's Invitation preview uses `shadow-pending-guest` so the full Splash → Ivory Floral Gold → RSVP sequence remains testable.
- Home's Pass preview uses `shadow-attending-guest` so an already-confirmed pass state remains independently testable.
- Accepting the pending invitation updates only that guest and creates a development-only pass serial.
- Declining does not grant an admission-stage pass.

None of these values are production credentials.
