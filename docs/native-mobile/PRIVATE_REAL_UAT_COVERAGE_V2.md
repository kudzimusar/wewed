# Private Real UAT Coverage — V2

**Environment:** `PRIVATE_REAL_SHADOW` · **Wedding:** Charity & Kudzie (`cmqos70cb0004q6vxe9g9aiu5`)
**Snapshot schema:** `private-real-uat/2` · **Reconciled:** 2026-09-20

This ledger records, for every domain, what production holds, what the protected snapshot carries,
and whether each platform models and renders it. It is the answer to a specific failure: the
September-18 export omitted several populated tables, and because nothing reconciled the two, the
app reported those domains as "unsupported" while production held thousands of rows.

No private value appears in this file. Counts, schema and status only.

---

## 1. How the graph reaches the app

```
READ-ONLY PRODUCTION
  → extract_private_real_uat_snapshot.py     explicit column allowlist, never SELECT *
  → build_canonical_uat_snapshot.py          one versioned schema, content hash, domain counts
  → protected local snapshot (mode 600, outside the repository)
  → provision_private_real_shadow.sh         app-private storage on both platforms
  → Android + iOS read the SAME logical schema
```

A snapshot whose `metadata.schemaVersion` is not `private-real-uat/2` is **rejected at load** on both
platforms rather than parsed partially. Provisioning has failed silently before, leaving a device on
an older graph while the environment badge still read "Private Real"; the version check and the
runtime manifest (`UatSnapshotManifest`) make the loaded graph testable instead of assumed.

---

## 2. Guest reconciliation (174 → 175)

| Question | Answer |
|---|---|
| Production Guest rows | **175** |
| Snapshot Guest rows | **175** |
| Why the count rose | One bridal-party guest created **2026-09-19**, after the September-18 export |
| Does the new row belong to this wedding | **Yes** — `weddingId` matches, side `bride`, role `bridal_party` |
| Guests scoped to another wedding | **0** |
| Guests with an RSVP row | **175 of 175** |
| Orphan RSVP rows | **0** |
| Distinct names | **174 across 175 rows** |
| Duplicate-name explanation | Two separate production rows share one name — created six minutes apart on 2026-09-12, different `side` (neutral / groom) and `role` (guest / family), neither with an email. Both are rendered. Deduplicating them in the app would hide a production data-quality fact that belongs to the couple, not to us. |
| Quarantined rows | **0** |
| Seated guests | **22** (8 tables, capacity 64) |
| Derived party capacity | **178** — guest + confirmed plus-one + children, since production's `Guest` table has no `partySize` column |
| Attending / pending / declined | **2 / 173 / 0** |
| Checked in | **1** |

The earlier claim of "173 distinct of 174" is superseded. Both platforms assert **175** *and* assert
it against the snapshot's own manifest, so a stale snapshot fails loudly instead of re-baselining.

---

## 3. Domain ledger

Legend — **Model**: a native type exists. **Rendered**: it reaches a screen.

### Consumed and rendered

| Domain | Production | Snapshot | Android model | Android rendered | iOS model | iOS rendered |
|---|---:|---:|---|---|---|---|
| Guest | 175 | 175 | ✅ | ✅ Guest List, RSVP, Seating | ✅ | ✅ |
| RSVP | 175 | 175 | ✅ `GuestRsvpDetail` | ✅ RSVP detail | ✅ | ✅ |
| WeddingContent | 107 | 107 | ✅ `WeddingContentEntry` | ✅ 12 sections | ✅ | ✅ |
| PlannerTask | 42 | 42 | ✅ | ✅ Tasks, Intelligence | ✅ | ✅ |
| ImportJob | 40 | 40 | ✅ `ImportJobRecord` | ✅ Recent Imports | ✅ | ✅ |
| Song | 27 | 27 | ✅ `SongEntry` | ✅ Songbook | ✅ | ✅ |
| BudgetItem | 22 | 22 | ✅ | ✅ Budget | ✅ | ✅ |
| ProgrammeItem | 13 | 13 | ✅ | ✅ Programme | ✅ | ✅ |
| SeatingTable | 8 | 8 | ✅ | ✅ Seating | ✅ | ✅ |
| ServiceEngagement | 8 | 8 | ✅ | ✅ Vendors | ✅ | ✅ |
| Vendor | 7 | 7 | ✅ | ✅ Vendors, Services | ✅ | ✅ |
| ContentRevision | 7 | 7 | ✅ `ContentRevisionRecord` | ✅ Content History | ✅ | ✅ |
| GuestContribution | 4 | 4 | ✅ | ✅ Contributions | ✅ | ✅ |
| EngagementParty | 3 | 3 | ✅ `EngagementPartyRecord` | ✅ Vendor Services | ✅ | ✅ |
| Message | 3 | 3 | ✅ `WallMessage` | ✅ Live Wall | ✅ | ✅ |
| QRDestination | 1 | 1 | ✅ `QrDestination` | ✅ Invitations & QR | ✅ | ✅ |
| PlannerEnquiry | 1 | 1 | ✅ `PlannerAccessContext` | ✅ Client Profile, Team Hub | ✅ | ✅ |
| PlannerProfile | 1 | 1 | ✅ | ✅ Team Hub | ✅ | ✅ |

