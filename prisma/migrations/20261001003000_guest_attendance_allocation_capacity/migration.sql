ALTER TABLE "Guest"
  ADD COLUMN "attendanceAllocation" TEXT NOT NULL DEFAULT 'shared';

ALTER TABLE "Guest"
  ADD CONSTRAINT "Guest_attendanceAllocation_check"
  CHECK ("attendanceAllocation" IN ('bride', 'groom', 'shared', 'operational'));

CREATE INDEX "Guest_weddingId_attendanceAllocation_idx"
  ON "Guest"("weddingId", "attendanceAllocation");

CREATE TABLE "WeddingAttendanceAllocationLimit" (
  "id" TEXT NOT NULL,
  "weddingId" TEXT NOT NULL,
  "allocation" TEXT NOT NULL,
  "hardLimit" INTEGER,
  "warningAt" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WeddingAttendanceAllocationLimit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeddingAttendanceAllocationLimit_allocation_check"
    CHECK ("allocation" IN ('bride', 'groom', 'shared', 'operational')),
  CONSTRAINT "WeddingAttendanceAllocationLimit_hardLimit_check"
    CHECK ("hardLimit" IS NULL OR "hardLimit" >= 0),
  CONSTRAINT "WeddingAttendanceAllocationLimit_warningAt_check"
    CHECK ("warningAt" IS NULL OR "warningAt" >= 0),
  CONSTRAINT "WeddingAttendanceAllocationLimit_warning_lte_limit_check"
    CHECK ("hardLimit" IS NULL OR "warningAt" IS NULL OR "warningAt" <= "hardLimit")
);

CREATE UNIQUE INDEX "WeddingAttendanceAllocationLimit_weddingId_allocation_key"
  ON "WeddingAttendanceAllocationLimit"("weddingId", "allocation");

CREATE INDEX "WeddingAttendanceAllocationLimit_weddingId_idx"
  ON "WeddingAttendanceAllocationLimit"("weddingId");

ALTER TABLE "WeddingAttendanceAllocationLimit"
  ADD CONSTRAINT "WeddingAttendanceAllocationLimit_weddingId_fkey"
  FOREIGN KEY ("weddingId")
  REFERENCES "Wedding"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
