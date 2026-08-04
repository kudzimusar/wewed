-- New weddings are invitation-only until the couple explicitly changes privacy.
-- This trigger avoids relying on legacy application inserts or the historic
-- column default of 'public'. A later audited UPDATE through the couple privacy
-- centre may deliberately select public visibility.

CREATE OR REPLACE FUNCTION public.wewed_enforce_new_wedding_link_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.privacy IS NULL OR NEW.privacy = 'public' THEN
    NEW.privacy := 'link_only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wewed_wedding_default_privacy ON public."Wedding";
CREATE TRIGGER wewed_wedding_default_privacy
BEFORE INSERT ON public."Wedding"
FOR EACH ROW
EXECUTE FUNCTION public.wewed_enforce_new_wedding_link_only();

COMMENT ON FUNCTION public.wewed_enforce_new_wedding_link_only() IS
  'Forces newly created weddings to invitation-only visibility. Public visibility must be selected later through the audited couple privacy control.';
