# PR #202 UAT setup

Branch: `feature/private-invitation-android-delivery-20260912`. Do not merge before qualification.

Fixture: `wewed-pr202-uat-20260912`, **Wewed PR 202 — Synthetic UAT**. Guest IDs end in `-guest-a` and `-guest-b`. Physical code: `UAT2020912`.

The fixture provisioner runs only with `VERCEL_ENV=preview`, the exact branch, and explicit `WEWED_UAT_PROVISION` plus a random fixture secret. It creates only this fixture's records in one transaction and refuses identity collisions. It is not invoked by normal builds. Do not log or commit its secret or guest URLs.

The shared database currently rejects the new Ivory stored style. The UAT fixture therefore stores `botanical`; private URLs explicitly specify `card=ivory-floral-gold`, which the handoff preserves. No shared schema migration was applied. Saving Ivory as a wedding default remains dependent on the pending migration.

Set `WEWED_PREVIEW_WRITABLE_WEDDING_ID=wewed-pr202-uat-20260912` for this preview branch only. Guest RSVP writes, public wedding mutations, physical scan counters, and handoff creation/consumption honor the same boundary as Planner permissions. Physical links grant shared read access and clear private identity; they do not identify an anonymous guest for RSVP.

## Android UAT

`:app:assembleUat` builds a debug-signed `pro.wewed.app` test APK associated with `uat.wewed.pro`. Its launch, manifest, scope, shortcuts and referrer resume route use that host. Use a dedicated test device; this APK is not a Google Play release and may conflict with an installed production app of the same package.

The stable alias must point to the verified candidate deployment. Set the actual APK signing certificate as `WEWED_UAT_ANDROID_SHA256` on this preview branch. Only this host's assetlinks request is rewritten on preview; production retains its existing association file.

`ANDROID_DEFERRED_INVITATION_HANDOFF=0` is deliberate until the intended Play test track contains a suitable signed build. Sideloading does not qualify deferred Play installation. Qualification requires the real Play-installed build, its Play signing certificate associated with the UAT host, and an opaque-only referrer round trip. No raw RSVP credential or guest PII belongs in the referrer.

The Excel regression now waits for the visible responsive review element instead of deciding desktop/mobile before React commits the response. The release gate still uses `--fail-on-flaky-tests`.
