-- Lets a platform admin waive (or restore) the checkout requirement for an
-- account from the admin panel, e.g. for test accounts. enforce_plan_immutable
-- blocks direct edits to requires_checkout from anyone but a platform admin,
-- and the Supabase SQL editor has no auth.uid(), so there was no way to flip
-- it without going through Stripe.
CREATE OR REPLACE FUNCTION public.admin_set_requires_checkout(target_user_id uuid, new_requires_checkout boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE user_settings SET requires_checkout = new_requires_checkout WHERE user_id = target_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_requires_checkout(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_requires_checkout(uuid, boolean) TO authenticated;

-- Surface requires_checkout for the admin panel. Return type is changing, so
-- the old signature has to go first.
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE FUNCTION public.admin_list_users()
 RETURNS TABLE (
   user_id uuid,
   email text,
   created_at timestamptz,
   confirmed boolean,
   plan text,
   is_founder boolean,
   requires_checkout boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT u.id, u.email, u.created_at, (u.email_confirmed_at IS NOT NULL), us.plan, us.is_founder, us.requires_checkout
  FROM auth.users u
  LEFT JOIN public.user_settings us ON us.user_id = u.id
  WHERE public.is_platform_admin()
  ORDER BY u.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
