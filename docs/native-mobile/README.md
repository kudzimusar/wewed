## Current real-wedding Shadow execution directive

**CHARITY_KUDZIE_REAL_WEDDING_SHADOW_DISCOVERY_AND_SNAPSHOT_DIRECTIVE_2026-09-18.md**

This is the next execution authority after the synthetic Shadow qualification. It requires strict read-only discovery of the actual Charity & Kudzie / Eleven Eleven Testing wedding graph, a private production-derived snapshot outside Git, a sanitized Git-safe derivative, a separate Shadow database/backend, and Planner-first native rewiring. It explicitly forbids further invented reference values once production-derived data is available.

# Wewed Native Mobile Documentation Index

This directory is the durable operating manual for the Wewed dual-native mobile program.

Agents must not rely on chat history alone. Before changing native code, align the repository and read the governing documents listed below.

## Current governing execution authority

### 1. Native architecture and permanent release rules

MASTER_MOBILE_SPRINT_PLAN.md

Governs:

- true native SwiftUI + Jetpack Compose;
- strict isolation from the active Wewed web workspace;
- dual-platform parity;
- Wedding Pass / Wedding Day architecture;
- testing and release gates;
- production integration authorization.

### 1a. Binding rule — the Guest invitation

NATIVE_GUEST_INVITATION_ENTRY_CONTRACT.md

Read before touching anything a Guest sees on entry.

An invited Guest enters through **the actual configured digital invitation design selected for that
wedding** — `wedding.invitationCardStyle`, rendered exactly. Native must never invent or substitute
a simplified ceremonial card, summary card or generic ivory card, and resemblance is not
reproduction: `ivory background + gold border + floral ornament` is a FAIL.

The document carries the style registry, the artwork provenance (six files pinned by SHA-256), the
geometry and door keyframes both platforms assert, and the rule that presentation state is
orthogonal to RSVP state.

### 1b. Binding rule — the invitation protocol

NATIVE_INVITATION_PROTOCOL.md

Read before touching anything that handles an invitation link, a handoff, a guest session or an
RSVP write.

A private invitation is a security protocol, not a URL convention. Native speaks the one already
running in production — the same handoff shape, the same endpoints, the same refusals — or it
refuses. It never invents a second one, never persists the raw RSVP credential, and never replaces
an active guest before the server has validated the new one.

The shapes and endpoints are generated from `origin/main` into
`mobile/contracts/invitation-protocol.json` and asserted on both platforms.

### 1d. Binding rule — the invitation-bound Guest Profile

INVITATION_BOUND_GUEST_PROFILE.md

A private invitation is both a wedding invitation and the onboarding credential for a Guest
Profile. A verified Guest never sees email, password or role selection. The Guest session restores
their wedding on ordinary relaunch; RSVP decides what is inside, not whether they may enter.

### 1c. Open backend blocker — the Guest Pass

GUEST_PASS_BACKEND_CONTRACT_PROPOSAL.md

No production authority issues a guest admission credential. Native already *verifies* the `WW2.`
format and refuses to render anything else; nothing on `origin/main` issues one. The invitation's
Guest Pass CTA is therefore deliberately absent on the live path, and the live UAT's Guest Pass lane
cannot pass until the endpoint in that document exists.

### 2. Current sprint authority — Shadow Real-Wedding Parity

WEWED_NATIVE_SHADOW_INTEGRATION_REAL_WEDDING_PARITY_PLAN_2026-09-18.md

Plan ID: WW-NATIVE-SHADOW-REAL-WEDDING-PARITY-2026-09-18-01

Reference scenario:

- Charity & Kudzie wedding;
- Eleven Eleven Testing planner context.

Governs the transition from the fixture-only native shell to a realistic shadow-backed Wewed application using one current wedding as the behavioral/data-shape reference.

Production remains read-only during this phase. Shadow data never syncs back to production.

### Current implementation checkpoint

**SHADOW_SETUP_IMPLEMENTATION_STATUS_2026-09-18.md**

Use this after reading the authoritative Shadow Real-Wedding plan. It records the executable setup already implemented on:

