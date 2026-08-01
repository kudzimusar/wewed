-- Complete the remaining planner UAT gap closure additively.
-- Budget vendor/notes are durable so search can cover the real-world fields
-- planners use to find offline/imported cost records.
ALTER TABLE public."BudgetItem"
  ADD COLUMN IF NOT EXISTS "vendorName" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;
