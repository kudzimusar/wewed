-- Contributions second-review taxonomy hardening.
-- Existing production contribution/campaign rows were checked before this migration was authored.

ALTER TABLE wewed_contributions.campaigns
  ADD CONSTRAINT contribution_campaign_type_chk
  CHECK (type IN ('HONEYMOON','HOME','WEDDING_SUPPORT','CHARITY','ITEM_EXPERIENCE'));

ALTER TABLE wewed_contributions.contributors
  ADD CONSTRAINT contributor_kind_chk
  CHECK (kind IN ('individual','family','organisation'));

ALTER TABLE wewed_contributions.contributors
  ADD CONSTRAINT contributor_preferred_contact_chk
  CHECK (preferred_contact_method IS NULL OR preferred_contact_method IN ('email','phone','other'));