`native-mobile/shadow-setup-implementation-20260918`

and defines the non-simulator local qualification gate that must pass before simulator/Maestro intervention.

## Product authority and information architecture

- **WEWED_NATIVE_INFORMATION_ARCHITECTURE_V2.md — current authoritative role taxonomy, 4–5 destination bottom navigation contract, workspace depth, cross-role utilities, entity ownership, context and data-pipeline rules.**
- **WEWED_NATIVE_IA_V2_IMPLEMENTATION_PLAYBOOK.md — mandatory step-by-step build and qualification sequence for implementing IA V2 without rewriting the existing native product.**
- NATIVE_PRODUCT_AUTHORITY_LEDGER.md — capability lifecycle status by platform.
- NATIVE_ROLE_CAPABILITY_MATRIX.md — historical/current capability-boundary reference; IA V2 is authoritative for current navigation topology.
- NATIVE_INFORMATION_ARCHITECTURE.md — V1 role-shell/navigation reference retained for history; superseded by IA V2 for current navigation design.
- NATIVE_SHELL_IMPLEMENTATION_PLAN.md — fixture-backed shell implementation history and shell gates.
- MOBILE_FEATURE_PARITY_MATRIX.md — historical/earlier parity matrix; do not use broad legacy PASS claims as proof of whole-product production parity.

## Integration and security

- NATIVE_CONTRACT_GAP_REGISTER.md — incomplete mobile contracts and security corrections.
- PROPOSED_BACKEND_INTEGRATION_SPEC.md — historical proposal; any HMAC-based Wedding Pass verification language is stale and must not override WW2 ECDSA.
- WEDDING_DAY_INTEGRATION_IMPACT_REGISTER.md — Wedding Day integration dependencies and boundaries.

## Required reading order for a new agent

1. README.md
2. WEWED_NATIVE_SHADOW_INTEGRATION_REAL_WEDDING_PARITY_PLAN_2026-09-18.md
3. MASTER_MOBILE_SPRINT_PLAN.md
4. **WEWED_NATIVE_INFORMATION_ARCHITECTURE_V2.md**
5. **WEWED_NATIVE_IA_V2_IMPLEMENTATION_PLAYBOOK.md**
6. NATIVE_PRODUCT_AUTHORITY_LEDGER.md
7. NATIVE_ROLE_CAPABILITY_MATRIX.md
8. NATIVE_INFORMATION_ARCHITECTURE.md (historical V1 reference only)
9. NATIVE_CONTRACT_GAP_REGISTER.md
10. WEDDING_DAY_INTEGRATION_IMPACT_REGISTER.md
11. relevant implementation/test files for the current phase

## Mandatory repository Gate 0

Before reviewing code, making changes, or accepting a PASS result:

    git fetch origin --prune
    git branch --show-current
    git rev-parse HEAD
    git rev-parse <remote tracking branch>
    git rev-list --left-right --count HEAD...<remote tracking branch>
    git status --short

Any unexpected divergence or dirty state must be reconciled before continuing.

## Current product principle

Wewed Native is not a Wedding Pass app with planning features attached.

It is the native expression of the whole Wewed wedding operating platform.

Wedding Day and Wedding Pass remain first-class capabilities, but they are the culmination of the same wedding graph that begins with planning, guests, vendors, budget, contributions, seating, timeline and invitations.

## Canonical guest journey

    Wewed splash
      ↓
    Ivory Floral Gold invitation
      ↓
    RSVP
      ↓
    confirmed attending state
      ↓
    Wewed Wedding Pass
      ↓
    interactive wedding experience
      ↓
    Wedding Day gate scan
      ↓
    attendance / household capacity
      ↓
    seating / next event
      ↓
    Live experience

For a guest who has not completed RSVP, the customized invitation should precede the general wedding Home experience.

## Production safety rule

During the Shadow Real-Wedding phase:

- production is a read-only source;
- no native client writes directly to production;
- no native client connects directly to the production database;
- real private data is not committed to Git;
- side effects are disabled in Shadow;
- Shadow never syncs writes back to production.

If an agent cannot prove these conditions, it must stop.
