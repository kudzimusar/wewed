# Wewed Planner Regression Protocol

Parent epic: #22

## Governing principle

The original `src/components/wedding/wedding-planner.tsx` is the functional baseline. The recovery may improve its shell, authentication, wedding scoping, collaboration, data model, and workflows, but it may not silently remove, simplify, hide, or genericize an original planner capability.

A backend endpoint or unused component does not count as parity. The capability must be reachable from the active `/planner` application.

## Required checks for every recovery stage

### 1. Capture pre-change integrity

```bash
bun run planner:integrity --output .planner-integrity/before.json
bun run planner:integrity --wedding charity-kudzie --output .planner-integrity/charity-before.json
```

The first command protects every wedding and cross-wedding separation. The second gives the existing flagship client an independent comparison record.

Snapshots contain counts, totals, and hashes rather than raw guest or client content.

### 2. Identify the original capabilities affected

Update `src/lib/planner-parity-contract.ts` only when the original source supports the capability being added to the contract.

For each capability touched by the stage, compare:

- Reachable navigation
- Buttons and forms
- Fields and validation
- Create, update, and delete mutations
- Search and filters
- Summaries and reporting
- Worksheet actions
- Empty states
- Mobile behavior
- Zimbabwean terminology and category structure

### 3. Run the original baseline contract

```bash
bun test src/lib/planner-parity-contract.test.ts
```

The test must prove:

- Every contract capability is present in the original baseline.
- The active planner has no gaps except those explicitly listed in `KNOWN_ACTIVE_PARITY_GAPS`.
- A recovery PR reduces or preserves the gap list.
- A new gap is treated as a regression.
- The independent `/planner` shell and no-seed behavior remain intact.

Adding an item to `KNOWN_ACTIVE_PARITY_GAPS` requires explicit regression review and should normally block the merge.

### 4. Run data-integrity unit tests

```bash
bun test src/lib/planner-integrity.test.ts
```

These tests protect deterministic comparison, financial totals, guest/RSVP counts, seating capacity, wedding isolation, and non-mutating snapshot behavior.

### 5. Capture and compare post-change integrity

```bash
bun run planner:integrity \
  --compare .planner-integrity/before.json \
  --output .planner-integrity/after.json

bun run planner:integrity \
  --wedding charity-kudzie \
  --compare .planner-integrity/charity-before.json \
  --output .planner-integrity/charity-after.json
```

The comparison exits non-zero when protected values change.

When a stage intentionally changes test data, attach a reviewed difference file to the PR. No unexplained difference may be merged. Production client fields must never be changed to make a test pass.

### 6. Run retained upgrade tests

```bash
bun test src/lib/planner-phase2.test.ts
bun test src/lib/planner-phase3.test.ts
bun test src/lib/planner-phase4.test.ts
bun test src/lib/planner-phase5.test.ts
bun test src/lib/planner-phase6.test.ts
```

When phase-oriented tests are replaced, the replacement must be a stronger capability-oriented test. Removing a test without replacement is not acceptable.

### 7. Run build and migration validation

```bash
bunx prisma validate --schema prisma/schema.prisma
bunx prisma migrate status --schema prisma/schema.prisma
bun run build
```

Any schema stage must also run migrations against a clean PostgreSQL database and compare pre/post snapshots against populated fixtures.

## Stage completion gate

A stage is complete only when:

- Original baseline tests pass.
- The stage-specific parity capabilities pass.
- `KNOWN_ACTIVE_PARITY_GAPS` has not grown.
- Wedding isolation and role permissions pass.
- Pre/post integrity comparison has no unexplained differences.
- Empty weddings remain empty.
- Phase 1–6 retained capabilities still pass.
- The production build passes.
- Desktop and mobile workflows have been exercised for the changed modules.

## Required PR evidence

Every recovery PR must include:

1. Original capability IDs affected.
2. Gap-list changes.
3. Tests added or strengthened.
4. Integrity comparison result.
5. Migration impact statement.
6. Desktop and mobile evidence for UI changes.
7. Confirmation that no real wedding was seeded or overwritten.

## Tester release gates

The real-data tester must not begin Alpha until all six modules have full CRUD, search/filter parity, worksheet template/import/export controls, import mapping, history, and rollback in the active workspace.

Beta begins only after collaboration and wedding-day operations use the same canonical records rather than duplicate editors.
