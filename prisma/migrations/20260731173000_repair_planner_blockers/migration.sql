-- Repair confirmed planner production blockers.
-- Additive only: no existing wedding, guest, RSVP, vendor, or timeline rows are deleted.

-- DEF-PLN-VENDOR-001: the application already reads/writes these normalized fields.
ALTER TABLE public."Vendor"
  ADD COLUMN IF NOT EXISTS "contact" TEXT,
  ADD COLUMN IF NOT EXISTS "contractStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS "planningRating" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- DEF-PLN-TIMELINE-001 / DEF-PLN-TIMELINE-002: normalized editable timeline fields.
ALTER TABLE public."ProgrammeItem"
  ADD COLUMN IF NOT EXISTS "duration" TEXT,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "displayIcon" TEXT;

-- DEF-PLN-WS-GUEST-001: worksheet-only fields that do not belong to the
-- existing public Guest/RSVP contracts are stored in a server-only extension.
-- The active application still uses Guest, RSVP and SeatingTable as the source
-- of truth for their native fields.
CREATE SCHEMA IF NOT EXISTS wewed_planner;

CREATE TABLE IF NOT EXISTS wewed_planner."GuestWorksheetData" (
  "guestId" TEXT PRIMARY KEY,
  "weddingId" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "displayName" TEXT,
  "guestGroup" TEXT,
  "invitationStatus" TEXT NOT NULL DEFAULT 'pending',
  "responseStatus" TEXT NOT NULL DEFAULT 'pending',
  "partySize" INTEGER NOT NULL DEFAULT 1,
  "accessibilityNotes" TEXT,
  "transportDetails" TEXT,
  "accommodationDetails" TEXT,
  "seatAssignment" TEXT,
  "publicNotes" TEXT,
  "privateNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestWorksheetData_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES public."Guest"("id") ON DELETE CASCADE,
  CONSTRAINT "GuestWorksheetData_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES public."Wedding"("id") ON DELETE CASCADE,
  CONSTRAINT "GuestWorksheetData_invitationStatus_check"
    CHECK ("invitationStatus" IN ('pending', 'sent', 'confirmed', 'declined')),
  CONSTRAINT "GuestWorksheetData_responseStatus_check"
    CHECK ("responseStatus" IN ('pending', 'attending', 'declined', 'maybe')),
  CONSTRAINT "GuestWorksheetData_partySize_check"
    CHECK ("partySize" >= 1)
);

CREATE INDEX IF NOT EXISTS "GuestWorksheetData_weddingId_idx"
  ON wewed_planner."GuestWorksheetData"("weddingId");

-- Prevent direct Supabase client access; worksheet data is available only
-- through the authenticated server-side planner APIs.
REVOKE ALL ON SCHEMA wewed_planner FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA wewed_planner FROM PUBLIC;

DO $wewed_guest_worksheet_roles$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA wewed_planner FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA wewed_planner FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA wewed_planner FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA wewed_planner FROM authenticated;
  END IF;
END
$wewed_guest_worksheet_roles$;
