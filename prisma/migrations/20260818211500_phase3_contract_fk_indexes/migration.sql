-- Phase 3 post-release advisor hardening.
-- Add exact covering indexes for the private contract-governance foreign-key paths.

CREATE INDEX "ContractAcceptance_contractId_idx"
  ON wewed_contracts."ContractAcceptance" ("contractId");
CREATE INDEX "ContractAcceptance_requirement_contract_version_party_idx"
  ON wewed_contracts."ContractAcceptance" ("requirementId", "contractId", "contractVersionId", "engagementPartyId");
CREATE INDEX "ContractAcceptance_contractVersion_contract_idx"
  ON wewed_contracts."ContractAcceptance" ("contractVersionId", "contractId");

CREATE INDEX "ContractAmendment_baseVersion_contract_idx"
  ON wewed_contracts."ContractAmendment" ("baseVersionId", "contractId");
CREATE INDEX "ContractAmendment_proposedVersion_contract_idx"
  ON wewed_contracts."ContractAmendment" ("proposedVersionId", "contractId");

CREATE INDEX "ContractPartyRequirement_contractId_idx"
  ON wewed_contracts."ContractPartyRequirement" ("contractId");
CREATE INDEX "ContractPartyRequirement_contractVersion_contract_idx"
  ON wewed_contracts."ContractPartyRequirement" ("contractVersionId", "contractId");

CREATE INDEX "ContractVersionEffectivity_contract_wedding_idx"
  ON wewed_contracts."ContractVersionEffectivity" ("contractId", "weddingId");
CREATE INDEX "ContractVersionEffectivity_contractVersion_contract_idx"
  ON wewed_contracts."ContractVersionEffectivity" ("contractVersionId", "contractId");
