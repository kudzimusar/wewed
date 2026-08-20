-- Web/PWA push device registration. Delivery remains optional; in-app notifications stay canonical.

CREATE TABLE IF NOT EXISTS public."PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "expirationTime" BIGINT,
  "userAgent" TEXT,
  "disabledAt" TIMESTAMPTZ,
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PushSubscription_endpoint_unique" UNIQUE ("endpoint")
);

CREATE INDEX IF NOT EXISTS "PushSubscription_user_active_idx"
  ON public."PushSubscription" ("userId", "disabledAt", "lastSeenAt" DESC);
