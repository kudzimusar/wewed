CREATE TABLE private."PhysicalInvitationInstallHandoff" (
  "id" TEXT PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "destinationId" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "card" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3)
);

CREATE INDEX "PhysicalInvitationInstallHandoff_destinationId_createdAt_idx"
  ON private."PhysicalInvitationInstallHandoff" ("destinationId", "createdAt");
CREATE INDEX "PhysicalInvitationInstallHandoff_weddingId_createdAt_idx"
  ON private."PhysicalInvitationInstallHandoff" ("weddingId", "createdAt");
CREATE INDEX "PhysicalInvitationInstallHandoff_expiresAt_idx"
  ON private."PhysicalInvitationInstallHandoff" ("expiresAt");
