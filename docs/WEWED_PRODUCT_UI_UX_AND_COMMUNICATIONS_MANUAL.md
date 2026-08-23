# Wewed Product UI/UX & Communications Design Manual

**Status:** STAMPED — AUTHORITATIVE PRODUCT DESIGN MANUAL  
**Stamp:** `WW-PRODUCT-UI-2026-08-23-01`  
**Baseline:** `10748f265594ae0358c0de37dde6369f66514f1c` (`main`, after PR #182)  
**Implementation branch:** `feat/mobile-ux-brand-manual-20260823`  
**Date:** 2026-08-23

This document is the authoritative design, implementation and regression reference for Wewed authenticated-product UI, mobile navigation, communications surfaces and branded outbound email presentation.

It consolidates and supersedes overlapping UI rules in:

- `docs/ADAPTIVE_WORKSPACE_NAVIGATION_SETTINGS_PLAN.md`
- `docs/COMMUNICATIONS_UI_REDESIGN_PLAN.md`

Those documents remain valuable historical records and implementation context. Where their UI guidance conflicts with this manual, this manual wins. Data, security, permission and workflow invariants in older plans remain in force unless explicitly changed elsewhere.

If code conflicts with this manual, either bring the code into conformance or amend this manual first. Do not silently reinterpret the product rules after implementation.

---

## 1. Product objective

Wewed must feel premium, calm and capable without making ordinary users confront the full system at once.

The product direction is:

> **Compact premium utility UI: Wewed character and palette, familiar interaction conventions, progressive disclosure, mobile-first density, and professional communications presentation.**

The goal is not to remove capability. The goal is to stop capability from competing for permanent screen space.

---

## 2. Problems this manual resolves

Live UAT has proven the communications stack functionally, but exposed a broader presentation problem:

- the floating Back / Forward / notification / account pill can cover important content;
- authenticated pages can expose too many persistent controls at once;
- glassmorphism and nested rounded cards consume too much mobile viewport height;
- long bar-style buttons make dense operational pages unnecessarily tall;
- settings, account switching, notifications and workspace navigation appear in multiple competing homes;
- communication settings read like infrastructure/debug screens rather than polished user settings;
- email verification functioned, but the email presentation was too plain for a customer-facing brand;
- mobile users need to see more meaningful information before scrolling.

This is a product-shell and design-system issue, not a single-page communications issue.

---

## 3. Non-negotiable design principles

1. **Progressive disclosure, not feature removal.** Low-frequency actions move into menus, drawers or contextual actions instead of remaining permanently visible.
2. **One capability, one primary home.** Do not duplicate full controls because separate feature streams created them.
3. **Mobile is a primary surface.** Never treat phone layouts as desktop compressed into a narrow column.
4. **Familiar conventions beat explanatory chrome.** Use standard symbols and locations where users already understand them.
5. **Operational state stays visible.** Verification, unread counts, payment state, due state, selected counts and warnings must not be hidden simply to make a page look clean.
6. **Glassmorphism is an accent, not the page skeleton.** Use it sparingly for highlight surfaces; operational screens prefer flat, restrained surfaces and borders.
7. **Compact does not mean cramped.** Minimum touch targets, readable type and clear hierarchy remain mandatory.
8. **Server authority remains authoritative.** Navigation/menu state never becomes permission evidence.
9. **No persistent floating-surface sprawl.** New features must integrate into the established shell rather than adding another fixed pill.
10. **Communications must look like Wewed.** Inbox, notification and outbound email presentation use one coherent palette, hierarchy and voice.

---

## 4. Wewed visual language

### 4.1 Palette

Use the existing product tokens consistently:

- **Ivory** — primary light background and breathing space.
- **Espresso** — primary dark surface/text anchor.
- **Champagne** — secondary surface / soft highlight.
- **Gold** — primary accent, active state, verified state and premium emphasis.
- **Clay / warning tones** — destructive or attention states only.

Avoid adding unrelated accent colours for routine feature differentiation. Channel identity comes primarily from iconography and labels, not a rainbow UI.

### 4.2 Typography

- Serif is for brand/editorial hierarchy: page titles, selected hero headings, ceremonial/public content.
- Sans-serif is for operational UI: lists, settings, forms, message bodies, metadata and buttons.
- Mobile operational titles should usually remain compact; do not spend half a viewport on typography.

### 4.3 Surface treatment

Operational UI should prefer:

- flat white/ivory/espresso surfaces;
- restrained 1 px borders;
- small-to-medium radius;
- minimal shadows;
- consistent padding;
- grouped rows rather than nested cards.

Reserve large rounded glass panels for intentional moments, not every section.

### 4.4 Density

Default authenticated-product density is **compact comfortable**:

- 44 px minimum phone touch target where practical;
- 8–12 px internal gaps for compact rows;
- 12–16 px card/section padding on phone;
- 16–24 px on larger screens only where the content benefits;
- avoid full-width CTA bars when an icon button, compact action or inline link is sufficient.

---

## 5. Global authenticated navigation contract

### 5.1 Mobile

The phone shell must use one compact top navigation model:

- top-left: **hamburger/menu** on root/list surfaces;
- top-left: **Back** on hierarchical detail surfaces;
- top-right: one contextual action when genuinely useful;
- account, notifications, settings, switch account and sign out live inside the menu/account area;
- Forward history is not a persistent bottom control. If retained, it is a compact top/history action and must never cover content;
- no permanent bottom floating Back/Forward/Bell/Account pill.

### 5.2 Desktop/tablet

Desktop may expose more controls, but the same hierarchy applies:

- one adaptive navigation drawer/rail;
- low-frequency account/settings controls in that shell;
- contextual actions near the content they affect;
- no duplicated global floating toolbar.

### 5.3 Standard icon semantics

Use conventional icon-only controls where the meaning is well established, with accessible labels/tooltips:

- hamburger/menu = navigation;
- arrow-left = back;
- gear = settings;
- bell = notifications;
- house/logo = home/workspace anchor;
- user/avatar = account;
- magnifier = search;
- plus/pencil = create/compose.

Do not write long labels next to familiar icons in persistent chrome unless ambiguity exists.

---

## 6. Menu / drawer contents

The authenticated drawer is the durable home for global and account navigation.

Recommended order:

1. Workspace/home
2. Brief / Today where role-appropriate
3. Messages
4. Notifications
5. Calendar
6. AI / Notebook / Business where role-appropriate
7. Project/wedding section
8. Settings
9. Account identity
10. Switch account
11. Sign out

The drawer may scroll. It is preferable for a user to scroll inside a menu occasionally than for every page to permanently sacrifice viewport space.

---

## 7. Compact operational page pattern

Authenticated settings and management pages should follow this order:

1. compact page header;
2. optional one-line helper copy;
3. status/error banner only when needed;
4. primary operational rows;
5. advanced/additional configuration under disclosure.

Avoid:

- introductory card + instruction card + section card + nested endpoint card for one setting;
- repeating the same explanation in multiple places;
- oversized full-width buttons for routine toggles;
- showing internal transport/debug language to ordinary users.

---

## 8. Communication delivery settings contract

Each external channel is a compact settings row, not a large independent panel.

### 8.1 Row anatomy

Each row contains:

- channel icon;
- channel name;
- primary destination or device count;
- one concise status label/chip;
- enable/disable control aligned to the right;
- one optional secondary action such as `Verify`, `Manage`, `Retry` or `Disable`.

Examples:

- **Email** — `user@example.com` — `Verified` — toggle on
- **WhatsApp** — `+81…` — `Verified` — toggle on
- **SMS** — `No verified number` — `Unavailable` — toggle disabled
- **Push** — `2 active devices` — `Ready` — toggle on — `Manage`

### 8.2 User-facing copy

Prefer user outcomes over infrastructure terminology.

Use:

- `Verified`
- `Ready`
- `Needs verification`
- `Unavailable`
- `2 active devices`

Avoid routine display of:

- `transportConfigured`
- endpoint/database implementation language;
- provider implementation details unless troubleshooting.

### 8.3 Advanced endpoint management

Adding or changing WhatsApp/SMS endpoints is secondary configuration. Keep it behind a compact `Add or change phone` disclosure/section so verified users are not forced to scroll past a large form every visit.

### 8.4 Email verification

The page must clearly distinguish Wewed Messages from the external mailbox, but this explanation should be concise and contextual.

Verified state should collapse to a simple row. Pending state may show a one-line instruction and compact `Send verification` action.

### 8.5 Push

Push is device-backed. Never ask users for a manual push endpoint URL. Show active-device count and route management to the device settings surface.

---

## 9. Wewed Messages / inbox contract

The existing Gmail-like inbox hierarchy and WhatsApp-like thread behaviour remain the interaction authority.

### 9.1 Inbox list

Conversation rows should show:

- avatar/initial or optional media thumbnail;
- title/contact name;
- one-line preview;
- compact time;
- unread indicator/badge;
- optional contextual type marker only where useful.

Unread hierarchy should come from weight, contrast and badge, not large decorative cards.

### 9.2 Mobile

- Inbox is the default surface.
- Opening a conversation replaces the inbox.
- Thread has a compact back-to-inbox control.
- Composer owns the bottom of the thread; global navigation must not float over it.

### 9.3 Media

Where attachments/media exist:

- thumbnails should be compact and aspect-ratio constrained;
- media must not force every message row into a large card;
- image/video/file presentation must retain existing Vault/security access rules;
- no remote media should silently weaken privacy or access control.

---

## 10. Notifications / attention surfaces

Notifications should behave like a compact activity inbox.

List rows should prioritize:

- type/category;
- title;
- one-line explanation;
- timestamp;
- unread/action-required state;
- one primary open action.

Detail pages may be richer, but persistent global navigation must not cover the task content or primary CTA.

Do not use a giant card solely because an item is important. Importance is expressed through hierarchy, state and clear action.

---

## 11. Branded outbound email manual

Email is a customer-facing Wewed product surface, not raw system output.

### 11.1 Goals

Every transactional email should:

- be recognizably Wewed before the user reads the body;
- render reliably in Gmail/mobile and common clients;
- use concise language;
- have one obvious primary CTA;
- preserve canonical `https://wewed.pro` links;
- support optional media without making the message fragile;
- include an appropriate support/reply path.

### 11.2 Email-safe visual system

Do not reproduce web glassmorphism in email.

Use email-safe HTML:

- table-based layout;
- 100% outer wrapper;
- inner content width up to about 600 px;
- ivory page background;
- white/espresso content surfaces;
- gold accent line/button;
- web-safe typography fallbacks;
- inline CSS;
- meaningful alt text;
- resilient plain-text equivalent.

### 11.3 Standard anatomy

1. Wewed wordmark/header
2. small context eyebrow (optional)
3. concise headline
4. short body copy
5. primary CTA button
6. optional media/content block
7. expiry/security/help note where needed
8. support/reply footer
9. `wewed.pro` brand footer

### 11.4 Verification email

Verification email should include:

- `Wewed` header;
- `Verify your Wewed email` headline;
- destination/account context;
- clear gold CTA: `Verify account email`;
- 30-minute expiry note;
- explicit `wewed.pro` canonical-link expectation;
- short note that the email is for external delivery verification, not a Wewed Messages conversation.

### 11.5 Media

Media is optional and purposeful:

- use a hosted hero/thumbnail only when it adds context;
- never make a critical action depend on loading an image;
- verification/security emails generally need no decorative hero image;
- event/update/invitation emails may use one controlled media block.

---

## 12. Accessibility requirements

- Icon-only controls require accessible names.
- Drawer opens/closes with keyboard and returns focus appropriately.
- Hidden navigation is not focusable.
- Current navigation state is semantic (`aria-current` where applicable).
- Form controls retain visible focus states.
- Colour alone never communicates verified/error/unread state.
- Text contrast remains readable in light/dark surfaces.
- No horizontal document overflow at supported phone widths.
- Primary content remains unobscured by fixed UI.

---

## 13. Responsive acceptance contract

Verify at minimum:

- 320 px
- 375 px
- 390 px
- 768 px
- 1024 px
- 1280 px
- 1440 px

At phone widths:

- no persistent bottom global floating toolbar;
- no navigation control covers composer, CTA or form controls;
- compact channel settings show meaningful information without excessive scrolling;
- menus/drawers respect safe areas;
- inbox and thread do not stack vertically;
- buttons do not become long bars unless they are genuinely the primary CTA.

---

## 14. Implementation scope for stamp `WW-PRODUCT-UI-2026-08-23-01`

This release will implement the manual in one coordinated pass across these high-impact surfaces:

1. shared authenticated workspace quick navigation;
2. adaptive menu/account/settings placement;
3. message delivery channel settings density;
4. notification/message chrome collision prevention;
5. branded email verification template foundation;
6. regression/source contracts protecting the new shell and email rules.

This release is allowed to change presentation and client navigation structure. It must not change communications data semantics, permissions, channel prerequisites, message visibility, delivery routing or Vault authority.

---

## 15. Regression and release requirements

Before merge:

1. source/design contract passes;
2. TypeScript/build passes;
3. Communications CI passes;
4. Adaptive Workspace Navigation tests pass;
5. Notifications tests pass;
6. full repository browser release gate passes;
7. mobile browser checks confirm no persistent toolbar collision;
8. exact-head Vercel preview is READY;
9. transactional email source contract proves canonical `wewed.pro` CTA and branded wrapper;
10. merge only the exact qualified head;
11. verify the exact production deployment and smoke-test `wewed.pro`.

---

## 16. Completion criteria

A non-technical user should be able to:

1. see substantially more useful content in a phone viewport;
2. navigate Wewed from one clear menu rather than multiple floating surfaces;
3. understand Back, Settings, Notifications and Account without explanatory labels in persistent chrome;
4. reach Switch account / Sign out from the menu without those actions occupying page space;
5. scan Email, WhatsApp, SMS and Push status quickly;
6. identify which channels are ready, verified or unavailable without reading technical copy;
7. manage Push devices without a fabricated endpoint field;
8. read and compose messages without global UI covering the thread;
9. receive a professional Wewed-branded verification email with a canonical `wewed.pro` CTA;
10. complete existing workflows with no data, authorization or delivery regression.

---

## 17. Agent continuation rule

If implementation is interrupted, the next agent must:

1. read stamp `WW-PRODUCT-UI-2026-08-23-01` first;
2. inspect the current branch/PR head;
3. compare code against this manual rather than restarting design discovery;
4. continue from the closest incomplete implementation or qualification item;
5. do not reintroduce persistent floating navigation surfaces;
6. do not weaken communications activation, privacy, permissions or canonical-domain rules to simplify UI;
7. do not merge until the exact-head release matrix and READY preview are proven.
