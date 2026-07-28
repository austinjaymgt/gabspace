-- The beta signup gate was previously enforced only client-side (a React
-- `if` before calling supabase.auth.signUp), with three independent ways
-- around it:
--   1. Calling supabase.auth.signUp() directly skips the check entirely.
--   2. The anon INSERT policy on beta_requests allowed setting status
--      straight to 'approved' on your own signup request.
--   3. beta_requests_all was tautological ("is caller owner/admin of their
--      own current business") which is true of every self-registered user,
--      so any signed-up user could read/approve the entire platform-wide
--      waitlist, not just Gabspace's own team.
-- This migration closes all three.

-- 1. Anonymous beta-request submissions may only ever land as 'pending' -
-- approval is something only the platform admin (or the approve-beta-request
-- edge function acting as service_role) can grant.
DROP POLICY IF EXISTS "Anyone can submit a beta request" ON "public"."beta_requests";
CREATE POLICY "Anyone can submit a beta request" ON "public"."beta_requests"
  FOR INSERT TO "anon" WITH CHECK (status = 'pending');

-- 2. "Platform admin" (manages the beta waitlist for the whole app) is a
-- distinct concept from "owner/admin of a business" - every tenant will
-- have the latter once beta opens. Scoped to a single real account rather
-- than a business, since that's the actual boundary being enforced.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT auth.uid() = (SELECT id FROM auth.users WHERE email = 'mgtostyn@gmail.com');
$function$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

DROP POLICY IF EXISTS "beta_requests_all" ON "public"."beta_requests";
CREATE POLICY "beta_requests_all" ON "public"."beta_requests"
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- 3. Enforce approval at the actual account-creation boundary (auth.users),
-- not just in the UI. A signup is allowed only if the email either has a
-- pending invite from an existing business (an owner/admin adding a
-- teammate via the invite-user function - already an authorized action),
-- or an approved beta_requests row (self-service signup, or the
-- admin-approved magic-link invite from approve-beta-request, which sets
-- status='approved' before creating the auth user). Anything else aborts
-- the whole signup transaction.
CREATE OR REPLACE FUNCTION public.enforce_beta_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.invites
    WHERE email = NEW.email AND accepted = false
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.beta_requests
    WHERE lower(email) = lower(NEW.email) AND status = 'approved'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not_approved_for_beta: % is not approved for beta access', NEW.email;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_beta_gate_before_insert ON auth.users;
CREATE TRIGGER enforce_beta_gate_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_beta_gate();
