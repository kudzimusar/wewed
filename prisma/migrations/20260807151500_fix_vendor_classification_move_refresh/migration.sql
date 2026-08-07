-- Phase 7 review closure: when a provider offering moves between business accounts,
-- both the source and destination system-derived vendor classifications must be refreshed.
-- This is a follow-up migration because the original Admin taxonomy migration has already
-- been applied to production and its migration history must remain immutable.

CREATE OR REPLACE FUNCTION wewed_admin.refresh_system_vendor_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = wewed_admin, public
AS $function$
DECLARE
  target_business_account_ids TEXT[];
  target_business_account_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_business_account_ids := ARRAY[OLD."businessAccountId"];
  ELSIF TG_OP = 'UPDATE'
        AND OLD."businessAccountId" IS DISTINCT FROM NEW."businessAccountId" THEN
    target_business_account_ids := ARRAY[
      OLD."businessAccountId",
      NEW."businessAccountId"
    ];
  ELSE
    target_business_account_ids := ARRAY[NEW."businessAccountId"];
  END IF;

  FOREACH target_business_account_id IN ARRAY target_business_account_ids
  LOOP
    UPDATE wewed_admin."BusinessAccountClassification" classification
    SET "subtypeKey" = wewed_admin.default_business_account_subtype(
          classification."businessAccountId", classification."accountType"
        ),
        version = classification.version + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE classification."businessAccountId" = target_business_account_id
      AND classification."accountType"='vendor'
      AND classification.source='system';
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
