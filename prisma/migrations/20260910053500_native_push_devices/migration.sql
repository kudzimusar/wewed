CREATE TABLE IF NOT EXISTS public."NativePushDevice" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  "expoPushToken" TEXT NOT NULL UNIQUE,
  "deviceId" TEXT,
  "appVersion" TEXT,
  "buildVersion" TEXT,
  "activeWeddingId" TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "NativePushDevice_userId_enabled_idx"
  ON public."NativePushDevice" ("userId", enabled);

CREATE INDEX IF NOT EXISTS "NativePushDevice_activeWeddingId_idx"
  ON public."NativePushDevice" ("activeWeddingId")
  WHERE enabled = TRUE;
