import { PrismaClient } from "@prisma/client";

/* ============================================================
   db.ts — Prisma Client singleton
   ------------------------------------------------------------
   In dev, we cache the client on `globalThis` so HMR doesn't
   exhaust DB connections. But that cache also keeps the OLD
   PrismaClient alive after a schema change. The version stamp
   invalidates the cached client whenever the Prisma data model
   changes.
   ============================================================ */

const SCHEMA_VERSION = "v3-wedding-memberships-2026-07";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  __prismaSchemaVersion?: string;
};

if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prisma &&
  globalForPrisma.__prismaSchemaVersion !== SCHEMA_VERSION
) {
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
