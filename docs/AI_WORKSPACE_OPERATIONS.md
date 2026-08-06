# Wewed AI Workspace Operations

This runbook governs the four Wewed AI product areas, their data boundaries, human-review workflow, regression controls, release gates, and recovery procedures.

## Operating principle

> AI may analyse and draft inside an authorised wedding boundary. It may not silently select a wedding, follow instructions embedded in application data, mutate wedding records from chat, publish private documents, or send communications. Every supported write requires a durable proposal, human approval, a single atomic execution claim, and an audit record.

This follows the planner recovery requirement that AI receive a server-generated, wedding-scoped snapshot and never use hard-coded Charity and Kudzie data for another active wedding.

## Environments

### Preview

The `feature/ai-provider-router` branch uses branch-scoped Vercel Preview variables:

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
AI_PROVIDER_MAX_RETRIES=2
AI_MAX_OUTPUT_TOKENS=2048
```

Provider keys are server-only and must never use a `NEXT_PUBLIC_` prefix.

Shared Preview writes remain blocked unless:

```dotenv
WEWED_PREVIEW_WRITABLE_WEDDING_ID=<isolated-UAT-wedding-id>
```

### Production

Production remains unchanged until an exact-head Preview and controlled UAT pass. Environment-variable changes require a new deployment.

## Product surfaces

| Area | Surface | Data boundary | Write behaviour |
|---|---|---|---|
| Guest Concierge | `/w/<slug>` | Explicit guest wedding, published fields, public document chunks | None |
| Planner Copilot | `/planner/ai-workspace` | Active wedding and domain permissions | None from chat |
| Template Intelligence | `/planner/ai-workspace` | Active wedding, reviewed reusable output | Save version, then proposal/approval/execution |
| Communication Assistant | `/planner/ai-workspace` | Active wedding, intended audience and channel | Draft only; reminder conversion is controlled |

The AI workspace page is protected by the signed planner session before its client shell renders.

## Remediated release blockers

### Wedding identity

- Guest requests send an explicit `/w/<slug>` identity.
- The server accepts a valid explicit slug or the current guest-page referrer.
- There is no global Charity and Kudzie compatibility fallback.
- Missing or malformed wedding identity returns a controlled error.
- Planner chat, RSVP summaries, and speeches resolve the authenticated active wedding on the server.
- User-facing assistant copy contains no hard-coded couple, venue, date, or provider-version identity.

### Prompt-injection boundary

- Planner quick actions send an allowlisted operation identifier, not browser-built task or guest snapshots.
- The server loads only permitted data domains.
- Application context and retrieved documents are enclosed in explicit untrusted-data markers.
- Client-provided system messages are discarded.
- Chat routes are read-only.

### Private document publication

- Every ingested document is forced to `private`.
- A request that attempts direct public ingestion returns `PUBLIC_INGEST_BLOCKED`.
- Guest eligibility requires a publication proposal, human approval, and confirmed execution.
- Publication is transactional and updates document metadata and all chunks together.

### Single-claim action execution

The external state path is:

```text
proposed -> approved -> executing -> executed
         -> rejected      -> failed -> approved or rejected
