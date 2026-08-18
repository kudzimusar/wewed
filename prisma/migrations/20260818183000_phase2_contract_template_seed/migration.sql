-- Phase 2 — operator-reviewed Wewed contract template starter library.
-- These templates intentionally remain internal_review/operator_review. They do not claim
-- jurisdiction-specific legal enforceability or counsel approval.

INSERT INTO public."ContractClause" (
  "id", "code", "version", "title", "clauseFamily", "body", "status", "reviewStatus", "contentHash"
) VALUES
  ('wewed-clause-scope-v1', 'WW_SCOPE_1', '1.0.0', 'Service scope', 'scope',
   'The service provider will deliver the service scope, date, location, deliverables, and other service facts recorded in the issued Wewed contract version. Material scope changes require a new governed contract version.',
   'internal_review', 'operator_review', '032a1e03b1cb4196fcfd013cff477427b8b916196a0b9469eb1d9b69be67576d'),
  ('wewed-clause-fees-v1', 'WW_FEES_1', '1.0.0', 'Fees and payment record', 'payments',
   'The client and service provider will follow the fees, currency, and payment facts recorded in the service engagement. Wewed records and reconciles payment information but is not the merchant, escrow provider, guarantor, or service provider unless an agreement expressly states otherwise.',
   'internal_review', 'operator_review', '89fa3615e89745ce9689bcbeaabdc805686f6f38a05e9f125701328e23cd4d26'),
  ('wewed-clause-changes-v1', 'WW_CHANGES_1', '1.0.0', 'Changes and version control', 'changes',
   'An issued contract version is not edited in place. A material change to scope, price, date, cancellation terms, obligations, payment terms, or remedies must be recorded through a new governed version or amendment process.',
   'internal_review', 'operator_review', '39d4b083c57493f7527a9d8e4c8dc2bb3cd866f2be13c56665ad9335f21fc11b'),
  ('wewed-clause-cancellation-v1', 'WW_CANCELLATION_1', '1.0.0', 'Cancellation and remedies', 'cancellation',
   'Cancellation, rescheduling, refunds, credits, and service remedies are governed by the terms actually recorded in the applicable contract version and any later governed amendment, together with applicable law.',
   'internal_review', 'operator_review', 'b18ae294e64889245e7be7c7c02bacc248b0549eb6b8a9a63e998e0b205c284f'),
  ('wewed-clause-communications-v1', 'WW_COMMUNICATIONS_1', '1.0.0', 'Communications and notices', 'communications',
   'Wewed may deliver notices and review links through in-app messaging and supported external channels. The authoritative contract record is the exact version stored and verified through Wewed.',
   'internal_review', 'operator_review', '11145ff44cf5179a61f7bddff47c1a469e37e19f42a0e586705bb293df8e92ba'),
  ('wewed-clause-evidence-v1', 'WW_EVIDENCE_1', '1.0.0', 'Documents and evidence', 'evidence',
   'Documents, payment proof, messages, and other records linked to this service engagement may be retained in the private Wewed Vault subject to authorized access, retention controls, and applicable Wewed policies.',
   'internal_review', 'operator_review', '5a6165efdee387b4f9fad0965c8f6a2a6bb83c0b3b4141cd10968fb7789379e4'),
  ('wewed-clause-platform-role-v1', 'WW_PLATFORM_ROLE_1', '1.0.0', 'Wewed platform role', 'platform_role',
   'Wewed provides the planning, recordkeeping, document, and communication platform and standardizes this agreement format. Wewed is not automatically a commercial party to the vendor service, merchant of record, guarantor, or adjudicator unless the contract expressly identifies Wewed in that role.',
   'internal_review', 'operator_review', '306f5faf8275f86b649bd625412948351df50538a48c919d0a3c574326239156'),
  ('wewed-clause-disputes-v1', 'WW_DISPUTES_1', '1.0.0', 'Dispute record', 'disputes',
   'If a dispute arises, the parties should preserve relevant records and use the agreed resolution process. Wewed may support evidence organization and platform administration but does not automatically determine liability or impose a remedy.',
   'internal_review', 'operator_review', '753a1b72efb3282a8aaf2b085827dd31e88f38ec5797463675233d575d05ad8f')
ON CONFLICT ("code", "version") DO NOTHING;

