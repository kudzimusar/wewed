# Wewed Living Wedding Site — Story, Community & Commerce Plan

**Status:** STAMPED — AUTHORITATIVE FUTURE PRODUCT / DESIGN / COMMERCE PLAN — DEFERRED UNTIL CURRENT SHIPPING CLOSES  
**Stamp:** `WW-LIVING-WEDDING-SITE-2026-09-28-01`  
**Canonical date:** 2026-09-28  
**Baseline documented from:** `release/qro07-guest-pwa-play-ship-20260928` @ `6dc8b2afaf878e8805c2c850e20eb30a6be8419e`  
**Historical design anchors:** `cd5708a772`, `1cb0bba37d`, `1d013544b1`  
**Relationship to prior plans:** extends and supersedes conflicting parts of `docs/CANONICAL_WEDDING_SOCIAL_TEMPLATE_PLAN.md`; integrates with `docs/WEWED_VENDOR_BOOKING_COMMERCE_AI_REFERRAL_PLAN.md`.

---

## 1. Purpose

The Couple Site is not a conventional wedding microsite and must not be reduced to one.

Its intended product is:

> **A premium, editable, living wedding world where Story, Community and Commerce evolve together before, during and after the wedding.**

The Couple Site must:

1. tell the couple's story through premium visual design;
2. provide useful, trustworthy wedding information;
3. let invited guests participate socially;
4. preserve memories before, during and after the wedding;
5. connect guests and couples to relevant wedding services;
6. attribute genuine marketplace/referral value to Wewed;
7. remain editable and data-backed without exposing CMS mechanics to guests.

This plan is intentionally deferred until the current Guest/invitation/native shipping work is complete. It must **not block today's release**.

---

## 2. Product doctrine

The Living Wedding Site has three inseparable product layers.

### 2.1 Story

Why the guest arrives.

The site communicates:

- who the couple are;
- their relationship and story;
- the important people around them;
- the wedding location and meaning;
- the programme and guest information;
- the emotional tone of the celebration.

### 2.2 Community

Why the guest stays and returns.

The site becomes the private social context for the wedding through:

- guestbook / wedding wall;
- wedding-party and family profiles;
- guest photos and videos;
- approved memories, wishes and advice;
- announcements;
- comments/replies where appropriate;
- song requests and soundtrack;
- contributions;
- before/during/after wedding participation.

### 2.3 Commerce

How Wewed monetizes real needs created by the wedding without degrading trust.

The site may connect users to relevant:

- accommodation;
- transport;
- flights/travel where integrated;
- planners;
- venues;
- photographers/videographers;
- beauty providers;
- attire;
- local experiences;
- gifts/contributions;
- other verified wedding services.

Commercial placement must solve a plausible need associated with the active wedding.

The permanent rule is:

> **Relevance first, trust second, monetization third.**

No generic ad clutter.

---

## 3. Historical design preservation

The initial Wewed wedding site implementation remains an explicit visual/product reference.

### 3.1 Reference commits

- `cd5708a772` — initial rich wedding application baseline.
- `1cb0bba37d` — “make rich wedding experience canonical”.
- `1d013544b1` — “restore complete classic after-wedding experience”.

These are design/product references, not code to blindly restore.

### 3.2 Visual DNA to preserve

The original premium design used:

- full-screen couple photography;
- Ken Burns / parallax-style restrained motion;
- espresso photographic overlays;
- champagne / ivory / muted-gold palette;
- oversized editorial couple names;
- ornamental dividers and monograms;
- strong section-to-section rhythm;
- image-led storytelling;
- venue photography with rich captions and framing;
- floating visual accents / badges;
- animated reveals;
- premium masonry gallery and lightbox;
- strong Before / After lifecycle;
- a visually emotional close to the site.

The historic `ParallaxHero` and `HeroSection` are useful references for:
- full-screen imagery;
- motion depth;
- ornament;
- typography hierarchy;
- countdown treatment.

The historic `VenueSection` is a reference for:
- editorial venue storytelling;
- large photography;
- gold framing;
- overlaid locality/caption;
- rich feature cards;
- event-moment vignettes.