### Gated by authorization — not absent

| Domain | Production | Status |
|---|---|---|
| AuditEvent | 275 | Extracted and modelled (`AuditEventRecord`); Admin surface **gated** until the read-only grant exists. Both platforms name the blocker rather than reporting "Nothing recorded". |
| SupportCase | unknown | `permission denied` for `wewed_shadow_reader` |
| BusinessAuditLog | unknown | `permission denied` |
| PlannerShortlist | unknown | `permission denied` |
| ProviderEnquiry | unknown | `permission denied` |
| BusinessAccount | 0 visible | No rows visible to this reader |

### Production genuinely holds zero — honest empty, not a gap

`MediaItem` · `Contract` · `ContractVersion` · `Comment` · `Notification` · `VaultObject` ·
`VaultLink` · `Reminder` · `PlannerEngagement` · `WeddingMembership`

`MediaItem = 0` is the reason Gallery was reported empty. **Gallery is not empty**: the couple's
media lives in `WeddingContent`, which carries a real heading, subtitle and four preview references.

---

## 4. WeddingContent by section

| Section | Rows | Native surface |
|---|---:|---|
| venue | 25 | Wedding Day → Venue |
| theday | 18 | Wedding Day → The Day |
| faq | 10 | Wedding Day → FAQ |
| guests | 10 | Guest-facing wedding info |
| story | 9 | Couple More → Our Story · Guest More → Our Story |
| hero | 6 | Home hero |
| gallery | 6 | Couple More → Gallery · Guest More → Gallery · Media Archive |
| vendors | 6 | Vendors |
| songbook | 5 | Songbook |
| travel | 5 | Wedding Day → Travel |
| memory | 4 | Memory |
| after | 3 | After / post-wedding |

Gallery references resolve against the native bundle: `hero-wedding` and `ornament-frame` render as
images; `couple-silhouette` and `icon-512` are published for the web experience and are marked
**Not bundled**. A published reference the app cannot resolve is stated, never hidden or faked.

---

## 5. Planner — Eleven Eleven Testing

| Fact | Value |
|---|---|
| PlannerProfile | Real. Status `suspended`, teamSize 300, completedWeddings 40 |
| PlannerEnquiry | Real, `accepted_interest` |
| PlannerEngagement | **0** |
| WeddingMembership | **0** |
| Access basis | **`UAT_OVERLAY`** |
| Shown to the user as | "UAT test access — no production engagement on record" |

The UAT overlay authorizes this planner to exercise Charity & Kudzie. The app says so. Rendering it
as a client relationship would be a fabrication, and both platforms assert `UAT_OVERLAY` in tests.

**Still not discovered through the authorized read:** planner↔couple private correspondence,
per-member team roster, planner documents, planner notifications. Classified
**NOT YET DISCOVERED / NOT AUTHORIZED** — *not* "solved by Message = 3", which are public wall posts.

---

## 6. Privacy boundary

| Check | Result |
|---|---|
| `SELECT *` in the extraction path | **0** |
| Allowlisted columns | 366 across 30 tables |
| Credential / forensics values dropped | **1,378** |
| `RSVP.token` in the snapshot | **0** (was 175) |
| `Guest.contributionToken` | **0** (was 175) |
| `Message.authorToken` | **0** (was 3) |
| `ImportJob.rollbackToken` / `rollbackData` / `previewData` | **0** each (was 40) |
| `AuditEvent.ipAddress` / `userAgent` / `beforeValue` / `afterValue` | **0** each (was 275) |
| Private names in committed Maestro YAML | **0** |
| Private PII committed to Git | **No** |

Both platforms assert the provisioned file on disk carries none of these.

---

## 7. Runtime verification

| Lane | Result |
|---|---|
| Android unit tests | 144 pass |
| iOS unit tests | 146 pass |
| Private Real fidelity tests | 13 per platform, all pass against the real graph |
| Android UAT flow | 68 assertions, exit 0 |
| iOS UAT flow | 57 assertions, exit 0 |

Both UAT lanes assert the same counts, which is what makes cross-platform data parity a test rather
than a claim. The fidelity suite includes an **adapter-gap detector**: every domain the manifest
counts must be readable through the repository, so a domain present in the snapshot but unread
fails rather than rendering as an honest-looking empty screen.

**Operational rule:** `clearState: true` and app re-installs both wipe the app-private snapshot.
Run sanitized flows first, then provision, then the UAT lane.
