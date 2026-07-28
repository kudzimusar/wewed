import { PrismaClient } from "@prisma/client";

/* ============================================================
   db.ts — Prisma Client singleton
   ------------------------------------------------------------
   In dev, we cache the client on `globalThis` so HMR doesn't
   exhaust DB connections. But that cache also keeps the OLD
   PrismaClient alive after a `db:push` (which regenerates
   @prisma/client with the new schema on disk). Without
   invalidation, the cached client throws
   "Unknown field `privacy` for select statement" because its
   runtime model is the pre-schema-change version.

   We solve this with a SCHEMA_VERSION stamp: bump it after any
   `prisma db push` (or `prisma generate`). If the cached
   client's stamp doesn't match, we disconnect & discard it,
   then instantiate a fresh one from the newly-regenerated
   @prisma/client module.

   In production, no caching happens — every cold start gets a
   fresh client.
   ============================================================ */

// Bump this after any `prisma db push` / `prisma generate`.
const SCHEMA_VERSION = "v2-wedding-content-2026-06";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  __prismaSchemaVersion?: string;
};

// Invalidate the cached client if the schema version changed.
if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prisma &&
  globalForPrisma.__prismaSchemaVersion !== SCHEMA_VERSION
) {
  // Best-effort disconnect; don't await — we're in module init.
  globalForPrisma.prisma
    .$disconnect()
    .catch(() => {
      /* ignore — dev-only teardown */
    });
  globalForPrisma.prisma = undefined;
}

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.__prismaSchemaVersion = SCHEMA_VERSION;
}
