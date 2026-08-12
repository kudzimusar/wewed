# Canonical Wedding Social Template Plan

Status: implementation plan and release contract
Branch: `feat/canonical-wedding-social-template`
Reference experience: `https://wewed.pro/w/charity-and-kudzie`
First non-flagship proof: `https://wewed.pro/w/john-and-chido-s-wedding-34bbbe50`

## 1. Goal

Turn the Charity & Kudzie wedding experience into the single canonical Wewed wedding social-site template for every couple, while preserving its present visual quality, interaction quality and before/after lifecycle. Remove the current architectural split where Charity & Kudzie receives the complete experience and all other weddings receive a reduced generic experience.

The finished system must render the same component architecture for every wedding. Differences between couples must come from wedding-scoped data, privacy, permissions, lifecycle, theme and content completeness — never from a couple-specific frontend branch.

## 2. Quality-preservation rule

The current Charity & Kudzie experience is the visual and functional golden master. Generalisation must change where data comes from, not downgrade the experience.

Quality is maintained by:

1. Keeping the existing flagship component composition, spacing, typography, animation, section rhythm, before/after structure and responsive behaviour as the canonical renderer.
2. Replacing Charity-specific literals with wedding-scoped data and safe template defaults rather than replacing rich sections with generic cards.
3. Preserving section-level graceful empty states so incomplete couples remain attractive while editing their site.
4. Keeping the flagship wedding as a regression fixture: after each migration step, Charity & Kudzie must remain visually and functionally equivalent to the current production experience.
5. Testing desktop, mobile, authenticated couple, authenticated planner where applicable, and guest states before merge.

## 3. Product definition

A Wewed wedding site is not only a digital invitation. It is the couple's wedding social space shared with invited guests before, during and after the ceremony. It connects the public/guest experience to the same wedding record used by the couple and planner workspaces.

The canonical site includes the current flagship capabilities where data and permissions allow them: hero identity, countdown, story, venue, programme/the day, RSVP, travel/stay, gifts, songbook, introductions, guests/wedding party, vendor discovery, QR/check-in surfaces, gallery, media contribution, memory capsule, live wall, guest contributions, FAQ, sharing and after-wedding memories.

## 4. One source of truth

The public wedding site, couple workspace and planner workspace must consume the same wedding-scoped data.

Canonical ownership principles:

- `Wedding` / `Couple`: identity, date, venue, lifecycle, privacy, theme and core event facts.
- `WeddingContent`: editorial copy and section-specific text.
- `ProgrammeItem`: authoritative structured programme/schedule.
- `Guest` and RSVP records: authoritative invitation/attendance state.
- `Song`: authoritative music/songbook data.
- `MediaItem` and wedding-scoped media references: hero, couple/family, venue, gallery and memory media.
- `GuestContribution`, `Message`, `Comment`: guest social activity.
- Membership / planner engagement / planner permission models: private access to couple/planner operations.

Browser `localStorage` may support transient UI preferences or caches but must not become the authoritative store for shared wedding content.

## 5. Starter-template content for every new couple

Every new wedding should begin with short fictitious/example content so the couple understands what belongs in each field and can edit from a complete-looking site rather than a blank form.

Rules:

- Starter copy must be clearly generic and non-sensitive.
- It must be short enough to invite editing, not appear to be real facts.
- It must never contain Charity, Kudzie, Musarurwa, Imba Manor or any other real flagship-specific content.
- Core identity fields derived from the wedding record (couple names, date, venue) always override examples.
- Example story milestones, travel cards, FAQs, dress-code wording, venue description, gift note and social prompts are seeded per wedding only when the couple has not supplied real content.
- The seed contract is versioned so future template improvements do not silently overwrite existing couple edits.

Example starter tone:

- Story: “We met through friends and quickly discovered how much we enjoyed building a life together.”
- Venue note: “Our ceremony and reception will take place here. Add parking, access and arrival details for your guests.”
- Dress code: “Formal — edit this to match your celebration.”
- Travel: “Add nearby accommodation, transport and out-of-town guest advice.”
- FAQ: “What time should I arrive? Add the answer your guests need.”

## 6. Privacy and access boundary

Guest privacy is a release-blocking requirement.

### Guest state

A guest may access only the wedding's guest-facing social site and explicitly public/guest-authorised actions such as RSVP, approved contributions, sharing, guest help, public vendor discovery and other wedding-site interactions.

A guest must never receive navigation, CTA affordances, deep links or API authorisation to:

- couple dashboard;
- couple workspace;
- planner workspace;
- admin console;
- content editing;
- planner-only operations;
- private guest-management data;
- budgets, contracts, tasks, private notes, vendor negotiations or private couple/planner communication.

Hiding a button is not sufficient. Server-side access controls remain authoritative. UI gating is an additional privacy layer.

### Authenticated couple state

When the real couple is authenticated for the active wedding, the wedding site may reveal focused owner controls such as:

- Couple Dashboard / Couple Workspace;
- Edit;
- Share / QR;
- AI assistant;
- keyboard shortcuts/help;
- logout/account controls;
- planner-related navigation that is specifically intended for the couple.

### Authenticated planner state

A planner must receive only controls granted by the active wedding/planning-company relationship and existing permission model. Planner operations are never inferred merely because the wedding has a planner.

### Admin state

The Admin Console must only be visible to a genuinely authenticated Wewed admin. It must never be presented to guests as a public feature.

## 7. Minimal wedding-site control surface

The present floating-control cluster is too crowded for the guest experience. The canonical site must have a focused, role-aware control surface.

