# Wewed AI Workspace Operations

This runbook covers operation, review, release, and recovery for the four-area Wewed AI implementation.

## Environments

### Preview

The `feature/ai-provider-router` branch uses Vercel Preview variables scoped to that branch. Required server-side variables include:

```dotenv
AI_ENABLED=true
ZAI_API_KEY=...
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
ZAI_MODEL=glm-4.7-flash
AI_PRIVATE_PROVIDER=zai
AI_QUALITY_PROVIDER=zai
AI_FALLBACK_PROVIDER=groq
AI_ALLOW_PRIVATE_FALLBACK=false
AI_REQUEST_TIMEOUT_MS=30000
AI_MAX_OUTPUT_TOKENS=2048
```

Do not prefix provider keys with `NEXT_PUBLIC_`.

### Production

Production must not receive the Preview branch configuration until all release gates pass. Environment-variable changes require a new deployment.

## Product surfaces

| Surface | Route | Audience | Write behaviour |
|---|---|---|---|
| Guest Concierge | `/w/<slug>` | Guest-accessible wedding visitors | None |
| Planner AI Operations | `/planner/ai-workspace` | Authenticated wedding members | Drafts/proposals only through explicit controls |
| AI provider health | `/api/ai/health` | Diagnostic | None |
| Grounding health | `/api/ai/context/health?slug=<slug>` | Safe public diagnostic | None |

## API inventory

### Chat

`POST /api/ai/chat`

- Public requests are forced to `guest_concierge`.
- Planner requests require the active wedding context and `planner.view`.
- Client system messages are discarded.
- The endpoint never writes to the database.
- The response may include provider/model/usage diagnostics and retrieved source metadata.

### Templates

`GET /api/ai/templates`

- Requires `planner.view`.
- Returns latest templates plus version history.

`POST /api/ai/templates`

- Requires `planner.edit`.
- `save_version`: persists a versioned template draft.
- `propose_apply`: creates a human-review action proposal.

### Communication drafts

`GET /api/ai/drafts`

- Requires `planner.view`.

`POST /api/ai/drafts`

- Requires `planner.edit`.
- `create`: persists a draft.
- `propose_approval`: creates an approval proposal.
- `propose_reminder`: proposes conversion to an existing planner email reminder.

`PATCH /api/ai/drafts`

- Requires `planner.edit`.
- Updates content or state; does not send.

### Action review

`GET /api/ai/actions`

- Requires `planner.view`.

`PATCH /api/ai/actions`

- Requires `planner.edit`.
- Supports `approved`, `rejected`, and `executed` transitions.
- `executed` is accepted only from `approved`.
- Execution atomically claims the proposal before writes begin.
- Failure is recorded and can be reviewed.

Supported action types:

- `apply_template`
- `approve_communication`
- `create_reminder`
- `publish_guest_document`

### Documents

`GET /api/ai/documents`

- Requires `planner.view`.
- No query: list indexed documents.
- `?q=<query>`: search authorised document chunks.

`POST /api/ai/documents`

- Requires `planner.edit`.
- `ingest`: chunk and index extracted text.
- `reindex`: rebuild chunks and checksum.
- `propose_publish`: create a public-access proposal.
- `delete_expired`: enforce retention dates.

`DELETE /api/ai/documents`

- Requires `planner.edit`.
- Deletes document metadata and all chunks.

## Storage model

Wewed reuses existing governed records.

### `ContentRevision`

| Section | Purpose |
|---|---|
| `ai_template_version` | Versioned template drafts |
| `ai_communication_draft` | Durable communications |
| `ai_action_proposal` | Human review and execution state |

### `WeddingContent`

| Section | Purpose |
|---|---|
| `ai_document` | Document metadata |
| `ai_document_chunk` | Searchable text chunks |

### `AuditEvent`

Records AI record creation, state changes, execution results, ingestion, deletion, and reindexing. Do not log provider keys, full prompts, or raw provider response bodies.

## Permissions and boundaries

### Guest

A wedding must have `public`, `unlisted`, or `link_only` privacy. `private` weddings are not eligible.