INSERT INTO public."ContractTemplate" (
  "id", "code", "title", "serviceCategory", "marketCode", "language", "semanticVersion",
  "status", "reviewStatus", "summary", "templateHash", "metadata"
) VALUES
  ('wewed-template-venue-v1', 'WEWED_VENUE', 'Wewed Standard Venue Agreement', 'venue', 'GLOBAL', 'en', '1.0.0', 'internal_review', 'operator_review', 'Operator-reviewed starter template for venue service engagements.', '611f49fb6d6d34fd675cf39eb8bc5d52d4f1274527a9c368b417c0506d33bc3b', '{"legalReviewClaim":false,"phase":2}'),
  ('wewed-template-catering-v1', 'WEWED_CATERING', 'Wewed Standard Catering Agreement', 'caterer', 'GLOBAL', 'en', '1.0.0', 'internal_review', 'operator_review', 'Operator-reviewed starter template for catering service engagements.', 'a9eab69821748512a6df6543236c9aac850d1f6c4496f6c03abfca89e7d67609', '{"legalReviewClaim":false,"phase":2}'),
  ('wewed-template-photography-v1', 'WEWED_PHOTOGRAPHY', 'Wewed Standard Photography Agreement', 'photographer', 'GLOBAL', 'en', '1.0.0', 'internal_review', 'operator_review', 'Operator-reviewed starter template for photography service engagements.', 'b747b855e0b963d3eb5075e954f8bf3c29fdd4cc80f2a9a132a9caaa73fdccc3', '{"legalReviewClaim":false,"phase":2}'),
  ('wewed-template-videography-v1', 'WEWED_VIDEOGRAPHY', 'Wewed Standard Videography Agreement', 'videographer', 'GLOBAL', 'en', '1.0.0', 'internal_review', 'operator_review', 'Operator-reviewed starter template for videography service engagements.', 'f484f0be49b231340c1978cc6f598550babcdbbe9ae8e19166a1339075fb562a', '{"legalReviewClaim":false,"phase":2}'),
  ('wewed-template-floral-v1', 'WEWED_FLORAL', 'Wewed Standard Florist Agreement', 'florist', 'GLOBAL', 'en', '1.0.0', 'internal_review', 'operator_review', 'Operator-reviewed starter template for floral service engagements.', 'c66c882b1a56ccf7b37ed4890cdd2914ab2addbc2403e93c9d2e78260f9d4d1e', '{"legalReviewClaim":false,"phase":2}'),
  ('wewed-template-entertainment-v1', 'WEWED_ENTERTAINMENT', 'Wewed Standard DJ & Entertainment Agreement', 'dj', 'GLOBAL', 'en', '1.0.0', 'internal_review', 'operator_review', 'Operator-reviewed starter template for entertainment service engagements.', 'a543f822718cf081ce1827997c1249adda3c8f3d90e37cf7898230f611ecb076', '{"legalReviewClaim":false,"phase":2}'),
  ('wewed-template-decor-v1', 'WEWED_DECOR', 'Wewed Standard Decor & Styling Agreement', 'decor', 'GLOBAL', 'en', '1.0.0', 'internal_review', 'operator_review', 'Operator-reviewed starter template for decor service engagements.', '4d96181a0bc0941dca759810ebed1d9d42b4e14eee5b32b59ae78c84705da9c0', '{"legalReviewClaim":false,"phase":2}'),
  ('wewed-template-transport-v1', 'WEWED_TRANSPORT', 'Wewed Standard Transport Agreement', 'transport', 'GLOBAL', 'en', '1.0.0', 'internal_review', 'operator_review', 'Operator-reviewed starter template for transport service engagements.', '696790768bf368423f203f126a78f25aafb57005bb890807a0b84c2f1caddf6c', '{"legalReviewClaim":false,"phase":2}'),
  ('wewed-template-stationery-v1', 'WEWED_STATIONERY', 'Wewed Standard Stationery & Printing Agreement', 'stationery', 'GLOBAL', 'en', '1.0.0', 'internal_review', 'operator_review', 'Operator-reviewed starter template for stationery service engagements.', '412975ab86ea07a28ec4437c5f8826c634119da3b954b0e7051b5b692d14cd56', '{"legalReviewClaim":false,"phase":2}'),
  ('wewed-template-standard-service-v1', 'WEWED_STANDARD_SERVICE', 'Wewed Standard Service Agreement', 'other', 'GLOBAL', 'en', '1.0.0', 'internal_review', 'operator_review', 'Operator-reviewed fallback starter template for wedding service engagements.', '2ba824c229fd81fc1bce3657b1c54ac3aa9ed26ada6311279487a052721fce8e', '{"legalReviewClaim":false,"phase":2}')
ON CONFLICT ("code", "semanticVersion", "marketCode") DO NOTHING;

INSERT INTO public."ContractTemplateClause" (
  "id", "templateId", "clauseId", "position", "required"
)
SELECT
  'wewed-template-clause-' || replace(t."id", 'wewed-template-', '') || '-' || c.position::text,
  t."id",
  c."id",
  c.position,
  true
FROM public."ContractTemplate" t
CROSS JOIN (
  VALUES
    ('wewed-clause-scope-v1', 10),
    ('wewed-clause-fees-v1', 20),
    ('wewed-clause-changes-v1', 30),
    ('wewed-clause-cancellation-v1', 40),
    ('wewed-clause-communications-v1', 50),
    ('wewed-clause-evidence-v1', 60),
    ('wewed-clause-platform-role-v1', 70),
    ('wewed-clause-disputes-v1', 80)
) AS c("id", position)
WHERE t."id" IN (
  'wewed-template-venue-v1', 'wewed-template-catering-v1', 'wewed-template-photography-v1',
  'wewed-template-videography-v1', 'wewed-template-floral-v1', 'wewed-template-entertainment-v1',
  'wewed-template-decor-v1', 'wewed-template-transport-v1', 'wewed-template-stationery-v1',
  'wewed-template-standard-service-v1'
)
ON CONFLICT ("templateId", "clauseId") DO NOTHING;
