-- Preserve a complete before/after history for every Budget mutation.
-- This trigger also covers direct SQL and maintenance operations that bypass
-- the application API, which is required for real-client data recovery.

CREATE OR REPLACE FUNCTION public.wewed_audit_budget_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  event_action text;
  event_resource_id text;
  event_wedding_id text;
  row_before jsonb;
  row_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_action := 'budget.db_insert';
    event_resource_id := NEW.id;
    event_wedding_id := NEW."weddingId";
    row_before := NULL;
    row_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(OLD) = to_jsonb(NEW) THEN
      RETURN NEW;
    END IF;
    event_action := 'budget.db_update';
    event_resource_id := NEW.id;
    event_wedding_id := NEW."weddingId";
    row_before := to_jsonb(OLD);
    row_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    event_action := 'budget.db_delete';
    event_resource_id := OLD.id;
    event_wedding_id := OLD."weddingId";
    row_before := to_jsonb(OLD);
    row_after := NULL;
  ELSE
    RAISE EXCEPTION 'Unsupported BudgetItem trigger operation: %', TG_OP;
  END IF;

  INSERT INTO public."AuditEvent" (
    id,
    action,
    "resourceType",
    "resourceId",
    "beforeValue",
    "afterValue",
    "weddingId",
    "actorId",
    "createdAt"
  ) VALUES (
    'budget-audit-' || gen_random_uuid()::text,
    event_action,
    'budget_item',
    event_resource_id,
    CASE WHEN row_before IS NULL THEN NULL ELSE row_before::text END,
    CASE WHEN row_after IS NULL THEN NULL ELSE row_after::text END,
    event_wedding_id,
    NULL,
    CURRENT_TIMESTAMP
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wewed_budget_item_audit ON public."BudgetItem";
CREATE TRIGGER wewed_budget_item_audit
AFTER INSERT OR UPDATE OR DELETE ON public."BudgetItem"
FOR EACH ROW
EXECUTE FUNCTION public.wewed_audit_budget_item_change();

COMMENT ON FUNCTION public.wewed_audit_budget_item_change() IS
  'Writes immutable before/after AuditEvent records for all BudgetItem inserts, updates, and deletes, including direct SQL operations.';
