-- Private administrator invitation and professional profile records.
-- The table remains server-only in the existing wewed_admin schema.

CREATE SCHEMA IF NOT EXISTS wewed_admin;

CREATE TABLE IF NOT EXISTS wewed_admin."AdministratorProfile" (
  "userId" TEXT NOT NULL,
  "authUserId" UUID,
  "primaryEmail" TEXT NOT NULL,
  "alternateEmails" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "fullName" TEXT NOT NULL,
  "phone" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "stateProvince" TEXT,
  "postalCode" TEXT,
  "country" TEXT,
  "certificates" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "invitationStatus" TEXT NOT NULL DEFAULT 'invited',
  "invitationSentAt" TIMESTAMP(3),
  "invitationAcceptedAt" TIMESTAMP(3),
  "profileCompletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdministratorProfile_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "AdministratorProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdministratorProfile_invitationStatus_check"
    CHECK ("invitationStatus" IN ('invited', 'active', 'suspended', 'revoked')),
  CONSTRAINT "AdministratorProfile_alternateEmails_array_check"
    CHECK (jsonb_typeof("alternateEmails") = 'array'),
  CONSTRAINT "AdministratorProfile_certificates_array_check"
    CHECK (jsonb_typeof("certificates") = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdministratorProfile_authUserId_key"
  ON wewed_admin."AdministratorProfile"("authUserId")
  WHERE "authUserId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AdministratorProfile_primaryEmail_lower_key"
  ON wewed_admin."AdministratorProfile"(lower("primaryEmail"));

CREATE INDEX IF NOT EXISTS "AdministratorProfile_status_idx"
  ON wewed_admin."AdministratorProfile"("invitationStatus", "updatedAt");

REVOKE ALL PRIVILEGES ON TABLE wewed_admin."AdministratorProfile" FROM PUBLIC;

DO $wewed_admin_profile_roles$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE wewed_admin.%I FROM %I',
        'AdministratorProfile',
        role_name
      );
    END IF;
  END LOOP;
END
$wewed_admin_profile_roles$;
