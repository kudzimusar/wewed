# Wewed — Supabase Production Setup

This document describes the **current** Wewed Supabase contract. It supersedes the early prototype instructions that used `prisma db push`, public media buckets, local production uploads, and the retired `wewed.app` domain.

The production application is expected to use:

- PostgreSQL/Supabase as the authoritative application database;
- Prisma migrations as the schema/change ledger;
- a **private** Supabase Storage bucket for wedding photos and videos;
- Wewed server-side access checks before signed media URLs are issued;
- `wewed.pro` as the controlled public application domain;
- Vercel for application hosting.

Do not make the wedding media bucket public and do not patch the production database with ad-hoc SQL when a repository migration exists.

---

## 1. Required environment variables

Configure these in the relevant local or deployment environment. Never commit live secrets.

```bash
# PostgreSQL / Supabase
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase API
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"

# Server-only. Never expose this value to the browser.
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# Public Wewed origin
NEXT_PUBLIC_SITE_URL="https://wewed.pro"
```

`SUPABASE_SERVICE_ROLE_KEY` is used only by trusted server code for operations such as writing private Storage objects and issuing short-lived signed media URLs. Client components must never receive it.

---

## 2. Database migrations

Wewed is already PostgreSQL-backed. Do **not** switch providers or use `prisma db push` against production.

The controlled migration sequence is:

```bash
bunx prisma validate --schema prisma/schema.prisma
bunx prisma generate --schema prisma/schema.prisma
bunx prisma migrate deploy --schema prisma/schema.prisma
bunx prisma migrate status --schema prisma/schema.prisma
```

Production database deployment should run through `.github/workflows/deploy-database.yml`. That workflow validates the database target and applied-migration checksums before running `prisma migrate deploy`.

The repository migration ledger is authoritative. Existing applied migrations must not be rewritten.

---

## 3. Wedding media storage

### Bucket contract

The required bucket is:

```text
wedding-media
```

It must be configured as:

- **private** (`public = false`);
- maximum object size: **10 MB**;
- allowed types:
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/gif`
  - `video/mp4`
  - `video/webm`

Repository migration `20260813104000_private_wedding_media_storage` provisions or repairs this bucket automatically when the target database exposes the Supabase `storage` schema. On ordinary PostgreSQL CI databases, the migration safely skips the Storage-specific statement.

There should normally be no need to create the bucket manually. If its state is being investigated, compare it with the repository migration rather than changing it independently in the dashboard.

### Why the bucket is private

Wedding media can belong to a public wedding, an invitation-only wedding, or a private wedding. Making the Storage bucket public would allow direct object URLs to bypass Wewed's wedding-access rules.

Instead, the database stores an internal locator such as:

```text
supabase://wedding-media/<wedding-id>/photos/<uuid>.jpg
```

That locator is not a public download URL.

`GET /api/media?slug=<wedding-slug>` first resolves access to the requested wedding. Only after that succeeds does the server ask Supabase for a short-lived signed URL and return it to the authorized viewer.

This keeps Storage authorization aligned with Wewed's wedding authorization rather than relying on obscurity of an object path.

---

## 4. Media upload flow

`POST /api/media` uses the following boundary:

1. Resolve the wedding from the supplied slug/request context.
2. Resolve the viewer's wedding access.
3. Reject anonymous public upload attempts with `403`.
4. Validate MIME type and the 10 MB limit.
5. Upload the bytes to the private `wedding-media` bucket under the active wedding ID.
6. Store the internal private Storage locator in `MediaItem`.
7. Return a signed URL only after the database record has been created.

Object paths are isolated by wedding ID:

```text
wedding-media/
  <wedding-id>/
    photos/
      <uuid>.jpg
    videos/
      <uuid>.webm
```

Production does **not** fall back to the Vercel/application filesystem. If Supabase Storage is not configured, production upload fails closed with `503` rather than reporting a durable upload that can disappear with the serverless instance.

Local development may use `public/uploads/<wedding-slug>/...` only when Storage configuration is intentionally absent.

---

## 5. Reading wedding media

The media API always scopes its database query by the resolved wedding ID.

For private Supabase objects it then calls `createSignedUrl` server-side. Signed URLs are intentionally short lived. A stored signed URL should never be treated as the permanent database identity of an object.

The gallery and other wedding components should consume `/api/media` rather than trying to construct Supabase public URLs themselves.

---

## 6. Memory Capsule

The classic Memory Capsule uses the same media authorization boundary rather than a parallel storage system.

On supported browsers an authorized wedding participant can:

1. grant camera and microphone permission;
2. record the configured short video with `MediaRecorder`;
3. preview or re-record it;
4. submit the resulting WebM file through `/api/media`;
5. receive success only after the wedding-scoped media service accepts it.

A public/unauthorized viewer can see the classic capsule presentation but cannot record or submit a video.

This prevents a visually rich wedding page from becoming a separate unaudited upload surface.

---

## 7. Authentication and authorization

Supabase credentials do not replace Wewed application authorization.

The server must continue to enforce:

- active wedding context;
- wedding membership/owner/planner rules;
- invitation-scoped guest access;
- public versus private/link-only wedding privacy;
- admin permissions where applicable.

The service-role key is an infrastructure credential, not evidence that the current end user may access every wedding.

---

## 8. Vercel configuration

Production/preview deployments that are expected to support durable uploads need:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL=https://wewed.pro`

A preview deployment that deliberately points to an isolated test database should use the matching Supabase Storage environment as well. Do not point an otherwise isolated preview at production private media unless that is an explicit UAT decision.

---

## 9. Production verification

After an approved migration/deployment, verify the following as one unit:

- Prisma migration status is clean.
- `storage.buckets` contains `wedding-media` with `public = false`.
- The 10 MB limit and allowed MIME types match the repository migration.
- An authorized invitation/member can upload a small image or WebM video.
- The resulting `MediaItem.url` is an internal `supabase://wedding-media/...` locator, not a public Storage URL.
- The same authorized viewer can load the media through `/api/media`.
- An anonymous public viewer cannot POST media.
- A viewer without access to a private wedding cannot obtain its signed media URLs.
- A deployment without Storage configuration fails production uploads closed rather than writing to local disk.

---

## 10. Canonical wedding presentation data

Wedding-specific media roles such as the Hero image and Story portrait live in `WeddingContent`; they are not reusable component hardcodes.

For the flagship Charity & Kudzie wedding, the canonical repair migrations seed presentation roles such as:

```text
hero.imageUrl       -> /hero-wedding.png
story.familyImageUrl -> /couple-silhouette.png
```

These are wedding-scoped content records. Other weddings use the same renderer with their own records and must not inherit Charity-specific identity or content automatically.

Presentation migrations use conflict-safe semantics so a real couple/planner edit is not overwritten by a later repair migration.

---

## Operational rule

Supabase, Prisma, Vercel and the Wewed UI are one production system. A change is complete only when the database migration, storage policy, server authorization, client rendering and release tests agree on the same contract.
