-- Wewed Contributions & Resource Accounting
-- Canon: WW-CONTRIBUTIONS-2026-08-19-01
-- Private operational schema; additive only. Existing paid facts are never guessed as couple-funded.

CREATE SCHEMA IF NOT EXISTS wewed_contributions;

CREATE TABLE wewed_contributions.contributors (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES public."Wedding"(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  legal_name TEXT,
  kind TEXT NOT NULL DEFAULT 'individual',
  relationship TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  preferred_contact_method TEXT,
  public_recognition BOOLEAN NOT NULL DEFAULT FALSE,
  anonymous_public BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  guest_id TEXT REFERENCES public."Guest"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contributors_wedding_name_idx ON wewed_contributions.contributors(wedding_id, display_name);
CREATE INDEX contributors_guest_idx ON wewed_contributions.contributors(guest_id);

CREATE TABLE wewed_contributions.campaigns (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES public."Wedding"(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'HONEYMOON',
  title TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC(14,2) CHECK (target_amount IS NULL OR target_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  published BOOLEAN NOT NULL DEFAULT FALSE,
  show_target BOOLEAN NOT NULL DEFAULT FALSE,
  show_raised BOOLEAN NOT NULL DEFAULT FALSE,
  external_url TEXT,
  cta_label TEXT,
  invitation_visible BOOLEAN NOT NULL DEFAULT FALSE,
  publish_from TIMESTAMPTZ,
  publish_until TIMESTAMPTZ,
  public_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX campaigns_wedding_published_idx ON wewed_contributions.campaigns(wedding_id, published);

CREATE TABLE wewed_contributions.wedding_contributions (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES public."Wedding"(id) ON DELETE CASCADE,
  contributor_id TEXT NOT NULL REFERENCES wewed_contributions.contributors(id) ON DELETE RESTRICT,
  campaign_id TEXT REFERENCES wewed_contributions.campaigns(id) ON DELETE SET NULL,
  vendor_id TEXT REFERENCES public."Vendor"(id) ON DELETE SET NULL,
  service_engagement_id TEXT REFERENCES public."ServiceEngagement"(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) CHECK (amount IS NULL OR amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  estimated_value NUMERIC(14,2) CHECK (estimated_value IS NULL OR estimated_value >= 0),
  estimated_value_currency TEXT,
  quantity NUMERIC(14,3) CHECK (quantity IS NULL OR quantity >= 0),
  unit TEXT,
  route TEXT NOT NULL,
  commitment_state TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
  fulfillment_state TEXT NOT NULL DEFAULT 'PENDING',
  verification_state TEXT NOT NULL DEFAULT 'UNVERIFIED',
  thank_you_state TEXT NOT NULL DEFAULT 'NOT_DUE',
  pledged_at TIMESTAMPTZ,
  expected_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'planner',
  recorded_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contribution_type_chk CHECK (type IN ('CASH_TO_COUPLE','DIRECT_VENDOR_PAYMENT','GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP','HONEYMOON_GIFT','OTHER')),
  CONSTRAINT contribution_commitment_chk CHECK (commitment_state IN ('PLEDGED','CONFIRMED','CANCELLED','NOT_APPLICABLE')),
  CONSTRAINT contribution_fulfillment_chk CHECK (fulfillment_state IN ('PENDING','PARTIALLY_RECEIVED','RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED','FAILED_OR_CANCELLED')),
  CONSTRAINT contribution_verification_chk CHECK (verification_state IN ('UNVERIFIED','CONFIRMED_BY_USER','EVIDENCE_ATTACHED','RECONCILED')),
  CONSTRAINT contribution_thank_you_chk CHECK (thank_you_state IN ('NOT_DUE','TO_THANK','PREPARED','SENT','ACKNOWLEDGED_OTHER','NOT_REQUIRED'))
);

CREATE INDEX contributions_wedding_state_idx ON wewed_contributions.wedding_contributions(wedding_id, fulfillment_state);
CREATE INDEX contributions_contributor_idx ON wewed_contributions.wedding_contributions(contributor_id);
CREATE INDEX contributions_campaign_idx ON wewed_contributions.wedding_contributions(campaign_id);
CREATE INDEX contributions_vendor_idx ON wewed_contributions.wedding_contributions(vendor_id);
CREATE INDEX contributions_engagement_idx ON wewed_contributions.wedding_contributions(service_engagement_id);

CREATE TABLE wewed_contributions.contribution_allocations (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES public."Wedding"(id) ON DELETE CASCADE,
  contribution_id TEXT NOT NULL REFERENCES wewed_contributions.wedding_contributions(id) ON DELETE CASCADE,
  budget_item_id TEXT NOT NULL REFERENCES public."BudgetItem"(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  allocation_kind TEXT NOT NULL DEFAULT 'CASH' CHECK (allocation_kind IN ('CASH','IN_KIND','DIRECT_PAYMENT')),
  note TEXT,
  created_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contribution_allocations_wedding_budget_idx ON wewed_contributions.contribution_allocations(wedding_id, budget_item_id);
CREATE INDEX contribution_allocations_contribution_idx ON wewed_contributions.contribution_allocations(contribution_id);

CREATE TABLE wewed_contributions.payment_funding_allocations (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES public."Wedding"(id) ON DELETE CASCADE,
  payment_id TEXT REFERENCES public."EngagementPayment"(id) ON DELETE CASCADE,
  budget_item_id TEXT REFERENCES public."BudgetItem"(id) ON DELETE CASCADE,
  contribution_id TEXT REFERENCES wewed_contributions.wedding_contributions(id) ON DELETE SET NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('COUPLE','CONTRIBUTION','LEGACY_UNATTRIBUTED','OTHER')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  note TEXT,
  created_by_id TEXT,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_funding_target_chk CHECK (payment_id IS NOT NULL OR budget_item_id IS NOT NULL),
  CONSTRAINT payment_funding_contribution_chk CHECK (source_kind <> 'CONTRIBUTION' OR contribution_id IS NOT NULL)
);

CREATE INDEX payment_funding_wedding_budget_idx ON wewed_contributions.payment_funding_allocations(wedding_id, budget_item_id);
CREATE INDEX payment_funding_payment_idx ON wewed_contributions.payment_funding_allocations(payment_id);
CREATE INDEX payment_funding_contribution_idx ON wewed_contributions.payment_funding_allocations(contribution_id);

CREATE TABLE wewed_contributions.task_links (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL REFERENCES public."Wedding"(id) ON DELETE CASCADE,
  contribution_id TEXT NOT NULL REFERENCES wewed_contributions.wedding_contributions(id) ON DELETE CASCADE,
  planner_task_id TEXT NOT NULL REFERENCES public."PlannerTask"(id) ON DELETE CASCADE,
  link_role TEXT NOT NULL DEFAULT 'follow_up',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contribution_id, planner_task_id, link_role)
);

CREATE INDEX contribution_task_links_wedding_task_idx ON wewed_contributions.task_links(wedding_id, planner_task_id);

COMMENT ON SCHEMA wewed_contributions IS 'Private Wewed contribution/resource-accounting ledger. Public gifting views must use governed application endpoints.';
COMMENT ON TABLE wewed_contributions.payment_funding_allocations IS 'Source-of-funds attribution only. EngagementPayment/BudgetItem remains the payment/cost fact.';
