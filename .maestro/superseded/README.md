# Superseded Maestro lanes

These flows were written against the **retired Expo / React Native shell**, not the current native
apps. They are kept for reference and excluded from the lane sweep.

Moved here 2026-09-21 under `WW-NATIVE-INVITATION-EXACT-PARITY-RULE-2026-09-20-08`, after they were
found failing for reasons unrelated to that task.

## Why they cannot pass

| Lane | What it assumes | What the app is now |
|---|---|---|
| `native-public-smoke.yaml` | An Expo sign-in route with `Email` / `Password` / `Sign in to Wewed` on first launch, and a Metro bundling delay of up to 120s | A Compose welcome screen with Sign In / Create Account / an environment entry, and no Metro |
| `native-authenticated-smoke.yaml` | React Navigation tab ids (`native-tab-plan`, `native-tab-messages`, …), a LogBox warning overlay, and the `Aurora & Blake — E2E Wedding` / `Cedar & Drew — Isolation Wedding` fixtures | IA V2 navigation ids, no LogBox, and the SHADOW / PRIVATE_REAL environments built on the Charity & Kudzie graph |

They also assert copy (`"Your wedding world, in your hand."`) removed in `05fbe01d`.

## What should replace them

Equivalent coverage against the native apps already exists in the lanes that remain:

- welcome → sign-in → workspace: `native-shadow-android`, `native-role-traversal`
- deep links into an unauthenticated app: `native-shadow-deep-link-invitation`
- tab traversal per role: `native-role-traversal`, `native-role-persona-switching`

Rewriting a public/authenticated smoke pair against the native shell is worth doing, but it is a
new test surface rather than a repair, so it was not attempted inside the invitation task.
