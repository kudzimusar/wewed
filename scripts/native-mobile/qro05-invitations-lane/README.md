# QRO05-PIQR01 local final-native lane (synthetic, loopback only)

Drives the REAL final-native apps through the `production_preview` lane against the REAL Next.js
backend (this branch) on a DISPOSABLE local PostgreSQL. Only Supabase's password check is replaced,
by `loopback_auth_standin.py` (one synthetic account, 127.0.0.1:54399, never proxies). No production
data, no production credentials, no Shadow, no persona.

1. `createdb wewed_qro05_e2e && DATABASE_URL=… prisma migrate deploy && psql -d wewed_qro05_e2e -f seed.sql`
2. `python3 loopback_auth_standin.py`
3. `env -i PATH=$PATH HOME=$HOME DATABASE_URL=… DIRECT_URL=… WEWED_SESSION_SECRET=<random> NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=local next dev -H 127.0.0.1 -p 3105`
4. iOS: `xcodebuild test … -only-testing:GuestProfileUITests/PlannerInvitationsQrUITests` with the
   `TEST_RUNNER_WEWED_QRO05_*` variables (origin `http://127.0.0.1:3105`, the synthetic account,
   expectations from `seed.sql`). The test skips when they are absent.
5. Android: `adb reverse tcp:3105 tcp:3105 && ./gradlew installDebug && python3 android_lane_driver.py <screenshot-dir>`

Screenshots stay local. Real C&K qualification uses the same apps against an approved Preview.
