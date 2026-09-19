# P0: Native Role Architecture and Private-Real Runtime Fidelity

Branch: `native-mobile/role-architecture-p0-20260919`, based on `native-mobile/wedding-identity-ui-20260918`.
Supersedes the role and persona sections of `NATIVE_ROLE_CAPABILITY_MATRIX.md` and `NATIVE_INFORMATION_ARCHITECTURE.md`.

## 1. Why this phase exists

The 2026-09-19 qualification report said `PRIVATE_REAL_SHADOW` passed. The screenshots attached to it show `Guest G013…` and `Guest Contributor`. Root cause:

- `.maestro/native-wireframe-screenshots.yaml` launched with `wewed_native_env: "shadow"`, which is the sanitized fixture.
- The sanitized fixture has the same aggregate counts as the real wedding: 174 guests, 2 attending, 172 pending.

So the screenshots were never private-real evidence. The private snapshot itself contains 0 pseudonyms. The private repositories already resolve contributors via `guestId` and fail when a relationship is broken.

Two further defects:

- **Roles were a free choice.** The login offered Couple/Usher/Planner chips, and a persona switcher could become Admin.
- **The Couple shell was titled "Wedding Planner" and acted as the whole app.**

## 2. Core contract (implemented, tested on both platforms)

| Concern | Android | iOS |
|---|---|---|
| Capabilities, grants, provenance | `models/AccessModels.kt` | `Models/AccessModels.swift` |
| Role → capability policy | `services/CapabilityPolicy.kt` | `Services/CapabilityPolicy.swift` |
| Scoped data gateway | `services/RoleScopedAccess.kt` | `Services/RoleScopedAccess.swift` |
| Sign-in and grants | `services/SessionAuthority.kt` | `Services/SessionAuthority.swift` |
| Active role | `state/SessionState.kt` (`SessionViewModel`) | `App/SessionStore.swift` |
| Venue links | `services/MapsLinkBuilder.kt` | `Services/MapsLinkBuilder.swift` |
| Worksheet CSV | `services/WorksheetCsv.kt` | `Services/WorksheetCsv.swift` |
| Tests | `RoleArchitectureTest`, `WorksheetCsvTest` | `RoleArchitectureTests`, `WorksheetCsvTests` |

Rules:

1. **Role grants.** A person never picks a role. `SessionAuthority` returns an `AuthorizedSession` with one or more `RoleGrant`s.
   - With one grant, the app enters that role directly.
   - With several grants, `RoleChooserScreen`/`RoleChooserView` lists only those grants.
   - `activate(role)` refuses any role the session was not granted.
2. **Provenance.**
   - `SOURCE_RECORD`: only the couple in private-real mode, because `Couple.userId` owns `Wedding.coupleId`.
   - `INVITATION_TOKEN`: guests.
   - `SANITIZED_FIXTURE`: the couple in sanitized mode.
   - `SHADOW_TEST_OVERLAY`: planner, vendor, usher, coordinator and admin. The source has `WeddingMembership=0`, and the planner record is an *accepted interest*, not an engagement.
   - Overlay grants carry a plain `provenanceNote`. Every shell must show it (see §4).
3. **Least privilege.** Non-couple shells receive only a `RoleScopedAccess`, never `AppViewModel`/`AppState` repositories. It throws `AccessDeniedException`/`AccessDeniedError` for anything outside the grant. The couple shell may keep using the repositories, because it holds every wedding-management capability.
4. **Stable guest identity.** Guest sessions are pinned to `grant.guestId`, and the repositories resolve a guest id as a token. After an RSVP, the fixed test token `shadow-pending-guest` moves on to the next pending guest, but the session stays with the same person.
5. **Explicit data source.** No launch argument means `SANITIZED_SHADOW`. `PRIVATE_REAL_SHADOW` must be requested explicitly and still fails loudly if the snapshot is missing.
6. **Launch arguments** are Android intent extras, and iOS launch arguments or environment variables. They drive UAT sign-in:
   - `wewed_native_env`
   - `wewed_shadow_account`: `couple` (default), `planner`, `couple_planner`, `guest`, `vendor`, `usher`, `coordinator`, `admin`
   - `wewed_invitation_token`

## 3. Capability matrix