The historic `PhotoGallery` is a reference for:
- real masonry;
- filters;
- motion;
- captions;
- lightbox;
- video;
- curated status;
- “Share your photos” continuation.

### 3.3 Preservation rule

Future work must distinguish:

**visual/product concept**  
from  
**old hardcoded/demo data implementation**.

Removing fake data must never be interpreted as permission to flatten the visual experience.

---

## 4. What QRO07 correctly fixed

The QRO07 shipping line establishes valuable foundations and must not be rolled back.

Preserve:

- canonical Couple/Wedding identity;
- database-backed public projection;
- `WeddingSiteSection`;
- `WeddingSiteItem`;
- `WeddingAnnouncement`;
- real `ProgrammeItem`;
- real `MediaItem`;
- real contribution campaigns;
- draft/revision/publish workflow;
- owner/planner editing;
- section ordering;
- section visibility;
- removal of guest-visible fabricated programme/hotels/people/gallery/social proof;
- cross-client announcement convergence;
- real Guest invitation/session authority;
- Guest/RSVP/Pass hardening;
- current Play authority cleanup.

The target architecture is therefore:

> **Original premium experience + QRO07 canonical data authority.**

Not “old code versus new code”.

---

## 5. Public-content truth rule

Public guests must never see invented wedding facts.

Permanent rules:

- no fake people;
- no fake hotel recommendations;
- no fabricated programme;
- no sample FAQs presented as real;
- no repeated hero image presented as multiple wedding memories;
- no fake wall posts;
- no fake social counts;
- no fake products/prices;
- no starter content that could be mistaken for the couple's real information.

Owner/planner edit mode may show setup prompts and templates.

Guest mode follows:

> **real published content → render**  
> **not published → hide or show an honest restrained unavailable state**

This explicitly supersedes any older plan language that instructed Wewed to show fictitious starter content publicly to make an incomplete wedding look populated.

---

## 6. Design system: premium, editable, image-led

The site must not become a long sequence of generic CMS cards.

### 6.1 Visual rhythm

Target rhythm:

1. cinematic image;
2. concise emotional copy;
3. visual story/timeline;
4. large venue image;
5. factual guest information;
6. portraits / people;
7. social participation;
8. gallery/memories;
9. contextual commercial utility;
10. emotional closing image.

### 6.2 Images carry emotion; text explains

Prefer:

- photography;
- illustration;
- portraiture;
- editorial spacing;
- subtle motion;
- strong typographic hierarchy.

Avoid:

- dense text blocks;
- repeated generic cards;
- dashboard-like visual language on the guest site;
- large empty areas filled only to make a section look complete.

### 6.3 Design templates separate from data

A wedding design template defines:

- composition;
- image ratios;
- typography;
- motion;
- ornaments;
- framing;
- gallery behavior;
- social layouts;
- section transitions;
- lifecycle treatment.

Wedding data defines:

- names;
- date;
- venue;
- story;
- media;
- people;
- programme;
- travel;
- social contributions;
- commercial selections.

Therefore:

> **Empty data must not force an ugly design.**

A section with no data simply remains hidden from guests until published.

---

## 7. Living lifecycle

The Couple Site changes purpose with the wedding.

### 7.1 Before the wedding

Primary questions:

- Who are the couple?
- What is their story?
- Who are their people?
- Where is the wedding?
- What do I need to know?
- How do I RSVP?
- Where can I stay?
- How do I get there?
- What should I wear?
- Can I leave a message?
- Can I request a song?
- Are there gifts/contributions?
- What useful wedding services are relevant to me?

### 7.2 Wedding Day

Priority shifts toward:

- today's programme;
- venue/directions;
- Guest Pass;
- table/seating;
- party information;
- announcements;
- transport information;
- live photo upload;
- wedding wall/guestbook;
- useful on-the-day services.

### 7.3 After the wedding

The site becomes a durable memory/archive:

- official media;
- guest media;
- guestbook;
- approved memories;
- highlight video;
- songs played;
- thank-you message;
- post-wedding announcements;
- destination/travel follow-up where relevant;
- “our story continues” closing experience.

