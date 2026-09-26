# INV-CANON01 — Canonical Ivory Floral Gold invitation: canonization and C&K activation receipt (2026-09-27)

**Status: IMPLEMENTATION REPORT — NOT A MODERATOR ACCEPTANCE DECISION.**

**Result:** the Planner/Couple studio now shows the approved Ivory Floral Gold invitation. The
Charity & Kudzie wedding was switched `botanical → ivory-floral-gold` by exactly one authorized
product-API write. iOS and Android render the ornate ivory/gold gateway for the real, unrotated
Guest credential. **Production promotion of the studio change is prepared and STOPPED for
authorization (§7).**

## 1. Source change (promotion candidate)

| Item | Value |
| --- | --- |
| Branch | `closure/inv-canon01-planner-canonical-ivory-20260927` |
| Base | `main` `ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887` (still `main` HEAD at time of writing) |
| Tested SHA | `04ce1d7000e8dbda98fcf61cc786c52e30a0cca4` (one commit, pushed) |
| Files | 4 — `premium-invitation-studio.tsx` (+36/−2), `invitation-manager.tsx` (+5/−1), `src/lib/canonical-invitation.test.ts` (new, 8 tests), `tests/e2e/premium-digital-invitation.spec.ts` (+7) |
| Integration copy | cherry-picked onto `integration/phase13-live-account-data-convergence-20260926` as `b63933214c24e6303ef370fbf90b0c1211901aac` |

What changed:

