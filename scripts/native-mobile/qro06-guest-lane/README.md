# QRO06-GUEST-LAUNCH01 — final-native Guest corridor against a real backend (synthetic, loopback)

Runs the REAL final Guest components on both platforms against this branch's REAL Next.js backend
on a DISPOSABLE PostgreSQL. Everything is synthetic: two C&K-shaped `link_only` weddings (Ivory
Floral Gold, message, deadline, Adults-only, programme, seating) and fixture Guests in every state.
No production data, credential or request.

1. `createdb wewed_qro06_guest && ALTER DATABASE … SET timezone TO 'UTC'` (Pass keys are stored as
   timestamp-without-zone; a non-UTC local server makes a fresh key look future-dated),
   `prisma migrate deploy`, `psql -f seed.sql`.
2. Throwaway local P-256 keys for WW2/root (never production): `openssl ecparam -name prime256v1 …`.
3. `next dev -H 127.0.0.1 -p 3106` with `DATABASE_URL`, a random `WEWED_SESSION_SECRET`,
   `WEWED_WEDDING_DAY_WW2_ENABLED=1` and the two local keys.
4. iOS (visible simulator): `xcodebuild test … -only-testing:GuestProfileUITests/GuestLaunchLaneUITests`
   with `TEST_RUNNER_WEWED_QRO06_ORIGIN=http://127.0.0.1:3106` and the `…_{PENDING,ATTENDING,DECLINED,WINDOW,RSVP}_LINK`
   fixture links (`https://wewed.pro/invite/<slug>?rsvp=<fixture token>` — parsed only; the Guest
   lane talks to the loopback origin). Skips when absent.
5. Android: `adb reverse tcp:3106 tcp:3106 && ./gradlew installDebug &&
   python3 android_guest_lane_driver.py <shots-dir> <links.json>`.

Screenshots stay local. Real Charity & Kudzie qualification uses the same apps against an approved
Preview origin.
