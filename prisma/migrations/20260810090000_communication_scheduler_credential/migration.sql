CREATE TABLE IF NOT EXISTS wewed_communications."CommunicationSchedulerCredential" (
  "id" text PRIMARY KEY,
  "secretHash" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CommunicationSchedulerCredential_secretHash_check"
    CHECK ("secretHash" ~ '^[a-f0-9]{64}$')
);

REVOKE ALL ON TABLE wewed_communications."CommunicationSchedulerCredential" FROM PUBLIC;