1. The studio's Ivory Floral Gold tile renders the **approved CLOSED artwork**
   (`/invitation-art/ivory/closed-master.webp`, already in the repository, provenance "Original
   approved session PNG" in `manifest.json`) instead of the flat generic `DigitalInvitationCard`
   thumbnail. `CANONICAL_INVITATION_STYLE = 'ivory-floral-gold'`. The other 11 tiles are unchanged.
2. Selecting Ivory still previews through `IvoryFloralGoldTriFold` (CLOSED → OPENING → OPEN →
   DETAILS). No renderer, artwork or state machine was redesigned.
3. `invitation-manager` `load()` tolerates the token-backfill POST returning
   `423 PREVIEW_WRITE_BLOCKED` and continues read-only. Without this the studio never rendered on a
   read-only Preview.

Tests: `canonical-invitation.test.ts` 8 pass on the branch and fails on `main` (red→green proof, the
"before" evidence, because the old studio could not be rendered on Preview and loading it on
production would trigger the backfill POST).

## 2. Preview proof (Planner studio)

| Field | Value |
| --- | --- |
| Canon branch Preview | `https://wewed-kyqsuzvtp-11-11.vercel.app` (`dpl_Ef86Vfme1tw2xwrifMzgmNzbDMMY`, READY, Preview) |
| Integration Preview | `https://wewed-jct5coykp-11-11.vercel.app` (integration `b6393321`) |
| Art asset | `closed-master.webp` 200 `image/webp` 573,376 bytes |

Captured (authenticated real Planner, read-only): studio library, Ivory tile showing the approved
closed doors, and the preview frame in CLOSED, OPENING, OPEN and DETAILS. Screenshots are kept locally
and **not committed** (they show real names).

## 3. Controlled live write (the one authorized write)

| Item | Value |
| --- | --- |
| Path | `PUT https://wewed.pro/api/planner/guests/invitations` — the studio's own Save endpoint |
| Actor | the real Planner account (label `P`), `guests.edit` |
| Time | 2026-09-26T21:24:23Z – 21:24:34Z |
| Body | `style: ivory-floral-gold`, `message: ""` (stored null, as before), `rsvpDeadline: null`, `childrenPolicy: welcome` — values taken from the pre-write snapshot |
| Result | `200 success` (route writes its own `AuditEvent`) |
| Guards | script refused any planner-route method other than `GET` and this one `PUT`; refused unless wedding = `cmqos70cb0004q6vxe9g9aiu5` and current style = `botanical` |

`PATCH` (rotates Guest tokens) and the backfill `POST` were **never called**. The studio UI was not
loaded on production (its `load()` would call the backfill `POST`).

Why production API rather than Preview: the integration Preview has no writable wedding configured,
so C&K writes there return 423. Enabling it would have needed a Preview env change plus redeploy. The
production PUT is the ordinary product path the owner authorized, with no configuration change.

Snapshot (Guest token shown only as a SHA-256 digest):

| Field | Before | After | Post-UAT |
| --- | --- | --- | --- |
| `invitationCardStyle` | `botanical` | **`ivory-floral-gold`** | `ivory-floral-gold` |
| `invitationCardMessage` | null | null | null |
| `rsvpDeadline` | null | null | null |
| `childrenPolicy` | `welcome` | `welcome` | `welcome` |
| Guest `cmuahx3ka0001js043cseq7z4` RSVP | pending | pending | pending |
| Guest table number | null | null | null |
| Guest token sha256 | `92277a97…182f0ac9` | `92277a97…182f0ac9` | `92277a97…182f0ac9` |

**Token not rotated. No Guest, RSVP, party, seating, date, Pass/WW2 or Gate change.** The link's
`card=` parameter is derived from the wedding style and now reads `ivory-floral-gold`. The existing
credential was reused unchanged.

Side effects disclosed: the production sign-in updated the Planner's `User.lastLoginAt` /
`UserProfile.lastLoginAt` and re-set `currentWeddingId` to its existing value (C&K). This is sign-in
bookkeeping, not wedding business data.

## 4. Native visible UAT (real Guest credential, unrotated)

Server: integration Preview (shares the live database, so it serves the live `ivory-floral-gold`
style). Native builds: NLC01 closure `apps/` (`e9d71443`, includes the invitation-entry fix), DEBUG
`pro.wewed.app.dev`, `productionPreview` lane. Window 2026-09-26T21:35Z – 21:56Z.

| State | iOS (dedicated sim "NLC01 iPhone 18 Pro", only `wewed://` handler = `pro.wewed.app.dev`) | Android (`emulator-5554`, explicit component) |
| --- | --- | --- |
| Splash | Wewed splash | Wewed splash (cold link) |
| Home/workspace before invitation | none | none (cold link: splash → CLOSED) |
| CLOSED | ornate ivory/gold doors, C&K seal, "A special invitation awaits", "Tap to open" | same |
| OPENING | not captured (Maestro too slow for the transition) | doors mid-swing captured |
| OPEN | "Charity & Kudzie", "Wednesday · Dec 23 · 2026", Imba Manor, 23.12.26 | same |
| DETAILS | "You're Invited" hub: RSVP, Calendar, Venue, Gifts, Note; Guest Pass "RSVP required" | same |
| Raw ISO date | absent (Maestro `assertNotVisible` `YYYY-MM-DD`) | absent (UI hierarchy scan) |
| Botanical / Garden Romance | absent (asserted) | absent (hierarchy scan) |
| GenericMotion | not used (dispatch test from NLC01 plus visible Ivory) | same |

Hard-failure check: **none triggered.**

Environment note: the host ran at load average 150–300 during iOS UAT. CoreSimulatorService crashed
once (`Mach error -308`) and the simulator was rebooted. This is classified ENV and did not affect
results.

## 5. Mutation accounting

- Wedding business-data writes: **1** (the authorized style PUT and its route-written AuditEvent).
- Production configuration / env / deploy / migration: none. Preview configuration: none.
- Guest token rotations: 0. Admin credential file: not read. `WEWED_PARITY_ALLOW_PASS_GET`: unset.

## 6. Open items

- iOS OPENING frame not captured on device (Android and web captured it).
- `main` production does not yet contain the NLC01 invitation-entry fix. A Release app that receives
  the link while the workspace is already showing (warm path) is still affected until that promotes
  separately. Cold-link and web behavior are unaffected.

## 7. Production promotion — PREPARED, STOPPED for authorization

Narrow scope: exactly `04ce1d70` on top of current `main` `ba4b08f8` (4 files above, no Phase 13
work). This needs a merge to `main` and a production deploy, which this unit may not do.

Required action (owner/moderator):

```
gh pr create --base main --head closure/inv-canon01-planner-canonical-ivory-20260927 \
  --title "feat(invitations): Planner/Couple studio shows the approved Ivory invitation (INV-CANON01)"
# review, then fast-forward merge (main is 04ce1d70's parent, so no other change rides along):
gh pr merge <PR#> --merge   # or: git push origin 04ce1d7000e8dbda98fcf61cc786c52e30a0cca4:main
# Vercel's Git integration then builds Production from main@04ce1d70.
```

Alternative without merging: `vercel promote` is **not** suitable, because the canon Preview was a
CLI Preview build with Preview env. Production must build from `main` with Production env.

Post-promotion check: production `/api/planner/guests/invitations` unchanged in contract; studio tile
shows `data-artwork="approved-closed"`; no other tile changes.