### Guest-visible critical controls

Keep only controls that materially help a guest use the social site, such as:

- guest-safe AI/chat/help experience when configured for public use;
- Share / QR where appropriate;
- music control only when ambient music is active;
- compact accessibility/navigation support when needed.

Do not expose admin, couple-login/dashboard, edit or planner-workspace controls to ordinary guests.

### Couple-visible controls

Only after the authenticated couple has been resolved for the active wedding may the site add:

- Edit;
- Couple Dashboard / Workspace;
- couple-scoped AI;
- Share / QR;
- keyboard shortcuts;
- account/logout;
- planner navigation intended for the couple.

### Admin-visible controls

Admin Console appears only for authenticated admins. It must not compete visually with guest controls; owner/admin actions should be consolidated into one compact owner-tools surface where possible.

## 8. Top navigation privacy

The top navigation must remain primarily the wedding's social-site navigation: Story, The Day, RSVP, Songbook, Guests, FAQ and appropriate secondary sections.

The Planner CTA/control in the current flagship top navigation must not be shown to guests. It is reserved for an authenticated couple or an appropriately authorised planner/admin context.

The Wewed platform strip may retain safe links such as Powered by Wewed, Find a planner and Guest help, but must not provide private workspace entry points to guests.

## 9. Canonical renderer migration

### Current state

`WeddingHome` explicitly branches on the Charity & Kudzie flagship slug:

- flagship -> rich Charity experience;
- non-flagship -> `DataBackedWeddingExperience` reduced experience.

### Target state

All weddings use the rich canonical wedding renderer. The flagship slug may remain useful as a regression fixture, but it must no longer control which frontend architecture is used.

Implementation must:

1. Remove the reduced non-flagship rendering branch.
2. Make all reusable wedding components wedding-neutral.
3. Replace Charity-specific literals in hero, story, countdown, calendar/maps and related components with active-wedding data or generic starter defaults.
4. Preserve current flagship visuals.
5. Ensure incomplete weddings degrade gracefully instead of reverting to another layout.

## 10. Data canonicalisation

### Programme

`ProgrammeItem` becomes the structured programme source. `WeddingContent` retains headings/introductory copy, not a competing schedule truth.

### Countdown / calendar / directions

Countdown and calendar outputs must derive from the active wedding and programme data, including the event timezone or deterministic location timezone policy. No Charity-specific timestamp, title, map destination or `.ics` filename may exist in reusable components.

### Media

Hero, couple/family, venue and gallery imagery must resolve through wedding-scoped data/media. Existing flagship assets can remain as Charity's configured media/fallback during migration but reusable components must not label them as generic content for other couples.

### Editing

Shared edits must persist server-side against the active wedding. Browser-local editing must not be the only persistence mechanism for content that guests, couples and planners share.

## 11. Implementation sequence in this PR

1. Commit this plan first.
2. Introduce a canonical starter-content/default resolver using active wedding identity and neutral example copy.
3. Generalise flagship components and eliminate Charity-specific operational literals.
4. Switch all weddings to the canonical rich renderer.
5. Add role-aware wedding-site chrome so guests never see private owner/planner/admin controls.
6. Consolidate/minimise floating controls by role.
7. Preserve safe guest-facing Wewed navigation.
8. Seed/resolve useful starter content for incomplete weddings, including John & Chido, without overwriting existing real data.
9. Add tests covering renderer parity, privacy boundaries, neutral defaults and couple/admin gating.
10. Run the repository release/CI matrix on the exact PR head.
11. Stop before merge for user UAT.

## 12. Acceptance criteria

### Visual quality

- Charity & Kudzie retains its current premium layout and major feature set.
- John & Chido renders the same canonical layout/component structure, populated by their own data plus neutral starter guidance where real data is absent.
- Mobile and desktop remain coherent.

### Genericity

- No non-test reusable wedding component contains Charity/Kudzie/Musarurwa/Imba-specific operational defaults.
- The full experience is selected by wedding data, not by the flagship slug.

### Privacy

- Guest UI contains no Couple Dashboard, Planner Workspace, Edit or Admin Console control.
- Planner navigation in the wedding header is absent for guests.
- Couple-only controls appear only after active-wedding couple authentication.
- Admin Console appears only after admin authentication.
- Existing server-side access enforcement continues to block direct private-route/API access.

### Data integrity

- Countdown uses the active wedding.
- Calendar/export uses the active wedding.
- Directions use the active venue.
- Programme has one canonical structured source.
- Existing wedding content is never overwritten by template starter copy.

### Social-site behaviour

- Guests can remain inside the wedding social experience for permitted RSVP, contributions, songs, gallery/memory and sharing functions.
- Couple/planner workspaces remain private operational surfaces connected through the same wedding record.

## 13. UAT matrix before merge

Test at minimum:

1. Charity & Kudzie as unauthenticated/public guest.
2. Charity & Kudzie as authenticated couple.
3. Charity & Kudzie as authenticated admin.
4. John & Chido as link-authorised guest.
5. John & Chido as authenticated couple.
6. Direct attempts by guest to open couple/planner/admin surfaces.
7. Before and After lifecycle rendering.
8. Desktop and mobile widths.
9. Fresh browser/no localStorage state.
10. Editing persistence across refresh/new session where covered by the migrated editor path.

## 14. Merge policy

This work remains in one PR and is not merged automatically. The PR is ready for user UAT only after the exact head passes required automated checks. Merge happens only after the Charity quality gate, John & Chido parity gate and guest-privacy gate are manually accepted.
