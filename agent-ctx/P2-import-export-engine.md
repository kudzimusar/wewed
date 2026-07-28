# P2 — Reusable Import/Export Engine

## Task
Build the core import/export engine that all 10 worksheet modules will use. Production-quality, reusable, well-typed.

## Files delivered (12)

### Library — `/src/lib/import-engine/`
1. **types.ts** — Core type definitions: `ModuleKey`, `FieldDefinition`, `ModuleSchema`, `RowAction`, `ImportRow`, `ImportPreview`, `ImportResult`, `ParsedFile`, `RollbackSnapshot`.
2. **schemas.ts** — All 10 module schemas (guests, budget, checklist, seating, vendors, timeline, songs, wedding-party, travel, media). Each has fields[], rowToRecord, recordToRow, validateRow, uniqueKey, fetchExisting, upsert. Shared parsing helpers (`clean`, `parseNumber`, `parseCurrency`, `parseDate`, `parseBool`, `parseList`, `neuterFormula`) for security + normalization. `_importMeta` pattern preserves extra fields per-record so the engine is forward-compatible with future schema additions.
3. **parser.ts** — `parseFile(buffer, mimeType)` → `ParsedFile`. Detects xlsx by magic bytes (PK\x03\x04) else CSV. Uses `xlsx` for .xlsx and `papaparse` for .csv. Strips BOM, null bytes, dedupes headers, skips empty rows, never evaluates formulas. Also exports `fileFingerprint()` for stable job IDs.
4. **mapper.ts** — `autoMap(headers, schema)` + `applyMapping(rows, mapping)` + `findMissingRequired()` + `findUnmappedColumns()`. Fuzzy matching: exact key/label → substring match → token-overlap → Levenshtein (≥80% similarity for ≥4-char strings). Greedy assignment (highest score wins; field can't be claimed twice).
5. **validator.ts** — `validateRow(row, schema)` → `{ errors, warnings }`. Type checks per field type (number, currency, date, email, phone, enum, boolean), required check, allowed-values check, sensitive-field warnings, length sanity. Falls through to schema's custom `validateRow` for cross-field rules.
6. **preview.ts** — `generatePreview(parsed, schema, weddingId, fileName)` → `ImportPreview`. Per-row action logic: invalid → has errors; create → no unique-key match; update → existing match + differs; skip → existing match + no diff OR intra-file duplicate; conflict → update that touches required fields. Surfaces unmapped columns + missing required fields.
7. **executor.ts** — `executeImport(preview, schema, weddingId)` → `ImportResult` + `rollbackImport(token)` → `RollbackResult`. Per-row Prisma transaction. Snapshots pre-update state for restoration. In-memory rollback store (per-wedding cap of 50 snapshots, auto-prune). Aborts after 5 DB errors. Will swap to Prisma ImportJob model when added.
8. **template.ts** — `generateTemplate(schema)` → `Buffer`. 3-sheet workbook: Template (header + example), Instructions (per-field table), About (version + security notes). Every cell forced to string type to prevent formula execution + Excel auto-conversion.
9. **exporter.ts** — `exportModule(schema, weddingId, format)` → `Buffer`. Supports xlsx (xlsx lib, text cells, frozen header, auto-width) and csv (json2csv, BOM-prefixed for Excel Unicode compatibility).
10. **wedding.ts** — `getFlagshipWeddingId()` helper (resolves "charity-and-kudzie" slug).
11. **index.ts** — Re-exports the full engine API.

### API routes — `/src/app/api/`
12. **templates/[module]/route.ts** — GET, admin-gated, returns .xlsx template.
13. **exports/[module]/route.ts** — GET, admin-gated, supports `?format=xlsx|csv`, returns current wedding's data.
14. **imports/route.ts** — POST (multipart file + moduleKey → preview + jobId, stored in memory), GET (recent previews list). 10 MB cap, .xlsx/.csv only.
15. **imports/[jobId]/route.ts** — GET (preview + execution status), POST (execute, optional `rowIndices` subset), DELETE (rollback via `?rollbackToken=`).

## Design decisions
- **_importMeta pattern**: Many module fields (e.g. Guest's dietary, transport, accommodation) don't have matching Prisma columns yet. Rather than block these, schemas preserve the extras in a `_importMeta` object on the record; upsert strips `_importMeta` before writing. This means imports work today AND can be migrated to real columns when the schema grows.
- **Travel** uses Guest model with roleDetail prefixed "Travel:" — fetchExisting filters by `roleDetail.startsWith('Travel:')`. When a dedicated Travel model is added, the schema can be updated without breaking the API.
- **Seating** is a 2-step upsert: ensure the SeatingTable exists, then link/update the Guest. The createdIds in the rollback snapshot are guest IDs (not table IDs — tables may have other guests assigned).
- **Stable job IDs**: `imp_{fileFingerprint}_{moduleKey}` so uploading the same file twice returns the same jobId (no preview-store pollution).
- **Security**: Every string is run through `neuterFormula()` which strips leading `=+-@\t\r` chars — the spreadsheet-formula-injection defense. Cells in templates + exports are forced to `t: 's'` (string type) so Excel can't auto-evaluate them.
- **Atomicity**: Each row's upsert runs in its own `db.$transaction`. The 5-error circuit breaker prevents hammering a constraint violation 1000 times.
- **Rollback store**: In-memory `Map<token, RollbackSnapshot>` with per-wedding cap of 50 (LRU-ish). Will be replaced by Prisma `ImportJob` model in a later hardening pass — the public `executeImport`/`rollbackImport` API won't change.

## Verification
- ✅ `bun run lint` — 0 errors
- ✅ `npx tsc --noEmit` — 0 errors in src/ (only pre-existing skills/ folder errors remain, unrelated to this task)
- ✅ All 10 modules have schemas with complete field lists per spec
- ✅ All API routes use the shared `requireAdmin` gate
- ✅ File size cap (10 MB) + extension allowlist (.xlsx, .csv) enforced
- ✅ Every lib file is server-only (no `'use client'`)

## Handover notes for next agents
- **Phase 3 agents** wiring UI buttons should call:
  - Download template: `GET /api/templates/{module}` (returns .xlsx)
  - Export current: `GET /api/exports/{module}?format=xlsx|csv`
  - Upload + preview: `POST /api/imports` (multipart, returns `{ jobId, preview }`)
  - Execute: `POST /api/imports/{jobId}` (optional `{ rowIndices: number[] }` body)
  - Rollback: `DELETE /api/imports/{jobId}?rollbackToken=xxx`
- The `preview.rows[]` array has `action: 'create' | 'update' | 'skip' | 'invalid'` for the UI to color-code rows in a review table.
- `preview.fieldMapping` shows source-column → internal-field mapping; the UI could let the user override this before executing (not yet implemented — current API auto-maps only).
- `preview.missingRequired` and `preview.unmappedColumns` are pre-computed to drive UI warnings ("You're missing the First Name column!").
- For Prisma schema growth: when adding fields to Guest (e.g. `dietary`, `transport`), update the corresponding schema's `rowToRecord`/`recordToRow` to write the real column instead of `_importMeta`. Existing imports keep working.
