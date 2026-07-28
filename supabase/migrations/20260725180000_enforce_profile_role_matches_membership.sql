-- profiles_update (USING (user_id = auth.uid())) has no column-level
-- restriction, and the existing enforce_active_business_space_membership
-- trigger only validated that a user could switch business_space_id to a
-- business they're actually a member of - it never checked that the
-- `role` they set alongside it matches their real role in
-- business_space_members for that business. So any signed-in user could
-- do `update({business_space_id: X, role: 'owner'})` for a business X
-- they're only a 'member' or 'client' of, and several RLS policies /
-- frontend gates trust user_profiles.role directly (announcements,
-- intranet_config, beta_requests, the Settings/Invoices/Expenses UI
-- gates) - a full in-tenant privilege escalation.
--
-- Fix: whenever business_space_id OR role changes, both must match an
-- actual business_space_members row for that user. This is the
-- authoritative source of per-business role - user_profiles.role is only
-- ever meant to mirror it for whichever business is currently active.
CREATE OR REPLACE FUNCTION public.enforce_active_business_space_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.business_space_id IS DISTINCT FROM OLD.business_space_id
     OR NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM business_space_members
      WHERE user_id = NEW.user_id
        AND business_space_id = NEW.business_space_id
        AND role = NEW.role
    ) THEN
      RAISE EXCEPTION 'Not a member of business space % with role %', NEW.business_space_id, NEW.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
