# Private Real UAT lane (local only)

These flows launch `wewed_native_env: private_real_shadow` and are **not** part of committed CI.

- Committed CI uses `SANITIZED_SHADOW`, where pseudonyms are expected and screenshots are public.
- This lane uses the protected production-derived snapshot. Screenshots and any captured
  hierarchy stay local and must never be uploaded to GitHub Actions.

The flows deliberately contain **no private names**. They assert stable accessibility identifiers,
taxonomy labels and counts, so the committed YAML stays free of PII. Name-level assertions, if
needed, belong in uncommitted local material.

The flows use `clearState: false` deliberately: the protected snapshot lives in the app's private
storage, and clearing state deletes it, which silently drops the app back to Sanitized Shadow.
Provision immediately before running.

Prerequisites:

    bash mobile/shadow/tools/provision_private_real_shadow.sh

Run:

    maestro --device <android-serial>   test .maestro/private-real/android-private-real-uat.yaml
    maestro --device <simulator-udid>   test .maestro/private-real/ios-private-real-uat.yaml
