-- Ungates signups (removes the beta approval requirement) and replaces the
-- hardcoded-email is_platform_admin() with a real, assignable flag, plus
-- the tables the new /admin panel needs (open/closed toggle, waitlist).
-- beta_requests itself is intentionally left in place (real historical
-- applicant data) — only the active gate/trigger is removed.

-- 1. Platform-admin flag on the one account-wide table (user_settings).
-- user_settings has a wide-open "settings_all" policy (USING/WITH CHECK
-- (user_id = auth.uid()), no column restriction) — without a guard, any
-- user could self-promote via a plain update() on their own row. The
-- trigger below closes that; set_platform_admin() is the only path for
-- promoting *someone else*, since settings_all only ever lets you touch
-- your own row regardless of the trigger.
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enforce_platform_admin_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Only a platform admin can change platform admin status';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_platform_admin_immutable ON public.user_settings;
CREATE TRIGGER enforce_platform_admin_immutable
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_platform_admin_immutable();

CREATE OR REPLACE FUNCTION public.set_platform_admin(target_user_id uuid, is_admin boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE user_settings SET is_platform_admin = is_admin WHERE user_id = target_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_platform_admin(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_platform_admin(uuid, boolean) TO authenticated;

-- is_platform_admin() now checks the flag instead of a hardcoded email.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.user_settings WHERE user_id = auth.uid()),
    false
  );
$function$;

-- Seed the first admin. Migrations run outside any request context (no
-- auth.uid()), so the guard trigger above would block this same UPDATE it
-- was just created to protect against — disable it for this one bootstrap
-- step only. user_settings has no unique constraint on user_id, so this
-- can't be a plain upsert.
ALTER TABLE public.user_settings DISABLE TRIGGER enforce_platform_admin_immutable;

DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'mgtostyn@gmail.com';
  IF admin_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = admin_user_id) THEN
      UPDATE public.user_settings SET is_platform_admin = true WHERE user_id = admin_user_id;
    ELSE
      INSERT INTO public.user_settings (user_id, is_platform_admin) VALUES (admin_user_id, true);
    END IF;
  END IF;
END $$;

ALTER TABLE public.user_settings ENABLE TRIGGER enforce_platform_admin_immutable;

-- 2. Drop the beta gate. This is the actual boundary that blocks signups —
-- removing it (and only it) ungates signup while leaving handle_new_user()
-- (business/profile creation, invite acceptance) untouched.
DROP TRIGGER IF EXISTS enforce_beta_gate_before_insert ON auth.users;
DROP FUNCTION IF EXISTS public.enforce_beta_gate();

-- 3. Platform-wide settings singleton: signup kill switch + founding-member
-- cap. Readable by anyone (the signup page checks signups_open before
-- rendering, pre-auth), writable only by an admin.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  signups_open boolean NOT NULL DEFAULT true,
  founding_member_cap integer,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select" ON public.platform_settings;
CREATE POLICY "platform_settings_select" ON public.platform_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "platform_settings_update" ON public.platform_settings;
CREATE POLICY "platform_settings_update" ON public.platform_settings
  FOR UPDATE USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- 4. Waitlist — bare-email capture shown when signups_open is false.
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waitlist_insert" ON public.waitlist;
CREATE POLICY "waitlist_insert" ON public.waitlist
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "waitlist_select" ON public.waitlist;
CREATE POLICY "waitlist_select" ON public.waitlist
  FOR SELECT USING (public.is_platform_admin());

-- 5. "Founding member" becomes a 5th plan tier value.
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_plan_check;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_plan_check
  CHECK (plan IN ('free', 'duo', 'studio', 'enterprise', 'founding'));

-- 6. Admin-only user list. auth.users isn't exposed via the client API, so
-- this exposes just what the panel needs, same reasoning as the existing
-- find_user_id_by_email().
CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE (
   user_id uuid,
   email text,
   created_at timestamptz,
   confirmed boolean,
   plan text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT u.id, u.email, u.created_at, (u.email_confirmed_at IS NOT NULL), us.plan
  FROM auth.users u
  LEFT JOIN public.user_settings us ON us.user_id = u.id
  WHERE public.is_platform_admin()
  ORDER BY u.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