| Capability | Couple | Planner | Coordinator | Vendor | Usher | Guest | Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Wedding summary, programme | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | summary |
| Planning dashboard | ✓ | ✓ | | | | | |
| Tasks: view / manage | ✓/✓ | ✓/✓ | ✓/– | | | | |
| Budget, guest roster, seating, documents | ✓ | ✓ | | | | | |
| Contributions and contributor identity | ✓ | ✓ | | | | | |
| All vendor engagements (incl. payment/contract) | ✓ | ✓ | | | | | |
| Own vendor engagement, own presence | | | | ✓ | | | |
| Vendor presence board | ✓ | ✓ | ✓ | | | | |
| Edit wedding details | ✓ | ✓ | | | | | |
| Preview guest passes | ✓ | ✓ | | | | | |
| Own invitation, RSVP, pass | | | | | | ✓ | |
| Gate scan and admission lookup | ✓ | ✓ | ✓ | | ✓ | | |
| Post announcement | | ✓ | ✓ | | | | |
| Planner workspace and actions | | ✓ | | | | | |
| Audited support reads | | | | | | | ✓ |

Admission lookup returns name, party size, admitted count and table, for attending guests only, and needs at least 2 characters.

## 4. Product rules for every screen

**Honesty**
- Every name, number and date comes from `RoleScopedAccess` or the repositories. Nothing is typed into a screen.
- When data is genuinely absent, say so plainly:
  - Content the source *has* but this app's copy does not carry (story, gallery, honeymoon fund, reminders, message text): "… isn't available in the app yet." Never claim the wedding has none.
  - Where source truth *confirms* zero (team members, contracts): "No … recorded for this wedding."
- No action may report success it did not achieve. Delete fake toasts ("Worksheet exported successfully").
- No developer vocabulary on screen: Shadow, sanitized, fixture, snapshot, private real, provenance, ECDSA, P-256, cryptographic, manifest, persona, test role, synthetic. Test identifiers carry provenance invisibly.
- Test-overlay grants show the notice `test-access-notice` near the top of the shell with the grant's `provenanceNote`, e.g. "Test access only. This planner's interest was accepted, but no planner engagement is recorded for this wedding."

**Accessibility (older and non-technical users)**
- Touch targets are at least 48dp / 44pt, and preferably 48 on both.
- Critical actions have visible text labels: Actions, Open in Maps, Scan pass, Sign out, Accept, Decline. Icons support the text and never replace it.
- Meaningful icons have `contentDescription` / `accessibilityLabel`. Decorative ones are hidden.
- Status is conveyed by text, with an icon if wanted. Colour is never the only signal.
- Text scales: `sp` on Android; on iOS use text styles (`.body`, `.headline` …) or `@ScaledMetric` in new or changed views, not fixed `.system(size:)`. At 130% font scale nothing critical may be clipped.
- Back always returns to the previous screen: `BackHandler` in Android sub-screens, and navigation stacks on iOS.
- Plain words ("My Wedding", "Planner Workspace", "Open in Maps", "Guests who have not replied").
- Every shell has an **Account** screen (`account-root`) with:
  - who is signed in (display name);
  - their current role, using `choiceLabel`;
  - the wedding;
  - "Switch to …" (`account-switch-role`), only when the session holds more than one grant;
  - "Sign out" (`account-sign-out`).

## 5. Shells

### Couple ("My Wedding"): the approved ivory shell
- Keep the Home / Plan / Guests / Pass / More layout and styling.
- The Plan header reads **"Our Wedding Plan"**. No "Wedding Planner" text anywhere in the couple shell.
- Couple-home "Open invitation" becomes a **preview** of what guests see:
  - Show `invitation-preview-notice`: "This is how your guests see their invitation. Guests reply from their own invitation."
  - The RSVP buttons do not mutate any guest.
- Invitation details and the Pass show a text button **"Open in Maps"** (`invitation-open-maps`, `pass-open-maps`), built with `MapsLinkBuilder` from `invitation.venue` / `pass.venue` (fallback: `wedding.venueLocation`).
  - Android: try the `geoUri` intent, catch `ActivityNotFoundException`, then open `webUrl`.
  - iOS: open `appleMapsUrl`.
  - If the builder returns null, show "Venue location not recorded".
- Contributions list each row as follows:
  - contributor (`contributorLabel`); `NOT_RECORDED` shows "Contributor not recorded";
  - type;
  - status (text);
  - "Public · 41 words · 18 Jun 2026";
  - `messageText` if present, else "Message text isn't available in the app yet."
  - Never an amount.
- More (`more-root`) rows are listed below. Each destination has a back action.

| Row | id | Content |
|---|---|---|
| Wedding Profile | `more-wedding-profile` | Wedding couple names, date, venue, city, country, and Open in Maps |
| Our Story | `more-story` | "Your wedding story isn't available in the app yet." |
| Gallery | `more-gallery` | "Wedding photos aren't available in the app yet." |
| Honeymoon & Gifts | `more-honeymoon` | Contributions summary (count, types) and a link to the contributions list; the honeymoon fund itself isn't available in the app yet |
| Settings | `more-settings` | The Account screen |
| Help & Support | `more-support` | Wewed support: `support@wewed.pro` (mailto) and the Help Centre `https://wewed.pro/help`, both canonical in `src/lib/email/addresses.ts` and `src/lib/public-site-documents.ts`. No version or crypto strings. |

  Empty states use the id `more-empty-state`.