```

- External requests cannot set or reopen `executing`.
- Execution atomically changes `approved` to `executing` and records a unique execution claim.
- Finalisation succeeds only for the matching claim.
- Two concurrent execution requests produce one successful claim and one conflict.
- Template application, reminder creation, communication approval, and document publication use wedding/resource advisory locks and database transactions.

### Communication state integrity

- Draft content is editable only while status is `draft`.
- Direct `approved`, `ready_to_send`, and `sent` state changes are rejected.
- A record can be marked sent only by a future delivery subsystem with delivery evidence.
- Approval never sends.
- Reminder conversion creates one planner reminder and explicitly reports that delivery did not occur.

### Stable document reindexing

- Schema-version 2 document metadata stores one canonical normalised source.
- Reindexing uses the canonical source, not overlapping retrieval chunks.
- Legacy chunks are reconstructed by removing overlap before canonical storage.
- Repeated reindexing must retain the same checksum and chunk count.

### Template anonymisation and versioning

- Saving a reusable template requires explicit human anonymisation confirmation.
- The server scans the template name, description, and content for email addresses, phone numbers, URLs, monetary amounts, active couple identity, guest names, and vendor names.
- Failed review returns `ANONYMIZATION_REVIEW_FAILED` with findings.
- An existing template family can be selected and saved as its next version.
- Version creation is serialised with a PostgreSQL advisory lock.
- Apply proposals read the template name, version, item count, and structured items from the stored server record; client-supplied counts are not trusted.

### GLM-first provider routing

Default routing is:

```dotenv
AI_PRIVATE_PROVIDER=zai
AI_QUALITY_PROVIDER=zai
AI_FALLBACK_PROVIDER=groq
AI_ALLOW_PRIVATE_FALLBACK=false
ZAI_MODEL=glm-4.7-flash
```

Provider handling preserves sanitised HTTP status, Z.AI business code, and provider message. Retryable concurrency, frequency, traffic, and transient server failures use bounded retry, `Retry-After`, exponential backoff, and jitter. Balance, plan, and exhausted-limit errors are not retried.

### Distributed rate limiting

AI chat, speech, and RSVP summary routes use a PostgreSQL-backed distributed limiter rather than process-local maps.

- Only a SHA-256 hash of scope and client identity is stored.
- Increments use one atomic `INSERT ... ON CONFLICT ... DO UPDATE` statement.
- Limits are shared across serverless instances.
- Expired buckets are cleaned opportunistically.
- Failure of the distributed control returns a controlled service-unavailable response rather than silently bypassing the limit.

## API inventory

### `POST /api/ai/chat`

- Public requests are forced to `guest_concierge`.
- Guest requests require a valid wedding identity.
- Planner requests require active-wedding `planner.view`.
- Quick actions accept only allowlisted operation IDs.
- Context is generated on the server.
- No database write is performed by chat.
- Responses expose provider, model, fallback, usage, and source metadata for diagnostics.

### `POST /api/ai/summary`

- Requires `guests.view`.
- Ignores browser-supplied RSVP snapshots.
- Queries aggregate RSVP data for the active wedding on the server.
- Guest names, contact details, and private messages are excluded from the AI prompt.

### `POST /api/ai/speech`

- Requires `planner.view`.
- Uses active-wedding title, date, venue, and tagline.
- Uses placeholders for unavailable personal stories.
- Never uses a hard-coded couple or venue.

### Templates

`GET /api/ai/templates` returns latest versions and history.

`POST /api/ai/templates` supports:

- `save_version`: anonymisation review plus locked version creation;
- `propose_apply`: server-trusted proposal creation.

### Communication drafts

`GET /api/ai/drafts` lists active-wedding drafts.

`POST /api/ai/drafts` supports:

- `create`;
- `propose_approval`;
- `propose_reminder`.

`PATCH /api/ai/drafts` edits draft content or archives a permitted record. Controlled approval and delivery states are unavailable through this endpoint.

### Action review

`GET /api/ai/actions` lists the active wedding review queue.

`PATCH /api/ai/actions` accepts external requests for:

- `approved`;
- `rejected`;
- `executed`, only when the current state is `approved`.

Supported execution types:

- `apply_template`;
- `approve_communication`;
- `create_reminder`;
- `publish_guest_document`.

### Documents

`GET /api/ai/documents` lists or searches active-wedding documents.

`POST /api/ai/documents` supports:

- private `ingest`;
- canonical `reindex`;
- `propose_publish`;
- `delete_expired`.

`DELETE /api/ai/documents` deletes metadata and all indexed chunks.

## Storage

### Existing governed tables

- `ContentRevision`
  - `ai_template_version`
  - `ai_communication_draft`
  - `ai_action_proposal`
- `WeddingContent`
  - `ai_document`
  - `ai_document_chunk`
- `AuditEvent`
  - creation, approval, rejection, claim, execution, failure, publication, ingestion, deletion, and reindexing

### Distributed limiter

`AiRateLimitBucket` contains:

- hashed scope/client identity;
- fixed window start;
- atomic request count;
- expiry timestamp.

It contains no raw IP address, provider key, prompt, wedding content, or response body.

## Database migrations

```text
prisma/migrations/20260806190000_ai_workspace_indexes/migration.sql
prisma/migrations/20260806223000_ai_distributed_rate_limit/migration.sql
```

Validated indexes:

- `ContentRevision_ai_workspace_idx`
- `WeddingContent_ai_document_lookup_idx`
- `WeddingContent_ai_document_search_idx`
- `AiRateLimitBucket_expiresAt_idx`

Migrations are additive and do not seed or overwrite wedding records.

## Automated validation

### Focused AI gate

Workflow:

```text
.github/workflows/ai-workspace-ci.yml
```

It validates:

1. Prisma schema and client generation;
2. every AI migration on PostgreSQL 16;
3. full-text and distributed-rate-limit PostgreSQL contracts;
4. runtime fixture seed;
5. input, provider, template, document, action, and communication unit contracts;
6. strict AI TypeScript validation;
7. production build;
8. authenticated built-server runtime smoke;
9. optional real GLM smoke when the repository `ZAI_API_KEY` secret is configured.

### Built-runtime smoke

`scripts/test-ai-workspace-runtime.sh` verifies:

- explicit guest wedding identity and missing-identity rejection;
- server-controlled Planner Copilot operation;
- provider-unavailable fallback after successful wedding resolution;
- sensitive template rejection;
- version 1 and version 2 in one template family;
- server-trusted template proposal counts;
- one-success/one-conflict concurrent execution;
- direct sent-state rejection;
- editable draft and reminder conversion without sending;
- direct public document-ingest rejection;
- private ingestion and search;
- stable repeated reindex checksums;
- reviewed publication and deletion;
- unauthenticated API rejection;
- authenticated AI workspace rendering.

### Browser release gate

`tests/e2e/ai-workspace.spec.ts` exercises the four-area UI, active-wedding API boundary, anonymisation, versioning, single-claim execution, communication controls, private document lifecycle, publication, and mobile overflow.

The general planner release gate also preserves all worksheet and planner regression suites, including task filtering, wedding isolation, CRUD, import/export, rollback, permissions, routing, mobile behaviour, and strict rejection of flaky browser retries.

### Qualified code evidence

The remediation code head below passed both focused AI validation and the complete strict planner release gate:

```text
258ee7ecdd0353edca6915975bffd449510dbb1a
```

Focused AI workflow:

```text
run 31055794925
job 92472894274
conclusion success
```

Complete planner workflow:

```text
run 31055794905
job 92472894585
conclusion success
browser release gate success with no accepted retry
```

Any later documentation or release commit must pass the same exact-head gates before use.

## Exact-head Preview and UAT

Automated validation is not a substitute for exact-head Preview UAT.

A Preview is qualified only when:

1. Vercel state is `READY`;
2. deployment Git SHA equals the current PR head or a verified descendant containing the qualified code;
3. `/api/ai/health` reports enabled Z.AI `glm-4.7-flash` routing;
4. a live request reports `provider: zai`, `model: glm-4.7-flash`, and `fallback: false`;
5. the isolated writable UAT wedding is configured before mutation tests;
6. runtime error and fatal logs are clear.

Do not use an older branch Preview as release evidence. Production remains unchanged.

## Four-area UAT

### Guest Concierge

- Test two guest-accessible weddings with different couple, venue, and ceremony facts.
- Confirm no cross-wedding fact appears.
- Confirm an unknown fact is not invented.
- Confirm private planner and private document data are unavailable.
- Publish one controlled document and verify its visible source citation.
- Place a prompt-injection sentence inside a document and verify it is treated as data.

### Planner Copilot

- Run daily brief, RSVP summary, task priorities, and budget review.
- Confirm active-wedding facts and permissions.
- Confirm chat changes no task, guest, budget, vendor, timeline, or seating record.
- Test malicious task and dietary-note text as untrusted data.
- Switch weddings and confirm no previous wedding data remains.

### Template Intelligence

- Generate a reusable template with task, timeline, and reminder JSON items.
- Verify sensitive active-wedding data is rejected.
- Save version 1 and version 2 in the same family.
- Verify no planner record changes before execution.
- Reject one proposal and confirm no write.
- Approve and execute a fresh proposal.
- Double-submit execution and confirm one write only.
- Verify duplicates are skipped and audit events exist.

### Communication Assistant

- Generate and save an email draft.
- Edit while still a draft and verify persistence.
- Confirm no email, WhatsApp, or SMS is sent.
- Verify direct `sent` state is rejected.
- Approve and convert one email draft to one planner reminder.
- Confirm the result states delivery did not occur.
- Generate a speech for a second wedding and verify only that wedding's context is used.

## Planner regression requirement

Retain the planner test requirement for priority filtering:

```text
Any priority -> High
```

Expected:

- `UAT-TASK-001 Confirm florist arrival` remains visible;
- medium- and low-priority tasks are hidden;
- the task appears once;
- status remains `In progress`;
- no task data changes;
- no error appears.

## Incident response

### Provider unavailable

1. Check `/api/ai/health`.
2. Review sanitised AI router logs and Z.AI business code.
3. Check account balance, plan, concurrency, and rate limits without exposing the key.
4. Keep private fallback disabled unless a privacy review explicitly authorises another provider.

### Incorrect guest answer

1. Confirm the explicit page slug.
2. Check grounding-health counts.
3. Review published wedding fields and public documents.
4. Correct or delete the source; reindex from canonical source when necessary.

### Suspected private-data exposure

1. Disable AI for the affected environment.
2. Remove guest access or public document visibility.
3. Delete affected document chunks if required.
4. Preserve audit history and sanitised logs.
5. Rotate a provider credential only when credential exposure is suspected.

### Stuck action

External clients cannot reopen `executing`. Recovery must be an explicit operator procedure that verifies the execution claim and audit history before any internal state repair.

## Rollback

Application rollback:

- revert the branch commit or restore the previous Preview deployment;
- keep Production unchanged until release approval.

Data rollback:

- templates, drafts, proposals, documents, and limiter buckets are isolated from core client records;
- documents can be deleted with all chunks;
- template execution is transactional and audited;
- deliberate reversal of executed planner records uses normal planner controls and audit evidence;
- never delete audit history to conceal a failed or reversed action.
