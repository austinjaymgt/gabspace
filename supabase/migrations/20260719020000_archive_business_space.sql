-- Archiving a business (vs. hard delete) — every workspace-scoped table
-- FKs to business_spaces ON DELETE CASCADE, so a real delete would destroy
-- clients/invoices/projects with no way back. Archive just flips a flag;
-- the business and its data stay put, hidden from the switcher until
-- restored.

ALTER TABLE public.business_spaces ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Archiving is owner-only (affects every member, not just the caller's own
-- account) and, like update_business_identity, runs SECURITY DEFINER
-- rather than via a raw RLS UPDATE policy. The caller is always the person
-- currently active in the business being archived (Settings only ever
-- operates on your own businessSpaceId), so this also reassigns their
-- active business_space_id to a fallback in the same transaction — that
-- column is NOT NULL, so it can never be left pointing at nothing. If the
-- owner has no other non-archived business to fall back to, the archive is
-- blocked outright (same shape as remove_business_member's fallback
-- check) rather than leaving them with no active business at all.
CREATE OR REPLACE FUNCTION public.archive_business_space(target_business_space_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fallback_business_space_id uuid;
  fallback_role public.workspace_role;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM business_space_members
    WHERE business_space_id = target_business_space_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the owner can archive this business';
  END IF;

  SELECT bsm.business_space_id, bsm.role INTO fallback_business_space_id, fallback_role
  FROM business_space_members bsm
  JOIN business_spaces bs ON bs.id = bsm.business_space_id
  WHERE bsm.user_id = auth.uid()
    AND bsm.business_space_id != target_business_space_id
    AND bs.archived_at IS NULL
  ORDER BY bsm.created_at ASC
  LIMIT 1;

  IF fallback_business_space_id IS NULL THEN
    RAISE EXCEPTION 'Create another business before archiving your only one';
  END IF;

  UPDATE business_spaces SET archived_at = now() WHERE id = target_business_space_id;

  UPDATE user_profiles
  SET business_space_id = fallback_business_space_id, role = fallback_role
  WHERE user_id = auth.uid();
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_business_space(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_business_space(uuid) TO authenticated;

-- Restoring — symmetric owner-only check, no fallback logic needed since
-- restoring never removes anyone's active business.
CREATE OR REPLACE FUNCTION public.restore_business_space(target_business_space_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM business_space_members
    WHERE business_space_id = target_business_space_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the owner can restore this business';
  END IF;

  UPDATE business_spaces SET archived_at = NULL WHERE id = target_business_space_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_business_space(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_business_space(uuid) TO authenticated;
