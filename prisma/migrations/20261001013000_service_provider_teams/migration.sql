CREATE TABLE "ServiceTeam" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "serviceCategory" TEXT NOT NULL,
  "allowedCrew" INTEGER NOT NULL DEFAULT 1,
  "rosterStatus" TEXT NOT NULL DEFAULT 'draft',
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "leaderUserId" TEXT,
  "serviceEngagementId" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceTeam_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceTeam_allowedCrew_check" CHECK ("allowedCrew" >= 1),
  CONSTRAINT "ServiceTeam_rosterStatus_check" CHECK ("rosterStatus" IN ('draft', 'submitted', 'approved'))
);

CREATE UNIQUE INDEX "ServiceTeam_id_weddingId_key"
  ON "ServiceTeam"("id", "weddingId");
CREATE UNIQUE INDEX "ServiceTeam_serviceEngagementId_name_key"
  ON "ServiceTeam"("serviceEngagementId", "name");
CREATE INDEX "ServiceTeam_weddingId_rosterStatus_idx"
  ON "ServiceTeam"("weddingId", "rosterStatus");
CREATE INDEX "ServiceTeam_leaderUserId_idx"
  ON "ServiceTeam"("leaderUserId");

ALTER TABLE "ServiceTeam"
  ADD CONSTRAINT "ServiceTeam_weddingId_fkey"
  FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceTeam"
  ADD CONSTRAINT "ServiceTeam_serviceEngagementId_weddingId_fkey"
  FOREIGN KEY ("serviceEngagementId", "weddingId")
  REFERENCES "ServiceEngagement"("id", "weddingId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceTeam"
  ADD CONSTRAINT "ServiceTeam_leaderUserId_fkey"
  FOREIGN KEY ("leaderUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ServiceTeamMember" (
  "id" TEXT NOT NULL,
  "serviceTeamId" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "function" TEXT NOT NULL,
  "isLeader" BOOLEAN NOT NULL DEFAULT FALSE,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceTeamMember_serviceTeamId_guestId_key"
  ON "ServiceTeamMember"("serviceTeamId", "guestId");
CREATE UNIQUE INDEX "ServiceTeamMember_weddingId_guestId_key"
  ON "ServiceTeamMember"("weddingId", "guestId");
CREATE INDEX "ServiceTeamMember_serviceTeamId_approvedAt_idx"
  ON "ServiceTeamMember"("serviceTeamId", "approvedAt");

ALTER TABLE "ServiceTeamMember"
  ADD CONSTRAINT "ServiceTeamMember_serviceTeamId_weddingId_fkey"
  FOREIGN KEY ("serviceTeamId", "weddingId")
  REFERENCES "ServiceTeam"("id", "weddingId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceTeamMember"
  ADD CONSTRAINT "ServiceTeamMember_weddingId_fkey"
  FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceTeamMember"
  ADD CONSTRAINT "ServiceTeamMember_guestId_weddingId_fkey"
  FOREIGN KEY ("guestId", "weddingId")
  REFERENCES "Guest"("id", "weddingId")
  ON DELETE CASCADE ON UPDATE CASCADE;