### Guest ("My Invitation"): `guest-shell-root`
Tabs: **Invitation**, **My Pass**, **Wedding Info**, **Account**.
- **Invitation:**
  - The ivory invitation for `access.ownInvitation()`.
  - Accept and Decline call `access.respondToOwnInvitation(...)`.
  - After accepting, the "View my pass" action switches to My Pass.
  - "Open in Maps" is available.
- **My Pass:**
  - `access.ownPass()`: the card `wedding-pass-card`, QR `wedding-pass-qr`, guest name `guest-pass-guest-name`, table if any, and `pass-open-maps`.
  - If null, show `guest-pass-unavailable`: "Your pass appears here after you accept your invitation."
- **Wedding Info:** couple, date, venue with Open in Maps, and programme (`access.programme()`). No roster, budget or vendors.

### Planner ("Planner Workspace"): `planner-workspace-root`
Tabs: **Workspace**, **Daily Ops**, **Wedding Day**, **More**. The test-access notice sits at the top of the shell.

- **Workspace** (web Planning Workspace):
  - **Header.** The client selector `planner-client-selector` lists authorized weddings only; today that is one, from `grant.weddingTitle`. It shows the date and venue.
  - **Worksheet picker** `planner-worksheet-picker` with `planner-worksheet-<slug>`: Overview, Tasks, Budget, Guests, Vendors, Contributions, Seating, Timeline, Documents. It uses `PlannerWorksheet`.
  - **Worksheet bodies:**
    - **Overview:** figures from `access.dashboard()`.
    - **Tasks:** toggle done via `toggleTask`.
    - **Budget:** lines with estimated, actual and paid.
    - **Guests:** search, RSVP status as text.
    - **Vendors:** all engagements with contract and payment status.
    - **Contributions:** the couple rules above.
    - **Seating:** tables with capacity and assigned counts.
    - **Timeline:** programme.
    - **Documents:** list, or "No contracts or documents recorded for this wedding."
  - **Actions** button `planner-actions-button`, with a visible "Actions" label. It opens `planner-actions-sheet`:

| Action | id | Behaviour |
|---|---|---|
| Refresh data | `planner-action-refresh` | Reload the current worksheet and header from `access` |
| Switch worksheet | `planner-action-switch` | Opens the worksheet picker |
| Print | `planner-action-print` | System print of the current worksheet, or the current selection, as an HTML table. Android: `PrintManager` + `WebView`. iOS: `UIPrintInteractionController` + `UIMarkupTextPrintFormatter`. |
| Arrange | `planner-action-arrange` | Order rows: Default, Name A–Z, Status, Due date (where applicable). Labelled "Arrange (this device)" because the order is not synced |
| Select | `planner-action-select` | Multi-select rows. Bulk actions: Tasks → "Mark done" / "Mark to do", with a confirmation stating the count. All worksheets → "Export selected", "Print selected" |
| Template | `planner-action-template` | Share `WorksheetCsv.template(ws)` as `ws.templateFileName` |
| Export | `planner-action-export` | Share the current worksheet CSV via `WorksheetCsv.<ws>(…)` as `ws.exportFileName`. Android: `FileProvider` + `ACTION_SEND`. iOS: `ShareLink` / `UIActivityViewController`. Disabled on Overview |
| Import | `planner-action-import` | Tasks only. Pick a CSV (Android `ACTION_OPEN_DOCUMENT`, iOS `fileImporter`). Then `WorksheetCsv.previewTaskImport`, a preview screen listing valid row count and per-row errors, confirm, `access.createTask` for each valid row, and a result screen. On other worksheets it is shown disabled with the text "Import for this worksheet is available in the web workspace." |
| Recent imports | `planner-action-recent-imports` | `ImportRecord`s from this app session: worksheet, time, created, skipped, errors. Titled "Imports on this device" |
| Edit wedding details | `planner-action-edit-wedding` | Opens the Client Profile editor |

  Actions require `PLANNER_ACTIONS`. Export and Print hand data to other apps only on an explicit tap.
- **Daily Ops** (`planner-daily-ops-root`), derived from tasks and guests:
  - overdue open tasks (due date before today);
  - tasks due in the next 7 days;
  - open high-priority tasks;
  - guests who have not replied (count);
  - vendor presence.
- **Wedding Day** (`planner-wedding-day-root`):
  - check-in summary `access.admissionSummary()`, plus a "Scan pass" button opening the existing scanner;
  - run sheet (programme);
  - tables summary.
