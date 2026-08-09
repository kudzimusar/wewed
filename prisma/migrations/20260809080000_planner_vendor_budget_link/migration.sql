-- Planner operational vendors need a distinct email contact and BudgetItem.vendorId
-- must be a real relationship rather than an unchecked scalar.
ALTER TABLE "Vendor"
  ADD COLUMN "email" TEXT;

CREATE INDEX "BudgetItem_vendorId_idx"
  ON "BudgetItem"("vendorId");

ALTER TABLE "BudgetItem"
  ADD CONSTRAINT "BudgetItem_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
