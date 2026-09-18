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

### 2. Current sprint authority — Shadow Real-Wedding Parity

NATIVE_SHADOW_REAL_WEDDING_PARITY_PLAN.md

Plan ID: WW-NATIVE-SHADOW-REAL-WEDDING-PARITY-2026-09-18-01

Reference scenario:

- Charity & Kudzie wedding;
- Eleven Eleven Testing planner context.

Governs the transition from the fixture-only native shell to a realistic shadow-backed Wewed application using one current wedding as the behavioral/data-shape reference.

Production remains read-only during this phase. Shadow data never syncs back to production.

## Product authority and information architecture

- NATIVE_PRODUCT_AUTHORITY_LEDGER.md — capability lifecycle status by platform.
- NATIVE_ROLE_CAPABILITY_MATRIX.md — Couple, Planner, Coordinator, Vendor, Usher, Guest and Admin capability boundaries.
- NATIVE_INFORMATION_ARCHITECTURE.md — role shells, navigation and deep-link topology.
- NATIVE_SHELL_IMPLEMENTATION_PLAN.md — fixture-backed shell implementation history and shell gates.
- MOBILE_FEATURE_PARITY_MATRIX.md — historical/earlier parity matrix; do not use broad legacy PASS claims as proof of whole-product production parity.

## Integration and security

- NATIVE_CONTRACT_GAP_REGISTER.md — incomplete mobile contracts and security corrections.
- PROPOSED_BACKEND_INTEGRATION_SPEC.md — historical proposal; any HMAC-based Wedding Pass verification language is stale and must not override WW2 ECDSA.
- WEDDING_DAY_INTEGRATION_IMPACT_REGISTER.md — Wedding Day integration dependencies and boundaries.

## Required reading order for a new agent

1. README.md
2. NATIVE_SHADOW_REAL_WEDDING_PARITY_PLAN.md
3. MASTER_MOBILE_SPRINT_PLAN.md
4. NATIVE_PRODUCT_AUTHORITY_LEDGER.md
5. NATIVE_ROLE_CAPABILITY_MATRIX.md
6. NATIVE_INFORMATION_ARCHITECTURE.md
7. NATIVE_CONTRACT_GAP_REGISTER.md
8. WEDDING_DAY_INTEGRATION_IMPACT_REGISTER.md
9. relevant implementation/test files for the current phase

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