The context builder uses only:

- published wedding fields;
- programme items;
- allowlisted guest page sections;
- document chunks marked `public`.

### Planner

The active wedding is resolved from the authenticated session. Context domains are loaded only when the membership has the corresponding permission:

- `planner.view`
- `guests.view`
- `budget.view`
- `vendors.view`
- `timeline.view`

Writes require `planner.edit`.

### Shared Preview safety

AI workspace write routes reuse Wewed's Preview write-safety policy. In a shared Preview, writes are blocked unless `WEWED_PREVIEW_WRITABLE_WEDDING_ID` identifies the isolated UAT wedding. Reads and provider tests remain available.

## Human-confirmed action procedure

1. Generate an analysis, template, or communication.
2. Save it as a durable template version or communication draft.
3. Create a proposal in the review queue.
4. Review the exact effect and affected record types.
5. Approve or reject.
6. Execute only after approval.
7. Review the execution result and audit event.

Never bypass the proposal state machine from the chat route.

## Template application safety

Template Intelligence may emit structured JSON items. The server accepts only:

- `task`
- `timeline`
- `reminder`

Validation includes:

- required non-empty title;
- allowlisted priority and audience;
- bounded date offsets;
- bounded text lengths;
- maximum item count;
- duplicate detection against current records.

Execution runs in a database transaction and takes a wedding-scoped PostgreSQL advisory lock before duplicate checks and writes. If the transaction fails, the proposal records the failure.

## Communication safety

- All generated communication starts as a draft.
- Approval does not send.
- Reminder conversion creates a planner reminder only.
- Existing reminder preview/send controls remain the delivery boundary.
- Duplicate reminder conversion is detected by the source AI draft identifier.
- WhatsApp and SMS channels are metadata until explicit delivery integrations exist.

## Document lifecycle

### Ingestion

Accepted browser text formats:

- TXT
- Markdown
- CSV
- JSON
- pasted extracted text

PDF and DOCX files must have their text extracted before ingestion.

### Visibility

- Default: `private`.
- Planner retrieval may use private documents for the active wedding.
- Guest retrieval may use only `public` chunks.
- Publishing requires a reviewed and approved action proposal.

### Retention

An optional retention date may be stored on each document. The AI Operations page includes an explicit “Delete expired” control. Deletion removes metadata and all chunks and writes an audit event.

### Reindex

Reindexing reconstructs source text from existing chunks, recalculates the checksum, rebuilds chunks, and updates the indexed timestamp. PostgreSQL’s GIN full-text index updates with the new records.

## Database migration

Migration:

```text
prisma/migrations/20260806190000_ai_workspace_indexes/migration.sql
```

Indexes:

- `ContentRevision_ai_workspace_idx`
- `WeddingContent_ai_document_lookup_idx`
- `WeddingContent_ai_document_search_idx`

The Supabase migration is named `ai_workspace_indexes`.

## Validation commands

### Provider smoke

Requires a configured provider key:

```bash
bun run ai:test
```

### Focused unit contracts

```bash
bun run ai:unit
```

### Prisma and build

```bash
bunx prisma validate --schema prisma/schema.prisma
bunx prisma generate --schema prisma/schema.prisma
bunx tsc --project tsconfig.ai.json --pretty false
bun run build
```

### PostgreSQL contract

Against an isolated migrated database:

```bash
psql -h localhost -p 5432 -U postgres -d wewed \
  -f scripts/ai-workspace-postgres-integration.sql
```

### Built-runtime smoke

After build and fixture seed:

```bash
psql -h localhost -p 5432 -U postgres -d wewed \
  -f scripts/ai-workspace-runtime-seed.sql
bash scripts/test-ai-workspace-runtime.sh
```

The runtime test verifies:

- provider health behaviour while disabled;
- all four area contracts;
- `link_only` guest grounding;
- published/private document isolation;
- provider-unavailable fallback after successful context resolution;
- authenticated planner chat;
- durable template, draft, proposal, and document APIs;
- approval-before-execution state transitions;
- transactional template application;
- repeated execution protection;
- reminder conversion without sending;
- private document search, controlled publication, and deletion;
- unauthenticated planner API rejection;
- planner AI workspace route rendering.

