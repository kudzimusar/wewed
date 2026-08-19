-- Contributions & Resource Accounting follow-up hardening
-- Cover foreign-key lookup directions used by PostgreSQL cascades and reconciliation joins.

CREATE INDEX contribution_allocations_budget_item_idx
  ON wewed_contributions.contribution_allocations(budget_item_id);

CREATE INDEX payment_funding_budget_item_idx
  ON wewed_contributions.payment_funding_allocations(budget_item_id);

CREATE INDEX contribution_task_links_task_idx
  ON wewed_contributions.task_links(planner_task_id);
