-- Wedding Day isolated-domain extension.
-- IMPORTANT: apply only to the isolated Wedding Day database during this phase.
-- This migration intentionally references the existing Wedding, Guest, Vendor and
-- ServiceEngagement records rather than creating parallel identity/domain tables.

CREATE TABLE "WeddingPassKey" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingPassKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeddingPassCredential" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "passKeyId" TEXT NOT NULL,
    "weddingShortId" TEXT NOT NULL,
    "passSerial" TEXT NOT NULL,
    "tokenVersion" TEXT NOT NULL DEFAULT 'WW2',
    "eventBitmask" INTEGER NOT NULL,
    "nonce" TEXT NOT NULL,
    "signatureHex" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingPassCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeddingCheckIn" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "credentialId" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT 'wedding-day',
    "attendeeKey" TEXT NOT NULL,
    "attendeeKind" TEXT NOT NULL DEFAULT 'primary',
    "attendeeName" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'qr',
    "gateId" TEXT,
    "deviceId" TEXT,
    "clientEventId" TEXT,
    "admittedByUserId" TEXT,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeddingAnnouncement" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "metadata" JSONB,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeddingServicePresence" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceEngagementId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "changedByUserId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingServicePresence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeddingPassKey_weddingId_keyId_key"
    ON "WeddingPassKey"("weddingId", "keyId");
CREATE INDEX "WeddingPassKey_weddingId_status_idx"
    ON "WeddingPassKey"("weddingId", "status");

CREATE UNIQUE INDEX "WeddingPassCredential_token_key"
    ON "WeddingPassCredential"("token");
CREATE UNIQUE INDEX "WeddingPassCredential_weddingId_passSerial_key"
    ON "WeddingPassCredential"("weddingId", "passSerial");
CREATE INDEX "WeddingPassCredential_weddingId_guestId_revokedAt_idx"
    ON "WeddingPassCredential"("weddingId", "guestId", "revokedAt");
CREATE INDEX "WeddingPassCredential_passKeyId_idx"
    ON "WeddingPassCredential"("passKeyId");

CREATE UNIQUE INDEX "WeddingCheckIn_weddingId_eventKey_guestId_attendeeKey_key"
    ON "WeddingCheckIn"("weddingId", "eventKey", "guestId", "attendeeKey");
CREATE UNIQUE INDEX "WeddingCheckIn_weddingId_clientEventId_key"
    ON "WeddingCheckIn"("weddingId", "clientEventId");
CREATE INDEX "WeddingCheckIn_weddingId_eventKey_admittedAt_idx"
    ON "WeddingCheckIn"("weddingId", "eventKey", "admittedAt");
CREATE INDEX "WeddingCheckIn_guestId_idx" ON "WeddingCheckIn"("guestId");
CREATE INDEX "WeddingCheckIn_credentialId_idx" ON "WeddingCheckIn"("credentialId");

CREATE INDEX "WeddingAnnouncement_weddingId_status_publishedAt_idx"
    ON "WeddingAnnouncement"("weddingId", "status", "publishedAt" DESC);
CREATE INDEX "WeddingAnnouncement_weddingId_expiresAt_idx"
    ON "WeddingAnnouncement"("weddingId", "expiresAt");

CREATE UNIQUE INDEX "WeddingServicePresence_weddingId_serviceEngagementId_key"
    ON "WeddingServicePresence"("weddingId", "serviceEngagementId");
CREATE INDEX "WeddingServicePresence_weddingId_state_idx"
    ON "WeddingServicePresence"("weddingId", "state");
CREATE INDEX "WeddingServicePresence_vendorId_weddingId_idx"
    ON "WeddingServicePresence"("vendorId", "weddingId");

ALTER TABLE "WeddingPassKey"
    ADD CONSTRAINT "WeddingPassKey_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeddingPassCredential"
    ADD CONSTRAINT "WeddingPassCredential_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeddingPassCredential"
    ADD CONSTRAINT "WeddingPassCredential_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeddingPassCredential"
    ADD CONSTRAINT "WeddingPassCredential_passKeyId_fkey"
    FOREIGN KEY ("passKeyId") REFERENCES "WeddingPassKey"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WeddingCheckIn"
    ADD CONSTRAINT "WeddingCheckIn_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeddingCheckIn"
    ADD CONSTRAINT "WeddingCheckIn_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeddingCheckIn"
    ADD CONSTRAINT "WeddingCheckIn_credentialId_fkey"
    FOREIGN KEY ("credentialId") REFERENCES "WeddingPassCredential"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WeddingAnnouncement"
    ADD CONSTRAINT "WeddingAnnouncement_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeddingServicePresence"
    ADD CONSTRAINT "WeddingServicePresence_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeddingServicePresence"
    ADD CONSTRAINT "WeddingServicePresence_vendorId_weddingId_fkey"
    FOREIGN KEY ("vendorId", "weddingId") REFERENCES "Vendor"("id", "weddingId")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeddingServicePresence"
    ADD CONSTRAINT "WeddingServicePresence_serviceEngagementId_weddingId_fkey"
    FOREIGN KEY ("serviceEngagementId", "weddingId") REFERENCES "ServiceEngagement"("id", "weddingId")
    ON DELETE CASCADE ON UPDATE CASCADE;
