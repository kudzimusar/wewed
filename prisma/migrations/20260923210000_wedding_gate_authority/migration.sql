-- Phase 10: Additive domain for WeddingGate and WeddingGateAssignment
-- Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 10

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeddingGate" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeddingGate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WeddingGate_status_check" CHECK ("status" IN ('active', 'disabled'))
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeddingGateAssignment" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operatorRole" TEXT NOT NULL DEFAULT 'usher',
    "capabilities" TEXT,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeddingGateAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WeddingGateAssignment_operatorRole_check" CHECK ("operatorRole" IN ('usher'))
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeddingGate_weddingId_status_idx" ON "WeddingGate"("weddingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingGate_id_weddingId_key" ON "WeddingGate"("id", "weddingId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingGate_weddingId_name_key" ON "WeddingGate"("weddingId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeddingGateAssignment_userId_weddingId_idx" ON "WeddingGateAssignment"("userId", "weddingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeddingGateAssignment_gateId_weddingId_idx" ON "WeddingGateAssignment"("gateId", "weddingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeddingGateAssignment_weddingId_revokedAt_idx" ON "WeddingGateAssignment"("weddingId", "revokedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeddingGate_weddingId_fkey'
  ) THEN
    ALTER TABLE "WeddingGate" ADD CONSTRAINT "WeddingGate_weddingId_fkey"
      FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeddingGateAssignment_weddingId_fkey'
  ) THEN
    ALTER TABLE "WeddingGateAssignment" ADD CONSTRAINT "WeddingGateAssignment_weddingId_fkey"
      FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeddingGateAssignment_gateId_weddingId_fkey'
  ) THEN
    ALTER TABLE "WeddingGateAssignment" ADD CONSTRAINT "WeddingGateAssignment_gateId_weddingId_fkey"
      FOREIGN KEY ("gateId", "weddingId") REFERENCES "WeddingGate"("id", "weddingId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeddingGateAssignment_userId_fkey'
  ) THEN
    ALTER TABLE "WeddingGateAssignment" ADD CONSTRAINT "WeddingGateAssignment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeddingGateAssignment_revokedByUserId_fkey'
  ) THEN
    ALTER TABLE "WeddingGateAssignment" ADD CONSTRAINT "WeddingGateAssignment_revokedByUserId_fkey"
      FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeddingGateAssignment_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "WeddingGateAssignment" ADD CONSTRAINT "WeddingGateAssignment_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