- **More** (`planner-more-root`):
  - **Client Profile** (`planner-client-profile-root`): couple, date, venue, city, country, lifecycle, the planner relationship note, and Open in Maps. Edit via a form with a Save confirmation calling `access.updateWeddingDetails`.
  - **Team Hub** (`planner-team-hub-root`): "No team members have been added to this wedding." (source: memberships 0), plus the planner relationship note.
  - **Invitations & QR** (`planner-invitations-root`):
    - RSVP counts as text: replied yes, replied no, not replied;
    - the attending guest list with "Preview pass" (`access.previewGuestPass(guestId)`);
    - export of the guest list via `WorksheetCsv.guests`.
  - **Intelligence** (`planner-intelligence-root`): recommendations computed from the graph, each with the evidence count and a "Create task" button (`access.createTask`). Examples:
    - overdue tasks;
    - high-priority open tasks;
    - % of guests not replied;
    - free seats vs attending;
    - unpaid budget lines;
    - no contracts recorded.
  - **Account.** Plus Help & Support as in the couple shell.

  Remove `GenericToolDestination` screens with typed-in sections (Release Centre, Notebook, AI Workspace, Portfolio, Bookings, Contract Governance/Intelligence, Marketplace Profile, Master Calendar, Messages, Vendor Catalog…) unless rebuilt from `access`.

### Vendor ("My Vendor Work"): `vendor-shell-root`
Tabs: **My Work**, **Schedule**, **Account**.
- **My Work** (`vendor-engagement-root`):
  - own engagement from `access.vendorEngagements()`: service, booking status, contract status, payment status;
  - own presence from `access.vendorPresence()`, with "Update my status" buttons (`vendor-status-<state>`) calling `access.updateOwnVendorPresence`.
- **Schedule** (`vendor-schedule-root`): wedding date, venue with Open in Maps, and programme.
- No guest data of any kind.

### Gate team ("Gate Check-In"): `usher-shell-root`
Tabs: **Scan**, **Admissions**, **Account**.
- **Scan** (`usher-scan-root`): a large "Scan pass" button (`usher-scanner-open`) opening the existing scanner, bound to `access.admit`. It also has manual code entry.
- **Admissions** (`usher-admissions-root`):
  - summary counts as text;
  - name lookup (`usher-lookup-field`) via `access.admissionLookup`, showing party size, admitted, remaining and table;
  - this device's scan history via `access.admissionHistory()`.

### Coordinator ("Wedding-Day Coordination"): `coordinator-shell-root`
Tabs: **Run Sheet**, **Tasks**, **Vendors**, **Gate**, **Account**.
- **Run Sheet:** programme.
- **Tasks:** read-only list with status text.
- **Vendors:** presence board, names and states only, no money.
- **Gate:** as in the Gate team shell.

### Wewed Support ("Wewed Support"): `admin-shell-root`
Tabs: **Support**, **Audit log**, **Account**.
- **Support** (`admin-support-root`): the wedding card and buttons such as "Open guest list (recorded)" (`admin-open-guests`), "Open tasks (recorded)" and "Open vendors (recorded)". Each calls `access.supportRead(section)` and shows a read-only result with the notice "This view was recorded in the audit log."
- **Audit log** (`admin-audit-root`): `access.auditEntries()` with section and time.

## 6. Test identifiers

Existing couple identifiers stay as they are: `home-root`, `planner-root`, `guests-root`, `guests-search`, `pass-root`, `more-root`, `wedding-pass-card`, `wedding-pass-qr`, `ivory-invitation-root`, `ivory-rsvp-accept`, `ivory-rsvp-decline`, `ivory-view-wedding-pass`, `home-open-invitation`, `planner-module-*`, `planner-*-root`. Every identifier above must exist on both platforms: `Modifier.testTag` with `testTagsAsResourceId` on Android, `.accessibilityIdentifier` on iOS.

## 7. Qualification

| Evidence class | Data | Where it may go |
|---|---|---|
| Sanitized CI | `SANITIZED_SHADOW` (pseudonyms are correct here) | GitHub Actions, committed Maestro flows, uploaded screenshots, visual regression |
| Private-real local | `PRIVATE_REAL_SHADOW` | This machine only. Never commit or upload screenshots, view dumps or names. Report counts only |

Private-real proof (`scripts/native/private-real-qualification.sh`):
- The snapshot fingerprint matches what the app loaded.
- Zero `Guest G\d+` and zero `Guest Contributor` in the view hierarchy of every visited screen.
- 174 guest records.
- The invitation, RSVP and pass all show the same person.

The script prints counts only, and screenshots stay in `~/.wewed-shadow/…/qualification/`.
