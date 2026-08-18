-- Phase 2 production hardening — cover every new contract-domain foreign key
-- reported by the PostgreSQL/Supabase performance advisor.
-- Additive only: no rows, constraints, or existing indexes are changed.

CREATE INDEX IF NOT EXISTS "EngagementParty_serviceEngagementId_weddingId_idx"
  ON public."EngagementParty" ("serviceEngagementId", "weddingId");

CREATE INDEX IF NOT EXISTS "ContractTemplateClause_clauseId_idx"
  ON public."ContractTemplateClause" ("clauseId");

CREATE INDEX IF NOT EXISTS "Contract_serviceEngagementId_weddingId_idx"
  ON public."Contract" ("serviceEngagementId", "weddingId");

CREATE INDEX IF NOT EXISTS "Contract_templateId_idx"
  ON public."Contract" ("templateId");

CREATE INDEX IF NOT EXISTS "ContractVersion_contractId_weddingId_idx"
  ON public."ContractVersion" ("contractId", "weddingId");

CREATE INDEX IF NOT EXISTS "ContractReviewGrant_contractId_idx"
  ON public."ContractReviewGrant" ("contractId");

CREATE INDEX IF NOT EXISTS "ContractReviewGrant_contractVersionId_contractId_idx"
  ON public."ContractReviewGrant" ("contractVersionId", "contractId");

CREATE INDEX IF NOT EXISTS "ContractReviewGrant_engagementPartyId_idx"
  ON public."ContractReviewGrant" ("engagementPartyId");