---

## 8. Proposed premium page composition

Sections remain configurable by couple/planner.

Default conceptual composition:

1. **Cinematic Hero**
2. **Announcements** when present
3. **Our Story**
4. **Meet Our People**
5. **Venue**
6. **The Day**
7. **RSVP / Guest-specific actions**
8. **Travel & Stay**
9. **Guest Guide**
10. **Gifts / Contributions**
11. **Our Village / Guestbook**
12. **Memories / Gallery**
13. **Songbook / Soundtrack** when published
14. **FAQ**
15. **Contextual Wewed Services** where relevant
16. **Share**
17. **Cinematic Closing Scene**
18. Footer

The closing scene should emotionally complete the story rather than end abruptly after FAQ/Share.

---

## 9. Story layer

### 9.1 Hero

Use the real couple's:

- names;
- monogram;
- date;
- venue;
- tagline;
- hero media.

Support:

- full-viewport image;
- restrained Ken Burns;
- optional parallax;
- reduced-motion mode;
- gold ornamentation;
- countdown.

### 9.2 Our Story

Support real structured milestones:

- title;
- date/era;
- short narrative;
- image/video;
- ordering.

Visual treatment should alternate imagery and concise copy rather than show a text-heavy list.

### 9.3 Venue

Venue experience should support:

- venue name;
- real image(s);
- description;
- locality;
- map/directions;
- accessibility/arrival information;
- real venue features;
- real ceremony/reception moments;
- optional partner/booking information.

Preserve the visual richness of the original venue treatment while using real data.

### 9.4 Wedding party / people

Support premium portrait profiles for:

- wedding party;
- family;
- other couple-approved people.

Public profiles may include:

- display name;
- role;
- relationship;
- biography;
- approved photo;
- favourite memory;
- favourite song;
- fun fact / social handle when permitted.

Private Guest/RSVP fields never become public automatically.

---

## 10. Community layer

### 10.1 One wedding social actor

Social participation must resolve server-side from the active wedding credential.

Actors may be:

- invited Guest;
- couple;
- authorised planner/member;
- optionally a registered Wewed profile linked to a Guest.

An invited Guest must not be forced to create another account simply to participate in the wedding they were invited to.

Never use RSVP tokens as public/social identifiers.

### 10.2 Guestbook / wedding wall

Use real persisted messages.

Requirements:

- invitation identity;
- moderation;
- replies where appropriate;
- honest timestamps;
- no fake activity;
- no credential exposure;
- disabled/hidden when the couple does not want it.

### 10.3 Our Village

Use real approved `GuestContribution` records.

Support:

- memory;
- blessing;
- advice;
- funny story;
- wish;
- favourite song;
- anonymous or public identity according to privacy;
- couple-only contributions never entering public projection.

### 10.4 Media / memories

Use real governed `MediaItem` records.

Flow:

Guest upload  
→ governance/moderation  
→ published Gallery/Memories  
→ optional comments/reactions  
→ long-term archive.

Do not manufacture gallery entries from Hero/Story images.

### 10.5 Memory capsule

The old timer-only implementation is not a product.

Future real capsule requires:

- actual video/audio capture;
- durable upload;
- wedding scoping;
- privacy;
- moderation;
- reveal date;
- governed playback;
- retention policy.

Until real, it stays out of guest UI.

---

## 11. Commerce layer: Wedding Commerce Graph

The wedding is a high-intent commercial context.

Conceptual graph:

```
Wedding
  ├── Couple
  ├── Planner
  ├── Guests
  ├── Venue
  ├── Vendors
  ├── Travel / accommodation
  ├── Transport
  ├── Gifts / contributions
  └── Future couples created from current guests
```

Wewed connects real demand to relevant providers.

### 11.1 Guest commerce needs

Guests may reasonably need:

- accommodation;
- airport transfer;
- venue transport;
- car hire;
- flights/travel;
- restaurants/experiences;
- beauty/hair;
- childcare where relevant;
- attire;
- gifts/contributions.

