# WEWED IMPLEMENTATION GOVERNANCE

**Status:** AUTHORITATIVE — applies to all future Wewed implementation work  
**Governing plan:** `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`  
**Master plan:** `docs/WEWED_NATIVE_PWA_PRODUCTION_CONVERGENCE_MASTER_PLAN.md`

This document is the durable execution rulebook for Wewed. It governs how future agents, reviewers, and handoffs must implement the master plan. It does not replace the master plan; it controls how the plan is executed.

## 1. Read-before-work rule

Before making any product, backend, native, database, deployment, or release change, the implementer must read:

1. this governance file;
2. the locked master plan;
3. the current phase section;
4. the latest accepted decision/status record for that phase.

A task that conflicts with the locked plan must stop for an explicit plan amendment. Do not silently choose a different architecture.

## 2. Phase discipline

Every implementation belongs to exactly one master-plan phase.

The implementer must state:
- Plan ID;
- phase number and name;
- branch and starting SHA;
- plan sections being followed;
- exit gate.

Do not start the next phase inside the current task unless the plan explicitly says so.

## 3. Agent self-report never closes a phase

Implementation completion is provisional until independent review.

Required sequence:

```text
agent implements
→ pushes branch
→ independent reviewer inspects actual remote code
→ reviewer patches every ordinary gap found
→ reviewer verifies the patched result
→ reviewer accepts or rejects the phase
→ only then is the next agent task issued
```

Test summaries, screenshots, or prose reports are evidence, not acceptance by themselves.

## 4. Reviewer-closure rule

The independent reviewer is not only a moderator.

If review finds an ordinary repository-level defect, the reviewer must fix it directly before issuing the next task.

Examples the reviewer closes directly:
- incorrect logic;
- missing fail-closed checks;
- incomplete tests;
- stale or contradictory documentation;
- wrong mappings;
- unsafe defaults;
- branch-local integration gaps;
- missing plan/status records.

The reviewer must not bounce such defects back to the implementation agent merely to preserve role separation.

A defect may be returned instead of patched only when it genuinely requires one of:
- production credentials or access unavailable to the reviewer;
- destructive or irreversible production action requiring explicit approval;
- local-only signed-device / signing-key / distribution tooling unavailable to the reviewer;
- a product or architecture decision that requires the owner's choice;
- another external dependency the reviewer cannot safely perform.

When one of those exceptions applies, state the exact blocker and stop that affected boundary.

## 5. No next task from an unclean branch

The next phase/task may be issued only after:
- independent code inspection;
- reviewer-owned closure of discovered ordinary defects;
- re-inspection of the final pushed code;
- current phase marked accepted in the master-plan record.

If reviewer patches change a shared contract or fixture, all affected copies/clients/docs must be kept synchronized before acceptance.

## 6. No silent production action

Without explicit approval, do not:
- merge to `main`;
- deploy production;
- apply production migrations;
- mutate production data;
- set or rotate production secrets;
- configure production signing keys;
- publish Play/TestFlight/App Store releases;
- alter controlled live-UAT records.

Read-only inspection, isolated test databases, review-only migrations, fixtures, tests, documentation, and branch-local patches are allowed when the plan permits them.

## 7. Source-of-truth hierarchy

When evidence conflicts, use the master-plan authority order:

1. database integrity and persisted relationships;
2. shared server/domain authorization;
3. explicitly approved newer security/product contracts;
4. PWA/native API contracts;
5. PWA/native presentation;
6. Shadow/fixtures/development personas.

Never treat test accounts, Shadow data, or one wedding as architecture.

## 8. Regression rule

A phase fails if it regresses either side of Wewed:
- mature PWA/server business behavior; or
- newer native/security contracts such as Guest Session v2, invitation sequencing, Guest isolation, context isolation, or WW2.

The goal is one coherent Wewed platform, not a PWA system plus a separate native system.

## 9. Required handoff report

Every implementation handoff must include:

```text
MASTER PLAN
Plan ID:
Phase:
Plan sections followed:

START STATE
branch:
starting SHA:

IMPLEMENTED
files:
behavior:

TESTS
server/PWA:
Android:
iOS:
device/other:

REGRESSION
PWA changed:
native security invariants changed:
database schema changed:
production touched:

AUTHORITY
source of authority:
fail-closed proof:
hardcoded/fixture data introduced:

END STATE
ending SHA:
pushed:
merged:
deployed:

PHASE GATE
implementer says complete:
independent review complete:
reviewer patches applied:
accepted:
remaining blockers:
```

## 10. Future-agent inheritance

Any future agent taking over Wewed must treat this file and the locked master plan as binding repository instructions.

If conversation context is incomplete, the repository documents win over memory or assumptions.

No future handoff is considered complete unless it identifies the current accepted phase and the exact remote SHA from which work should continue.
