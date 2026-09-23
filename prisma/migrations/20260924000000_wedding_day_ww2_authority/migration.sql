-- Phase 11A: Converged Wedding Day / WW2 Schema and Authority
-- Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 11A

-- Step 0: Prerequisite composite unique index on Guest for cross-wedding integrity
CREATE UNIQUE INDEX IF NOT EXISTS "Guest_id_weddingId_key"
    ON "Guest"("id", "weddingId");

-- CreateTable WeddingPassKey
CREATE TABLE IF NOT EXISTS "WeddingPassKey" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'ECDSA_P256_SHA256',
    "publicKeyPem" TEXT NOT NULL,
    "publicKeyDerBase64" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeddingPassKey_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WeddingPassKey_status_check" CHECK ("status" IN ('active', 'revoked', 'retired'))
);

-- CreateTable WeddingPassCredential
CREATE TABLE IF NOT EXISTS "WeddingPassCredential" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "passKeyId" TEXT NOT NULL,
    "weddingShortId" TEXT NOT NULL,
    "passSerial" TEXT NOT NULL,
    "issueSeq" INTEGER NOT NULL DEFAULT 1,
    "tokenVersion" TEXT NOT NULL DEFAULT 'WW2',
    "eventBitmask" INTEGER NOT NULL DEFAULT 4,
    "nonce" TEXT NOT NULL,
    "signatureHex" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeddingPassCredential_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WeddingPassCredential_issueSeq_positive" CHECK ("issueSeq" >= 1)
);

-- CreateTable WeddingCheckIn
CREATE TABLE IF NOT EXISTS "WeddingCheckIn" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "admittedByUserId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT 'wedding-day',
    "attendeeKey" TEXT NOT NULL,
    "attendeeKind" TEXT NOT NULL DEFAULT 'primary',
    "attendeeName" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'qr',
    "deviceId" TEXT,
    "clientEventId" TEXT,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeddingCheckIn_pkey" PRIMARY KEY ("id")
);

-- Indexes for WeddingPassKey
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingPassKey_weddingId_keyId_key"
    ON "WeddingPassKey"("weddingId", "keyId");
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingPassKey_id_weddingId_key"
    ON "WeddingPassKey"("id", "weddingId");
CREATE INDEX IF NOT EXISTS "WeddingPassKey_weddingId_status_idx"
    ON "WeddingPassKey"("weddingId", "status");

-- Indexes for WeddingPassCredential
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingPassCredential_token_key"
    ON "WeddingPassCredential"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingPassCredential_weddingId_passSerial_key"
    ON "WeddingPassCredential"("weddingId", "passSerial");
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingPassCredential_id_weddingId_key"
    ON "WeddingPassCredential"("id", "weddingId");
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingPassCredential_id_weddingId_guestId_key"
    ON "WeddingPassCredential"("id", "weddingId", "guestId");
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingPassCredential_weddingId_guestId_issueSeq_key"
    ON "WeddingPassCredential"("weddingId", "guestId", "issueSeq");
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingPassCredential_weddingId_guestId_live_key"
    ON "WeddingPassCredential"("weddingId", "guestId")
    WHERE "revokedAt" IS NULL AND "supersededAt" IS NULL;
CREATE INDEX IF NOT EXISTS "WeddingPassCredential_weddingId_guestId_revokedAt_idx"
    ON "WeddingPassCredential"("weddingId", "guestId", "revokedAt");
CREATE INDEX IF NOT EXISTS "WeddingPassCredential_passKeyId_weddingId_idx"
    ON "WeddingPassCredential"("passKeyId", "weddingId");

-- Indexes for WeddingCheckIn
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingCheckIn_weddingId_eventKey_guestId_attendeeKey_key"
    ON "WeddingCheckIn"("weddingId", "eventKey", "guestId", "attendeeKey");
CREATE UNIQUE INDEX IF NOT EXISTS "WeddingCheckIn_weddingId_clientEventId_key"
    ON "WeddingCheckIn"("weddingId", "clientEventId");
CREATE INDEX IF NOT EXISTS "WeddingCheckIn_weddingId_eventKey_admittedAt_idx"
    ON "WeddingCheckIn"("weddingId", "eventKey", "admittedAt");
CREATE INDEX IF NOT EXISTS "WeddingCheckIn_guestId_weddingId_idx"
    ON "WeddingCheckIn"("guestId", "weddingId");
CREATE INDEX IF NOT EXISTS "WeddingCheckIn_gateId_weddingId_idx"
    ON "WeddingCheckIn"("gateId", "weddingId");
CREATE INDEX IF NOT EXISTS "WeddingCheckIn_admittedByUserId_idx"
    ON "WeddingCheckIn"("admittedByUserId");

-- Foreign Keys: WeddingPassKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeddingPassKey_weddingId_fkey') THEN
    ALTER TABLE "WeddingPassKey" ADD CONSTRAINT "WeddingPassKey_weddingId_fkey"
      FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Foreign Keys: WeddingPassCredential
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeddingPassCredential_weddingId_fkey') THEN
    ALTER TABLE "WeddingPassCredential" ADD CONSTRAINT "WeddingPassCredential_weddingId_fkey"
      FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeddingPassCredential_guestId_weddingId_fkey') THEN
    ALTER TABLE "WeddingPassCredential" ADD CONSTRAINT "WeddingPassCredential_guestId_weddingId_fkey"
      FOREIGN KEY ("guestId", "weddingId") REFERENCES "Guest"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeddingPassCredential_passKeyId_weddingId_fkey') THEN
    ALTER TABLE "WeddingPassCredential" ADD CONSTRAINT "WeddingPassCredential_passKeyId_weddingId_fkey"
      FOREIGN KEY ("passKeyId", "weddingId") REFERENCES "WeddingPassKey"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Foreign Keys: WeddingCheckIn
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeddingCheckIn_weddingId_fkey') THEN
    ALTER TABLE "WeddingCheckIn" ADD CONSTRAINT "WeddingCheckIn_weddingId_fkey"
      FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeddingCheckIn_guestId_weddingId_fkey') THEN
    ALTER TABLE "WeddingCheckIn" ADD CONSTRAINT "WeddingCheckIn_guestId_weddingId_fkey"
      FOREIGN KEY ("guestId", "weddingId") REFERENCES "Guest"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeddingCheckIn_credentialId_weddingId_guestId_fkey') THEN
    ALTER TABLE "WeddingCheckIn" ADD CONSTRAINT "WeddingCheckIn_credentialId_weddingId_guestId_fkey"
      FOREIGN KEY ("credentialId", "weddingId", "guestId") REFERENCES "WeddingPassCredential"("id", "weddingId", "guestId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeddingCheckIn_gateId_weddingId_fkey') THEN
    ALTER TABLE "WeddingCheckIn" ADD CONSTRAINT "WeddingCheckIn_gateId_weddingId_fkey"
      FOREIGN KEY ("gateId", "weddingId") REFERENCES "WeddingGate"("id", "weddingId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeddingCheckIn_admittedByUserId_fkey') THEN
    ALTER TABLE "WeddingCheckIn" ADD CONSTRAINT "WeddingCheckIn_admittedByUserId_fkey"
      FOREIGN KEY ("admittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Row Level Security & Privilege hardening
ALTER TABLE "WeddingPassKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeddingPassCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeddingCheckIn" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "WeddingPassKey", "WeddingPassCredential", "WeddingCheckIn" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "WeddingPassKey", "WeddingPassCredential", "WeddingCheckIn" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "WeddingPassKey", "WeddingPassCredential", "WeddingCheckIn" FROM authenticated;
  END IF;
END $$;