### 11.2 Couple/planner commerce needs

Couple/planner may need:

- venue;
- planner;
- photographer;
- videographer;
- florist;
- decor;
- catering;
- DJ/entertainment;
- transport;
- rentals;
- stationery;
- attire;
- beauty;
- cake;
- honeymoon/travel.

### 11.3 Future-couple conversion

A Guest may later become a Couple.

The site should eventually support a tasteful conversion:

> **Planning something special too?**

leading to Wewed planner/venue/vendor discovery.

This creates a network loop:

Guest  
→ experiences Wewed  
→ becomes future Couple  
→ creates another wedding  
→ creates another Guest network.

---

## 12. Commerce placement rules

Commercial content must feel like utility, not advertising.

### 12.1 Contextual examples

At Travel:

**Staying near the wedding?**  
Show couple/planner-approved or contextually relevant accommodation.

At Venue:

**Getting there**  
Show relevant transport/transfer options.

After Gifts:

**Planning your own celebration?**  
Offer a restrained Wewed discovery entry point.

### 12.2 Disclosure

Distinguish:

- **Recommended by the couple/planner**
- **Wewed partner**
- **Sponsored**

Never blur these categories.

### 12.3 Couple/planner control

The couple/planner should control:

- whether commerce appears;
- selected/recommended providers;
- preferred hotel blocks;
- transport providers;
- wedding rates/codes;
- hidden/disabled placements.

No arbitrary vendor should appear merely because they pay Wewed.

---

## 13. Monetization models

Supported commercial models may include:

- completed-booking commission;
- fixed referral bounty;
- qualified lead fee;
- Wewed transaction/booking fee;
- vendor subscription;
- carefully disclosed featured placement;
- revenue share.

Preferred model where technically possible:

> **Vendor earns → Wewed earns.**

Completed conversion is stronger than paying for meaningless clicks.

---

## 14. Referral attribution

Future commerce must be measurable.

At minimum attribute:

- source wedding;
- source section/placement;
- guest/session where lawful and appropriate;
- provider;
- offering;
- referral/click;
- booking;
- conversion;
- commission.

Conceptual records may require:

- `WeddingCommercePlacement`;
- `CommerceReferral`;
- `ReferralConversion`;
- linkage to existing Provider/Booking/ServiceEngagement domains.

Do not create a competing booking authority. Commercial conversion must converge into the canonical booking/service-engagement system defined by:

`docs/WEWED_VENDOR_BOOKING_COMMERCE_AI_REFERRAL_PLAN.md`.

---

## 15. Couple value-sharing concepts

A later commercial policy may return some referral value to the couple through:

- Wewed subscription credit;
- vendor credits;
- upgrade credits;
- honeymoon/contribution credit;
- other transparent incentives.

This is a future business-policy decision, not authorised implementation in this plan.

Any value-sharing model must be disclosed, auditable and compliant with applicable commercial rules.

---

## 16. Site editor

The couple/planner editor must eventually control both editorial and social/commerce presentation.

### Editorial controls

- copy;
- images;
- story milestones;
- people/profiles;
- venue;
- programme;
- travel;
- FAQ;
- gallery;
- announcements;
- section order/visibility.

### Social controls

- Guestbook enabled;
- Village enabled;
- Memories enabled;
- Guest posting allowed;
- comments allowed;
- uploads allowed;
- moderation queue;
- profile publication.

### Commerce controls

- commerce enabled;
- approved/recommended hotels;
- transport recommendations;
- selected provider offers;
- partner visibility;
- placement order;
- attribution visibility.

Guest view must never expose CMS mechanics.

---

## 17. Trust, privacy and safety

The Couple Site is an invitation/social context and must remain safer than a public social network.

Permanent requirements:

- wedding-scoped authorization;
- no credential storage in social records;
- no RSVP token exposure;
- no cross-wedding social access;
- guest posting only from valid invited identity;
- moderation;
- public/private/couple-only visibility;
- rate/abuse controls;
- safe media handling;
- commercial disclosure;
- privacy-preserving analytics.

The message safety patch on the QRO07 line is part of this doctrine:

