-- Wewed public Contributions governance
-- Extends the existing wewed_contributions accounting schema; no parallel ledger.

CREATE TABLE IF NOT EXISTS wewed_contributions.wedding_settings (
  wedding_id TEXT PRIMARY KEY REFERENCES public."Wedding"(id) ON DELETE CASCADE,
  accepting_contributions BOOLEAN NOT NULL DEFAULT TRUE,
  disabled_message TEXT,
  updated_by_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wewed_contributions.campaigns
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_types JSONB NOT NULL DEFAULT '["CASH_TO_COUPLE","DIRECT_VENDOR_PAYMENT","GOODS_IN_KIND","SERVICE_IN_KIND","TIME_LABOUR","DISCOUNT_SPONSORSHIP","HONEYMOON_GIFT","OTHER"]'::jsonb,
  ADD COLUMN IF NOT EXISTS budget_item_id TEXT REFERENCES public."BudgetItem"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_engagement_id TEXT REFERENCES public."ServiceEngagement"(id) ON DELETE SET NULL;

ALTER TABLE wewed_contributions.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_accepted_types_array_chk;
ALTER TABLE wewed_contributions.campaigns
  ADD CONSTRAINT campaigns_accepted_types_array_chk CHECK (jsonb_typeof(accepted_types) = 'array');

CREATE INDEX IF NOT EXISTS campaigns_wedding_public_order_idx
  ON wewed_contributions.campaigns(wedding_id, published, enabled, sort_order, created_at);

COMMENT ON TABLE wewed_contributions.wedding_settings IS
  'Wedding-level public contribution acceptance switch. History is retained when disabled.';
COMMENT ON COLUMN wewed_contributions.campaigns.accepted_types IS
  'Contribution types the couple/planner accepts for this public campaign.';
COMMENT ON COLUMN wewed_contributions.campaigns.budget_item_id IS
  'Optional governed Budget destination for public pledges; does not itself mark the item paid.';
COMMENT ON COLUMN wewed_contributions.campaigns.service_engagement_id IS
  'Optional governed vendor service destination required for public direct-vendor-payment pledges.';
