-- Consolidates user_settings.plan down to the 3 tiers Stripe actually sells
-- (business/duo/studio, matching the `tier` metadata on each Stripe Price —
-- see API/stripe-webhook.js) plus 'enterprise' for the 3 existing
-- sales-negotiated, uncapped accounts. 'free' and 'founding' go away as plan
-- values; "founder" becomes a separate boolean so founder pricing (applied
-- via the Stripe founders coupon at checkout) is orthogonal to which tier
-- someone is actually on.
--
-- Data at migration time: 1 'duo', 3 'enterprise', 22 'founding', 0 'free',
-- 0 'studio'. The 22 founding-plan accounts become plan='business',
-- is_founder=true (their locked-in founder pricing carries over). Enterprise
-- accounts are untouched.

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS is_founder boolean NOT NULL DEFAULT false;

-- Widen the constraint to allow 'business' (and keep the still-valid
-- 'duo'/'studio'/'enterprise') *before* the backfill below writes it —
-- 'free'/'founding' are dropped only once no row still holds them.
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_plan_check;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_plan_check
  CHECK (plan IN ('business', 'duo', 'studio', 'enterprise', 'free', 'founding'));

-- Migrations run outside any request context (no auth.uid()/auth.role()), so
-- the existing enforce_plan_immutable trigger would block this backfill the
-- same way it blocks a non-admin client update — disable it for just this
-- step, same pattern as the platform-admin bootstrap in
-- 20260728000000_ungate_signups_and_admin.sql.
ALTER TABLE public.user_settings DISABLE TRIGGER enforce_plan_immutable;

UPDATE public.user_settings SET plan = 'business', is_founder = true WHERE plan = 'founding';
UPDATE public.user_settings SET plan = 'business' WHERE plan = 'free';

ALTER TABLE public.user_settings ENABLE TRIGGER enforce_plan_immutable;

-- Now that no row holds 'free'/'founding', narrow the constraint to the
-- final 4 values.
ALTER TABLE public.user_settings DROP CONSTRAINT user_settings_plan_check;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_plan_check
  CHECK (plan IN ('business', 'duo', 'studio', 'enterprise'));

ALTER TABLE public.user_settings ALTER COLUMN plan SET DEFAULT 'business';

-- Business-space cap per plan: business=1, duo=2, studio=3, enterprise=uncapped.
CREATE OR REPLACE FUNCTION public.create_business_space(business_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_business_space_id uuid;
  clean_name text;
  caller_plan text;
  plan_cap integer;
  current_count integer;
BEGIN
  clean_name := NULLIF(TRIM(business_name), '');
  IF clean_name IS NULL THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  SELECT plan INTO caller_plan
  FROM public.user_settings
  WHERE user_id = auth.uid();

  plan_cap := CASE COALESCE(caller_plan, 'business')
    WHEN 'business' THEN 1
    WHEN 'duo' THEN 2
    WHEN 'studio' THEN 3
    ELSE NULL -- enterprise: uncapped
  END;

  IF plan_cap IS NOT NULL THEN
    SELECT count(*) INTO current_count
    FROM public.business_space_members
    WHERE user_id = auth.uid();

    IF current_count >= plan_cap THEN
      RAISE EXCEPTION 'Business space limit reached for current plan';
    END IF;
  END IF;

  INSERT INTO public.business_spaces (id, name, owner_id)
  VALUES (gen_random_uuid(), clean_name, auth.uid())
  RETURNING id INTO new_business_space_id;

  INSERT INTO public.business_space_members (business_space_id, user_id, role)
  VALUES (new_business_space_id, auth.uid(), 'owner');

  RETURN new_business_space_id;
END;
$function$;

-- Guard both plan and is_founder: only a platform admin (via
-- admin_set_user_plan/admin_set_founder_status) or the Stripe webhook
-- (connects as the service_role) may change either. Ordinary signups still
-- go through with the plan/is_founder column defaults untouched.
CREATE OR REPLACE FUNCTION public.enforce_plan_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.is_founder IS DISTINCT FROM OLD.is_founder) THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Only a platform admin can change plan or founder status';
    END IF;
  ELSIF TG_OP = 'INSERT' AND (NEW.plan IS DISTINCT FROM 'business' OR NEW.is_founder IS DISTINCT FROM false) THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Only a platform admin can set a non-default plan or founder status';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Lets an admin toggle founder status independently of plan (mirrors
-- set_platform_admin's shape). Founder status is now what unlocks founder
-- pricing, not a plan value.
CREATE OR REPLACE FUNCTION public.admin_set_founder_status(target_user_id uuid, new_is_founder boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE user_settings SET is_founder = new_is_founder WHERE user_id = target_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_founder_status(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_founder_status(uuid, boolean) TO authenticated;

-- Surface is_founder alongside plan for the admin panel. Return type is
-- changing (new is_founder column), so the old signature has to go first.
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE FUNCTION public.admin_list_users()
 RETURNS TABLE (
   user_id uuid,
   email text,
   created_at timestamptz,
   confirmed boolean,
   plan text,
   is_founder boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT u.id, u.email, u.created_at, (u.email_confirmed_at IS NOT NULL), us.plan, us.is_founder
  FROM auth.users u
  LEFT JOIN public.user_settings us ON us.user_id = u.id
  WHERE public.is_platform_admin()
  ORDER BY u.created_at DESC;
$function$;
