-- Wewed system-wide notifications/reminders foundation.
-- Additive by design: the existing planner RSVP reminder ContentRevision flow remains untouched.

CREATE TABLE IF NOT EXISTS public."Notification" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "weddingId" TEXT,
  "actorUserId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "eventType" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'normal',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "metadata" JSONB,
  "deepLink" TEXT,
  "actionType" TEXT,
  "requiresAction" BOOLEAN NOT NULL DEFAULT FALSE,
  "state" TEXT NOT NULL DEFAULT 'active',
  "readAt" TIMESTAMPTZ,
  "acknowledgedAt" TIMESTAMPTZ,
  "resolvedAt" TIMESTAMPTZ,
  "scheduledFor" TIMESTAMPTZ,
  "snoozedUntil" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_category_check" CHECK ("category" IN (
    'task','budget','payment','vendor','engagement','contract','rsvp','guest',
    'programme','wedding','message','communication','contribution','admin','system'
  )),
  CONSTRAINT "Notification_severity_check" CHECK ("severity" IN (
    'info','normal','important','action_required','urgent'
  )),
  CONSTRAINT "Notification_state_check" CHECK ("state" IN (
    'scheduled','queued','active','read','acknowledged','resolved','dismissed',
    'cancelled','expired','failed'
  )),
  CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId")
    REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_weddingId_fkey" FOREIGN KEY ("weddingId")
    REFERENCES public."Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_actorUserId_fkey" FOREIGN KEY ("actorUserId")
    REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_recipient_dedupe_unique"
  ON public."Notification" ("recipientUserId", "dedupeKey")
  WHERE "dedupeKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Notification_recipient_state_created_idx"
  ON public."Notification" ("recipientUserId", "state", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_recipient_read_created_idx"
  ON public."Notification" ("recipientUserId", "readAt", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_wedding_category_idx"
  ON public."Notification" ("weddingId", "category", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_scheduled_idx"
  ON public."Notification" ("state", "scheduledFor")
  WHERE "scheduledFor" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Notification_snoozed_idx"
  ON public."Notification" ("state", "snoozedUntil")
  WHERE "snoozedUntil" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Notification_source_idx"
  ON public."Notification" ("sourceType", "sourceId");

CREATE TABLE IF NOT EXISTS public."Reminder" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "weddingId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "triggerAt" TIMESTAMPTZ NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "state" TEXT NOT NULL DEFAULT 'scheduled',
  "deliveryPolicy" JSONB,
  "dedupeKey" TEXT,
  "generatedNotificationId" TEXT,
  "snoozedFromReminderId" TEXT,
  "triggeredAt" TIMESTAMPTZ,
  "cancelledAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Reminder_state_check" CHECK ("state" IN (
    'scheduled','triggered','snoozed','cancelled','completed','failed'
  )),
  CONSTRAINT "Reminder_ownerUserId_fkey" FOREIGN KEY ("ownerUserId")
    REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Reminder_recipientUserId_fkey" FOREIGN KEY ("recipientUserId")
    REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Reminder_weddingId_fkey" FOREIGN KEY ("weddingId")
    REFERENCES public."Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Reminder_generatedNotificationId_fkey" FOREIGN KEY ("generatedNotificationId")
    REFERENCES public."Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Reminder_snoozedFromReminderId_fkey" FOREIGN KEY ("snoozedFromReminderId")
    REFERENCES public."Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Reminder_recipient_dedupe_unique"
  ON public."Reminder" ("recipientUserId", "dedupeKey")
  WHERE "dedupeKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Reminder_schedule_idx"
  ON public."Reminder" ("state", "triggerAt");
CREATE INDEX IF NOT EXISTS "Reminder_recipient_schedule_idx"
  ON public."Reminder" ("recipientUserId", "state", "triggerAt");
CREATE INDEX IF NOT EXISTS "Reminder_wedding_schedule_idx"
  ON public."Reminder" ("weddingId", "state", "triggerAt");
CREATE INDEX IF NOT EXISTS "Reminder_source_idx"
  ON public."Reminder" ("sourceType", "sourceId");

CREATE TABLE IF NOT EXISTS public."NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL DEFAULT 'global',
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "whatsAppEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "quietStart" TEXT,
  "quietEnd" TEXT,
  "digestMode" TEXT NOT NULL DEFAULT 'none',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_digestMode_check" CHECK ("digestMode" IN ('none','daily','weekly')),
  CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES public."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationPreference_user_scope_unique" UNIQUE ("userId", "scopeKey")
);

CREATE INDEX IF NOT EXISTS "NotificationPreference_user_idx"
  ON public."NotificationPreference" ("userId");

CREATE TABLE IF NOT EXISTS public."NotificationDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'queued',
  "providerRef" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attemptedAt" TIMESTAMPTZ,
  "sentAt" TIMESTAMPTZ,
  "deliveredAt" TIMESTAMPTZ,
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDeliveryAttempt_channel_check" CHECK ("channel" IN ('in_app','push','email','whatsapp')),
  CONSTRAINT "NotificationDeliveryAttempt_state_check" CHECK ("state" IN ('queued','sent','delivered','read','failed','cancelled')),
  CONSTRAINT "NotificationDeliveryAttempt_notificationId_fkey" FOREIGN KEY ("notificationId")
    REFERENCES public."Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_notification_idx"
  ON public."NotificationDeliveryAttempt" ("notificationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "NotificationDeliveryAttempt_channel_state_idx"
  ON public."NotificationDeliveryAttempt" ("channel", "state", "createdAt");
