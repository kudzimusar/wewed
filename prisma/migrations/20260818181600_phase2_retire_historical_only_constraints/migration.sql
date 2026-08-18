-- Phase 2 allows explicitly current, managed Service Engagements while preserving
-- Phase 0's anti-fabrication rules through the broader Phase 2 checks.
ALTER TABLE public."ServiceEngagement"
  DROP CONSTRAINT IF EXISTS "ServiceEngagement_phase0_origin_check",
  DROP CONSTRAINT IF EXISTS "ServiceEngagement_phase0_record_mode_check";
