ALTER TABLE wewed_contributions.campaigns
  ADD COLUMN IF NOT EXISTS show_contributor_recognition BOOLEAN NOT NULL DEFAULT FALSE;
