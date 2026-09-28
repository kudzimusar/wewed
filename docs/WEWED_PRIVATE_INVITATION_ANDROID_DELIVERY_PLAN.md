# Private invitation delivery and Shadreck pre-live contract

## Authority and baseline

Engineering only; no production mutations, migrations, signing-key configuration or merges.
Native baseline: `e0fe259abe40fa74b5c7b350cc6b662a3918591b`, verified remote 2026-09-21.
Backend baseline: current main `ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887`.
Backend changes are isolated on `backend/guest-session-v2-20260921`; native changes on
`native-mobile/guest-profile-invitation-20260921`. Never merge the native branch into web production.

The next milestone is approval to connect the existing Shadreck Kudzanai Musarurwa guest,
Charity & Kudzie wedding, managed by Eleven Eleven Testing. Synthetic fixtures are pre-live only.
No new production guest, manually generated credential, constructed private link or stationery change.

## Existing flow and gaps confirmed before implementation

| Stage | Existing authority | Audit disposition |
| --- | --- | --- |
| Planner/Couple sharing | existing Guest List invitation manager and RSVP credential | Preserve; live copy/share action must generate UAT link |
| Private entry | `/i/[token]`, `/invite/[slug]/continue`, `personal-invitation-access.ts` | Existing; do not invent native URLs |
| Physical QR | physical-invitation claim route, separate shared invitation session | Existing; general QR must not silently create personal access |
| Install handoff | `invitation-install-handoff.ts`, `/invite/resume`, existing deferred/install-referrer infrastructure | Existing; retain original invitation context, real store installation still unqualified |
| Server guest session | `wedding-guest-session.ts`, `wedding-public-access.ts`, guest-session API | Existing v1 embeds raw RSVP credential; v2 migration required |
| Native session | Android/iOS `Invitation/GuestSessionClient`, platform secure storage | Existing; refreshed credential persistence missing |
| Native first arrival | `GuestOnlyInvitationShell`, `GuestOnlyInvitationShellView` | Existing live renderer; shell state loses return location |
| Native invitation | `LiveGuestInvitationScreen/View`, `NativeInvitationExperience` | Existing artwork; reuse, never substitute a summary |
| Guest Profile | `LiveGuestShell/View` | Home/Profile invitation actions missing, Android icons empty |
| RSVP | guest-session PUT with `originGuestId` | Existing same-guest binding; preserve and test rotation/switching |
| Seating | current guest server projection | tableNumber exists; tableName missing |
| Wedding Day | feature-branch `/api/wedding-day/guest` | Exists but requires selective promotion and current invitation validation |
| Pass | feature-branch `wedding-day.ts`, pass route, manifest | WW2 issuer exists; migration/key review and native consumption pending |
| Published content | `/api/wedding-content?slug=` | Existing; reuse guest-safe fields only |
| UI qualification | Compose instrumentation and real-app XCUITest | Missing at baseline; required before live UAT |

## Delivery phases and gates

1. Native navigation: one selected destination and remembered return target; Home, Invitation,
   Profile reopen the actual card using the remembered server session. Ceremonial first arrival
   remains immersive. Back restores the prior destination. Invitation → Pass selects the real Pass.
2. Secure sessions: new v2 payload contains only version, weddingId, guestId,
   invitationVersionFingerprint and expiresAt. Fingerprint is domain-separated server HMAC tied
   to the current invitation credential; rotation invalidates all remembered entry paths including
   the wedding portfolio. Valid v1 reads are upgraded, never newly issued. Native persists refreshed
   cookies from authenticated GET/PUT and clears revoked sessions without clobbering a newer guest.
3. Guest projections: current guest table name/number only; attending-only Wedding Day programme,
   announcements, household and check-in state; canonical published wedding content.
4. WW2: selectively promote existing issuer and required migration. Default-off until schema/key
   review. Pending/declined receive no pass. Native consumes server WW2 and existing Pass renderer.
5. Qualification: unit/API security checks, real Compose and XCUITest app tests, cold launch,
   prior destination, RSVP eligibility, two synthetic guests with no context leakage. Production
   Android package and Play version codes, iOS signing prefix and AASA are separate external gates.
6. Stop for pre-UAT checkpoint approval. Do not mutate the real guest automatically.

## Session lifetime policy

Issue for at least 30 days, or through wedding date + 90 days, with a hard 400-day cap per
credential. A missing date uses 30 days. Reads of v2 do not slide expiry. Rotation revokes
immediately. Legacy v1 remains accepted only while valid against the current invitation and its
original expiry; authenticated reads upgrade it. The bounded portfolio must not bypass revocation.

## Required evidence ledger

Initial native tests: Android Compose 4/4, iOS real-app XCUITest 3/3 (synthetic local HTTP).
These establish invitation navigation and pending/declined behavior only, not production Pass,
Wedding Day, App Link/store install or live RSVP. Re-run after dependent changes.
Full backend TypeScript currently reports unrelated repository errors; affected-file diagnostics
must be separately recorded and no whole-repository green claim is permitted.

All gates remain open until executable evidence is recorded. Authorization enums are not delivery
proof: report authorized / server available / loaded / rendered / device tested separately.

## Controlled live UAT, after explicit approval

Authenticated Planner inspection records existing guest identity, RSVP/check-in/table, wedding
style/date/venue/deadline and credential presence without reporting secrets. If saved style is not
`ivory-floral-gold`, stop for a Couple/Planner decision. Generate the real invitation through the
existing invitation manager. Chrome/Safari direct paste must open the signed production app,
splash, correct personalized card first. Continue to Guest Home, reopen from all three entries,
kill/relaunch through app icon, RSVP against the same Planner record, verify attending WW2 and
Wedding Day data, then restore the agreed final RSVP state. Record every production mutation.

## Distance to Shadreck UAT

Not approved for live UAT. Remaining gates: backend security and migration review, native Pass
and Wedding Day integration, complete device regression, release signing/link/store qualification,
backend PR review/deployment, saved production stationery verification and explicit UAT approval.
