# Wewed Digital Invitation Experience System

**Plan stamp:** `WW-DIGITAL-INVITE-EXPERIENCE-2026-09-10-01`  
**Status:** Authoritative implementation plan  
**Reference experience:** Card 1 — Ivory Floral Gold  
**Primary surfaces:** Planner Card Studio, personal guest invitation, RSVP/wedding experience  
**Delivery foundation:** Smart personal invitation handoff (PR #194)  

## 1. Goal

Replace Wewed's current generic, static digital wedding-card templates with a reusable premium invitation system that feels like receiving and opening a real wedding invitation while remaining secure, mobile-first, accessible and economical on data.

The reference guest journey is:

**personal invitation link / QR / reminder → secure smart invitation handoff → closed invitation object → guest opens it → restrained gold/light reveal → physical-style panels/envelope unfold → personalised invitation is revealed → themed wedding information → scoped RSVP.**

The system must not depend on a large autoplay video. Motion is produced primarily with HTML/CSS transforms, SVG/vector decoration and lightweight image assets so the invitation remains interactive and data-efficient.

## 2. Problems being removed

The current Card Studio and guest renderer have three static layouts — Botanical, Editorial and Midnight — and treat a digital invitation as a large rectangular web card. The current implementation also contains generic placeholder presentation and copy such as `Together with their families` and `Your invited guest`, which is not acceptable for a premium personalised invitation.

The replacement must fix:

- oversized/stretched cards on desktop;
- static/dormant presentation;
- no opening ritual or reveal;
- weak personalisation;
- giant stacked previews in Planner;
- duplicated per-template React layout logic;
- no reusable motion model;
- abrupt visual transition from card to generic RSVP UI;
- incorrect generic family wording;
- unnecessary data cost if rich motion were implemented as video;
- insufficient reduced-motion/accessibility treatment.

## 3. Product principles

1. **Invitation first, webpage second.** A guest receives an object that opens, not a generic landing page.
2. **Real interaction, not simulated video.** The guest controls the reveal and can interact with the result.
3. **Mobile first.** A mid-range Android phone and constrained mobile network are first-class targets.
4. **Data frugal.** No core autoplay video. Initial scene and fonts should be compact; heavy decorative assets lazy-load only when required.
5. **Personal by design.** Real guest identity is injected after secure guest access is established.
6. **Theme continuity.** RSVP and wedding-detail surfaces inherit the selected invitation palette and typography.
7. **One engine, many cards.** Themes and motions are configuration/data, not independent applications.
8. **Security boundaries remain explicit.** Personal RSVP identity and shared bulk physical-card access remain separate.
9. **Accessibility is part of the design.** Keyboard/touch operation, semantic content and `prefers-reduced-motion` are release requirements.
10. **No invented wedding facts.** Templates render only data that exists.

## 4. Architecture

The digital invitation is decomposed into four independent layers:

```text
Wedding data
    +
Guest identity/session
    +
Invitation theme
    +
Motion preset
    ↓
Personalised interactive invitation experience
```

### 4.1 Theme registry

Create a central invitation-theme registry. Each theme declares:

- stable id;
- display name and description;
- collection/category tags;
- palette tokens;
- typography treatment;
- opening mechanism / motion preset;
- atmosphere preset;
- panel/background decoration style;
- whether it supports tri-fold, envelope, gate-fold, book or single-card presentation;
- preview metadata;
- optional constraints on editable colours;
- legacy aliases where necessary.

The registry becomes the single source of truth for Planner selection, guest rendering, sharing links and tests.

### 4.2 Motion engine

Build a reusable client-side `InvitationMotionExperience` layer with explicit states:

`closed → preparing → opening → open → details`

Supported first-release motion families:

- `tri-fold`
- `envelope-letter`
- `gate-fold`
- `book-open`
- `single-card-lift`
- `floral-reveal`
- `sleeve-pull`

Each motion must expose the same semantic controls: **Open invitation**, **Replay** in Planner preview only, and **Continue to wedding details**.

Motion must use CSS transforms/opacity/filter and small SVG/CSS effects where possible. WebGL is not required for the first release.

### 4.3 Atmosphere layer

Reusable restrained atmosphere presets:

- champagne/gold glow;
- soft bokeh;
- floral/petal drift;
- candlelight;
- stars;
- watercolour bloom;
- no-motion/minimal.

Effects run briefly around the reveal and settle. Continuous flashing/sparkling is prohibited.

### 4.4 Data binding

The renderer consumes normalized invitation data rather than template-specific hard-coded wedding facts. Required bindings include:

- wedding title / couple names;
- monogram;
- date;
- venue and available location information;
- personalised guest name when a personal guest session exists;
- couple invitation message;
- RSVP deadline only when configured;
- theme and card id.

Shared physical invitation access may render a non-personalised public/shared form but must never impersonate a named guest.

## 5. Card 1 — Ivory Floral Gold reference implementation

Card 1 is the visual and interaction benchmark for the system.

### 5.1 Reference wedding

- Bride: Charity Manyewu
- Groom: Shadreck Kudzanai Musarurwa
- Date: Wednesday, 23 December 2026
- Venue: Imba Manor
- Address: 1 Worplestone Way, Glen Lorne, Harare, Zimbabwe
- Wedding site: `https://wewed.pro/w/charity-and-kudzie`
- Correct family wording: **TOGETHER WITH OUR FAMILIES**
- Correct invitation wording: **REQUEST THE PLEASURE OF YOUR COMPANY AS WE CELEBRATE OUR MARRIAGE**

No ceremony time, dress code, deadline or other missing fact may be invented.

### 5.2 Tri-fold interaction

The digital version behaves like the physical three-fold invitation:

1. Closed invitation appears centred at a deliberate card proportion.
2. Guest taps **Open invitation**.
3. Champagne-gold edge light traces the object.
4. The left and right panels unfold with perspective and realistic changing shadows.
5. The central panel becomes the visual hero.
6. The personalised guest treatment resolves into place.
7. The reveal settles; decorative motion stops.
8. The guest can continue to wedding details / RSVP without leaving the themed experience.

The inside panel structure mirrors the physical reference:

- left: **OUR JOURNEY**, Psalm 126:3 and gratitude copy;
- centre: **TOGETHER WITH OUR FAMILIES**, couple names, invitation request, date and venue;
- right: **A BRIGHTER TOMORROW**, Ephesians 5:31 and gratitude copy.

The digital experience must not expose the bulk-print access code as a personal RSVP credential.

### 5.3 Responsive behaviour

Desktop:

- invitation is centred within an atmospheric stage;
- hard maximum width prevents monitor-sized stretching;
- the open tri-fold remains readable without filling the entire viewport;
- details continue below the stage.

Mobile:

- closed object uses approximately 90–94% of usable width;
- camera/scene scales back during unfolding so three panels remain visible;
- after reveal, guest may focus/read the centre and then scroll to an accessible text/details flow;
- touch targets remain at least 44px equivalent;
- no horizontal document overflow.

## 6. Premium launch collection

The first registry should provide a meaningful choice, not only recoloured clones. Initial themes:

1. Ivory Floral Gold — tri-fold, champagne glow;
2. Midnight Gold — gate-fold, starlight/gold;
3. Garden Romance — floral reveal, sage/ivory;
4. Royal Emerald — envelope/letter, emerald/champagne;
5. Classic White — book/open stationery, blind-emboss aesthetic;
6. Blush Romance — envelope/letter, blush/champagne;
7. African Luxe — gate-fold with restrained premium geometric motifs;
8. Modern Editorial — single-card lift/editorial reveal;
9. Black Tie — gate-fold/minimal black and ivory;
10. Watercolour Garden — floral reveal;
11. Sunset Terracotta — sleeve pull, warm earth/champagne;
12. Celestial — book/open or gate-fold, midnight/stars.

The engine must make later addition of new themes declarative.

Legacy ids `botanical`, `editorial` and `midnight` remain accepted for stored data and links. They are upgraded to premium equivalents rather than breaking existing invitations.

## 7. Planner Card Studio redesign

Replace the current vertically stacked full-card list with a proper studio:

- compact responsive thumbnail gallery;
- theme/category labels;
- selected-state indicator;
- one interactive large preview, not twelve giant previews;
- mobile/desktop preview toggle;
- **Preview as guest** sample name control;
- replay opening animation;
- reduced-motion preview switch;
- save card design;
- invitation message and RSVP deadline controls retained;
- guest invitation rows and secure share/rotate controls retained;
- clear differentiation between personal digital cards and bulk physical cards.

Planner preview must use sample presentation data only. A real sent link continues to resolve the actual named guest.

## 8. Guest experience integration

The selected theme is rendered at the start of the scoped wedding guest experience after personal invitation access has been established.

PR #194's smart invitation handoff is the delivery/security layer. The visual system must:

- accept the selected card id from the smart invitation state;
- never re-expose the RSVP credential after exchange;
- render the real guest name from the scoped guest session;
- continue into the existing RSVP session;
- keep normal browser fallback functional;
- keep the physical `/i/{code}` path independent.

A later native Android Install Referrer phase may improve deferred-install recovery from isolated WhatsApp/Facebook browsers; this visual project must not weaken security by placing RSVP tokens into Play Store referrers.

## 9. Themed wedding details and RSVP

After the reveal, the invitation transitions into a lightweight theme shell around enabled wedding content. The first release must at least theme:

- RSVP entry/action;
- date and venue summary;
- navigation/continue controls;
- confirmation state.

Existing full wedding sections remain data-driven. The visual shell must not duplicate business logic from RSVP, contributions, venue or other modules.

## 10. Performance and data budget

Core targets under representative mobile conditions:

- no core autoplay video;
- initial invitation scene target: **≤ 500 KB transferred** excluding already-cached framework resources;
- complete core reveal target: **≤ 1 MB transferred** where practical;
- decorative images use AVIF/WebP where supported;
- SVG/CSS used for simple line art, glow and particles;
- inside/deferred decorative resources lazy-load after the open action or during idle time;
- avoid loading assets for unselected themes;
- animations prefer `transform` and `opacity` to avoid layout thrash;
- no persistent high-frequency particle loop;
- page remains usable if optional decorative assets fail.

These are product budgets, not permission to degrade clarity. If Card 1 photographic/artwork assets cannot meet the budget without visible damage, document the measured exception and optimize it separately.

## 11. Accessibility

Release requirements:

- opening action is a real button and keyboard accessible;
- semantic invitation text exists independently of decorative artwork;
- meaningful guest/couple/date/venue information remains readable without animation;
- `prefers-reduced-motion: reduce` bypasses 3D/particle sequences and reveals the open state with a short/no transition;
- focus is preserved logically after opening;
- colour contrast is checked for actionable controls;
- decorative elements are hidden from assistive technology;
- no audio autoplay;
- any future optional sound requires explicit user action and an obvious mute control.

## 12. Analytics without credential leakage

Where current analytics infrastructure permits, capture anonymous/first-party invitation funnel events such as:

- invitation experience rendered;
- open/reveal started;
- reveal completed;
- continue to details;
- RSVP started/completed.

Never include RSVP tokens, raw personal invitation URLs, guest email/phone or physical access credentials in analytics event labels/URLs.

## 13. Implementation phases

### Phase A — stabilize delivery foundation

- qualify PR #194 through full CI/Chromium release gate;
- merge only after green;
- verify production smart invitation routing before new visual release is merged.

### Phase B — engine and compatibility foundation

- introduce theme registry and motion/atmosphere types;
- preserve legacy card ids and link compatibility;
- normalize invitation data;
- add registry/config unit tests.

### Phase C — Card 1 reference experience

- implement reusable invitation stage;
- implement tri-fold motion and gold reveal;
- implement Ivory Floral Gold panels with semantic dynamic text;
- implement responsive desktop/mobile scale behavior;
- implement reduced-motion path;
- connect real guest personalisation and secure RSVP continuation.

### Phase D — Planner Studio

- replace stacked cards with compact premium gallery;
- add one interactive preview area;
- add device and reduced-motion preview controls;
- retain save/message/deadline and guest sharing functions;
- ensure saved theme immediately drives generated links/QRs.

### Phase E — premium collection

- implement all initial registry themes using reusable layout/motion primitives;
- ensure each has a distinct premium visual identity without loading unselected assets;
- migrate legacy Botanical/Editorial/Midnight renderings to upgraded variants.

### Phase F — themed downstream experience

- apply selected theme tokens to invitation-to-details transition and RSVP action/confirmation;
- verify no wedding business logic is forked into theme code.

### Phase G — qualification

- unit tests for registry, aliases, data binding and wording;
- component/browser tests for closed/open states;
- Playwright Chromium tests at mobile and desktop viewports;
- reduced-motion test;
- keyboard opening test;
- personalised guest-name test;
- no `Together with their families` regression;
- no generic `Your invited guest` on real guest invitation;
- smart personal invitation → reveal → RSVP route test;
- physical `/i/{code}` regression test;
- check no horizontal overflow at representative mobile widths;
- inspect network/resource behaviour so unselected theme assets are not loaded;
- normal repository CI/build/browser gate.

### Phase H — release

- open PR with implementation and measured acceptance evidence;
- resolve review comments and CI failures;
- merge only the exact qualified head;
- verify Vercel production deployment;
- run live production smoke test for Planner Card Studio and a safe invitation path;
- verify Charity & Kudzie Card 1 wording/date/venue on production without exposing a private guest token in reporting.

## 14. Acceptance criteria

The work is complete only when all of the following are true:

1. Card Studio no longer presents three giant generic static cards.
2. Planner can select from the premium registry and save the selection.
3. Card 1 Ivory Floral Gold opens as an interactive tri-fold experience.
4. Opening has a restrained gold/light reveal and realistic panel perspective/shadows.
5. Desktop card remains deliberately sized and centred; mobile has no horizontal page overflow.
6. Real personal invitations show the actual scoped guest identity.
7. Correct Card 1 wording uses **OUR FAMILIES** and **OUR MARRIAGE**.
8. No missing wedding fact is fabricated.
9. Reduced-motion users receive an immediate accessible open invitation.
10. Core experience uses no heavy autoplay video.
11. RSVP and continue controls remain secure and functional.
12. Personal RSVP tokens are not exposed after credential exchange.
13. Bulk physical-card access remains a separate identity model.
14. Legacy card ids and existing saved weddings do not break.
15. Playwright mobile/desktop qualification and repository release gates pass on the exact merged head.
16. Production deployment is verified after merge.

## 15. Change discipline

This document is authoritative for the workstream. Implementation should remain additive and compatibility-preserving where possible. Any material deviation — especially security model, data budget, personal-vs-physical access boundary or Card 1 wording — must be reflected here before release.
