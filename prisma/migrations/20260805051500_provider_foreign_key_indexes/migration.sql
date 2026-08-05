-- Cover provider marketplace foreign keys reported by the Supabase performance advisor.
CREATE INDEX IF NOT EXISTS "ProviderEnquiry_offeringId_idx"
  ON wewed_admin."ProviderEnquiry"("offeringId");
CREATE INDEX IF NOT EXISTS "ProviderEnquiry_coupleBusinessAccountId_idx"
  ON wewed_admin."ProviderEnquiry"("coupleBusinessAccountId");
CREATE INDEX IF NOT EXISTS "ProviderEnquiry_createdByUserId_idx"
  ON wewed_admin."ProviderEnquiry"("createdByUserId");
CREATE INDEX IF NOT EXISTS "ProviderEnquiry_respondedByUserId_idx"
  ON wewed_admin."ProviderEnquiry"("respondedByUserId");
CREATE INDEX IF NOT EXISTS "ProviderVerification_reviewedByUserId_idx"
  ON wewed_admin."ProviderVerification"("reviewedByUserId");