- `c2462fefbbb9ce707ff1f94fc8f83961e0a38c19`
- `6dc8b2afaf878e8805c2c850e20eb30a6be8419e`

Future work must preserve the rule that RSVP credentials are never copied into social content.

---

## 18. Relationship to the current QRO07 site

The current QRO07 public site is an acceptable **Phase-1 launch renderer** if its current shipping/production gates pass.

It is not the final Couple Site product definition.

Do not delay current Guest/invitation release merely to implement this plan.

After current release:

1. preserve current canonical data/editor architecture;
2. restore visual richness from historic reference components;
3. restore real social capabilities;
4. add contextual commerce;
5. evolve lifecycle behavior.

---

## 19. Post-shipping implementation phases

### Phase LWS-01 — Design restoration

Goal: restore premium visual language without reintroducing fake data.

- richer Hero treatment;
- original venue composition;
- premium story treatment;
- richer gallery;
- cinematic closing section;
- section transitions;
- desktop/mobile/reduced-motion qualification.

### Phase LWS-02 — Social spine

- canonical Wedding Social Actor;
- Guestbook/wall;
- Our Village;
- invitation-Guest comments;
- real memories/media;
- moderation;
- social section controls.

### Phase LWS-03 — People and profiles

- rich wedding-party/family profiles;
- optional Guest linkage;
- self-edit under governed permissions;
- privacy/publication rules.

### Phase LWS-04 — Wedding lifecycle

- Before;
- Wedding Day;
- After;
- lifecycle-aware navigation/composition;
- after-wedding media/archive.

### Phase LWS-05 — Commerce placements

- hotels;
- transport;
- contextual vendor/service offers;
- couple/planner curation;
- clear disclosure.

### Phase LWS-06 — Referral attribution

- source wedding;
- source placement;
- provider/offering;
- booking/conversion;
- commission analytics.

### Phase LWS-07 — Network growth

- tasteful “plan your wedding” conversion;
- future-couple onboarding;
- attribution from prior wedding;
- vendor/provider network growth.

---

## 20. Acceptance principles for future implementation

A future Living Wedding Site release is not accepted unless:

### Design

- premium visual quality matches or exceeds the historic reference;
- real media is used;
- empty content never makes the site look broken;
- no generic dashboard/card wall replaces editorial storytelling.

### Data

- no guest-visible fabricated wedding facts;
- one canonical source per semantic datum;
- owner edits persist server-side;
- another device sees published changes.

### Social

- invited Guest can participate without unnecessary second account;
- wedding isolation is enforced;
- moderation/privacy works;
- no credential leakage.

### Commerce

- every placement is relevant to the wedding;
- couple/planner control is respected;
- sponsorship/recommendation status is clear;
- referral attribution is deterministic;
- booking converges into canonical Wewed commerce systems.

### Lifecycle

- before/during/after remain coherent versions of the same wedding world.

---

## 21. Current release freeze

This document does **not** authorize implementation before the current release closes.

Until today's shipping work is complete:

- do not expand QRO07 into the full Living Wedding Site;
- do not restore old deleted social UI wholesale;
- do not reintroduce sample/demo public content;
- do not add commerce placements;
- do not delay Guest/invitation release solely for this plan.

The current priority remains:

1. finish QRO07 production shipping gates;
2. deploy/qualify the current Guest invitation experience;
3. produce qualified Android/iOS release candidates;
4. close release blockers;
5. then begin LWS-01 from this plan.

---

## 22. Authority rule for future agents

Future work on the Couple Site must cite:

`WW-LIVING-WEDDING-SITE-2026-09-28-01`

If an implementation proposes to:

- flatten the rich visual design;
- delete a legitimate social capability;
- show fake/demo guest content;
- add irrelevant advertising;
- create a competing booking/referral authority;
- expose Guest credentials;
- or remove before/during/after lifecycle intent,

it must be treated as conflicting with this plan unless this document is explicitly amended.

The product intent is:

> **Wewed Living Wedding Site = Story + Community + Commerce, delivered through a premium editable wedding experience.**