## CI release gate

Workflow:

```text
.github/workflows/ai-workspace-ci.yml
```

The gate performs:

1. dependency installation;
2. Prisma validation and generation;
3. all migrations on PostgreSQL 16;
4. AI database-index contract checks;
5. runtime fixture seed;
6. focused unit tests;
7. focused strict TypeScript validation;
8. production build;
9. authenticated built-server runtime smoke.

Latest completed evidence for this implementation:

- workflow: `AI Workspace CI`
- run: `31035751241`
- head: `45d329dac1d9c8493527812020f2c1b1c95ebdcf`
- conclusion: `success`
- validated steps: migrations, PostgreSQL contract, runtime fixture, unit tests, AI TypeScript gate, production build, authenticated runtime smoke

A release is not ready while this workflow is red.

## Vercel Preview validation

Validated branch deployment:

- branch alias: `wewed-git-feature-ai-provider-router-pay-pass-project.vercel.app`
- deployment: `dpl_2XxaWBe9syLxuyn6oEXdwB3h9DAq`
- source branch: `feature/ai-provider-router`
- state: `READY`
- error-only build log: no build errors
- `/api/ai/health`: enabled, one configured provider, Z.AI `glm-4.7-flash`, Z.AI selected for private and quality routing, private fallback disabled
- Preview runtime error/fatal query: no matching logs in the reviewed two-hour window

Production remains unchanged.

## Preview review checklist

- [x] `/api/ai/health` reports Z.AI as configured.
- [x] Guest chat reaches Z.AI in the branch Preview.
- [x] Guest Markdown renders correctly.
- [x] Guest grounding is wedding-specific and excludes private document chunks by contract and runtime test.
- [x] `/planner/ai-workspace` builds and renders in authenticated runtime smoke.
- [x] All four product-area contracts are present and tested.
- [x] Template and communication outputs persist through authenticated runtime tests.
- [x] Review queue requires approval before execution.
- [x] Document search is wedding-scoped and visibility-aware.
- [x] Production deployment and production environment variables are unchanged.

## Incident response

### Provider unavailable

1. Check `/api/ai/health`.
2. Check Vercel runtime errors for AI routes.
3. Verify account quota/rate limits without exposing the key.
4. Keep user-facing fallback behaviour enabled.
5. Do not enable private cross-provider fallback without a privacy review.

### Incorrect guest answer

1. Confirm the page slug and grounding-health counts.
2. Review the published wedding fields and allowlisted content.
3. Review public indexed documents.
4. Unpublish or delete the incorrect document through the controlled workflow.
5. Reindex if source text changed.

### Suspected private-data exposure

1. Disable AI in the affected environment.
2. Remove public visibility from the relevant document or wedding.
3. Delete affected indexed chunks if required.
4. Review `AuditEvent` history.
5. Rotate provider credentials if a key may have been exposed.
6. Preserve logs that do not contain private prompt content.

### Failed action execution

1. Inspect the proposal failure message.
2. Confirm the proposal belongs to the active wedding.
3. Review duplicate or invalid structured items.
4. Correct the durable draft/template rather than editing the execution code path ad hoc.
5. Approve again only after the cause is understood.

## Rollback

Application rollback:

- restore the previous Vercel Preview deployment or revert branch commits;
- keep Production unchanged until release approval.

Data rollback:

- templates, drafts, and proposals are isolated by section and wedding;
- documents can be deleted with all chunks;
- template execution is transactional but may create valid wedding records after approval, so use the audit event and normal planner delete/edit controls for deliberate reversal;
- never delete audit history to hide a failed or reversed action.

## Known platform concerns outside this AI change

Supabase advisors currently report pre-existing security and performance findings, including public tables without RLS, RLS-enabled tables without policies, function search-path warnings, and other schema-level issues. These must be resolved in a separate, policy-led database-hardening release. Enabling RLS without complete policies could break the application and is not part of this AI implementation.
