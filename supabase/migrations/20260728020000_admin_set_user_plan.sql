-- Lets an admin change any user's plan from the Admin panel instead of
-- editing user_settings directly in the SQL editor. Admin-only; the
-- existing user_settings_plan_check constraint still enforces valid values.
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(target_user_id uuid, new_plan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE user_settings SET plan = new_plan WHERE user_id = target_user_id;
  IF NOT FOUND THEN
    INSERT INTO user_settings (user_id, plan) VALUES (target_user_id, new_plan);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_user_plan(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(uuid, text) TO authenticated;
