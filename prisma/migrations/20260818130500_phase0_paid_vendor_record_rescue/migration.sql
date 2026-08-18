-- Phase 0 — Paid Vendor Record Rescue
-- Additive only: existing Vendor/Budget data remains authoritative and untouched.
-- Historical engagements are record-only in this phase. No contract acceptance/effective
-- timestamps exist in this schema, so past payments cannot be converted into fabricated
-- Wewed contract history.

CREATE UNIQUE INDEX "Vendor_id_weddingId_key"
ON public."Vendor"("id", "weddingId");

CREATE UNIQUE INDEX "BudgetItem_id_weddingId_key"
ON public."BudgetItem"("id", "weddingId");

CREATE TABLE public."ServiceEngagement" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'historical',
    "recordMode" TEXT NOT NULL DEFAULT 'record_only',
    "serviceCategory" TEXT NOT NULL,
    "serviceDescription" TEXT,
    "agreedAmount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "serviceDate" TIMESTAMP(3),
    "serviceLocation" TEXT,
    "externalAgreementStatus" TEXT NOT NULL DEFAULT 'unknown',
    "externalAgreementReference" TEXT,
    "historicalBasis" TEXT,
    "recordedById" TEXT,
    "weddingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEngagement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceEngagement_phase0_origin_check" CHECK ("origin" = 'historical'),
    CONSTRAINT "ServiceEngagement_phase0_record_mode_check" CHECK ("recordMode" = 'record_only'),
    CONSTRAINT "ServiceEngagement_external_agreement_check" CHECK ("externalAgreementStatus" IN ('unknown', 'exists', 'none')),
    CONSTRAINT "ServiceEngagement_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "ServiceEngagement_agreed_amount_check" CHECK ("agreedAmount" IS NULL OR "agreedAmount" >= 0)
);

CREATE UNIQUE INDEX "ServiceEngagement_id_weddingId_key"
ON public."ServiceEngagement"("id", "weddingId");

CREATE INDEX "ServiceEngagement_weddingId_origin_idx"
ON public."ServiceEngagement"("weddingId", "origin");

CREATE INDEX "ServiceEngagement_vendorId_weddingId_idx"
ON public."ServiceEngagement"("vendorId", "weddingId");

CREATE INDEX "ServiceEngagement_serviceDate_idx"
ON public."ServiceEngagement"("serviceDate");

CREATE TABLE public."EngagementPayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paidAt" TIMESTAMP(3),
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "serviceEngagementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngagementPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EngagementPayment_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "EngagementPayment_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE INDEX "EngagementPayment_serviceEngagementId_paidAt_idx"
ON public."EngagementPayment"("serviceEngagementId", "paidAt");

CREATE INDEX "EngagementPayment_reference_idx"
ON public."EngagementPayment"("reference");

CREATE TABLE public."VaultObject" (
    "id" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT,
    "byteSize" BIGINT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "uploaderActorId" TEXT,
    "uploadSource" TEXT NOT NULL,
    "storageState" TEXT NOT NULL DEFAULT 'registered',
    "scanState" TEXT NOT NULL DEFAULT 'pending',
    "retentionClass" TEXT NOT NULL DEFAULT 'wedding_record',
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "sensitivity" TEXT NOT NULL DEFAULT 'private',
    "publicationState" TEXT NOT NULL DEFAULT 'private',
    "metadata" TEXT,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultObject_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VaultObject_byte_size_check" CHECK ("byteSize" >= 0),
    CONSTRAINT "VaultObject_checksum_check" CHECK ("checksumSha256" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "VaultObject_objectKey_key"
ON public."VaultObject"("objectKey");

CREATE UNIQUE INDEX "VaultObject_id_weddingId_key"
ON public."VaultObject"("id", "weddingId");

CREATE INDEX "VaultObject_weddingId_createdAt_idx"
ON public."VaultObject"("weddingId", "createdAt");

CREATE INDEX "VaultObject_checksumSha256_idx"
ON public."VaultObject"("checksumSha256");

CREATE INDEX "VaultObject_storageState_scanState_idx"
ON public."VaultObject"("storageState", "scanState");

CREATE TABLE public."VaultLink" (
    "id" TEXT NOT NULL,
    "vaultObjectId" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "linkRole" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VaultLink_vaultObjectId_entityType_entityId_linkRole_key"
ON public."VaultLink"("vaultObjectId", "entityType", "entityId", "linkRole");

CREATE INDEX "VaultLink_weddingId_entityType_entityId_idx"
ON public."VaultLink"("weddingId", "entityType", "entityId");

CREATE INDEX "VaultLink_entityType_entityId_idx"
ON public."VaultLink"("entityType", "entityId");

ALTER TABLE public."BudgetItem"
ADD COLUMN "serviceEngagementId" TEXT;

CREATE INDEX "BudgetItem_serviceEngagementId_idx"
ON public."BudgetItem"("serviceEngagementId");

ALTER TABLE public."ServiceEngagement"
ADD CONSTRAINT "ServiceEngagement_weddingId_fkey"
FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."ServiceEngagement"
ADD CONSTRAINT "ServiceEngagement_vendorId_weddingId_fkey"
FOREIGN KEY ("vendorId", "weddingId") REFERENCES public."Vendor"("id", "weddingId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."EngagementPayment"
ADD CONSTRAINT "EngagementPayment_serviceEngagementId_fkey"
FOREIGN KEY ("serviceEngagementId") REFERENCES public."ServiceEngagement"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."VaultObject"
ADD CONSTRAINT "VaultObject_weddingId_fkey"
FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."VaultLink"
ADD CONSTRAINT "VaultLink_vaultObjectId_weddingId_fkey"
FOREIGN KEY ("vaultObjectId", "weddingId") REFERENCES public."VaultObject"("id", "weddingId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."BudgetItem"
ADD CONSTRAINT "BudgetItem_serviceEngagementId_weddingId_fkey"
FOREIGN KEY ("serviceEngagementId", "weddingId") REFERENCES public."ServiceEngagement"("id", "weddingId")
ON DELETE RESTRICT ON UPDATE CASCADE;
