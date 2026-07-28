-- 1. Closes a privilege-escalation hole: Settings.jsx let any signed-in user
-- write an arbitrary value into user_settings.plan via a plain client-side
-- update() (the "settings_all" policy only checks row ownership, not which
-- columns change). Since create_business_space() derives the per-user
-- business cap straight from user_settings.plan, this let a free user grant
-- themselves 'enterprise' (uncapped) with a single request. Same fix shape
-- as enforce_platform_admin_immutable in 20260728000000_ungate_signups_and_admin.sql:
-- a trigger that blocks the column from changing unless the caller is
-- already a platform admin. admin_set_user_plan() (SECURITY DEFINER, already
-- gated on is_platform_admin()) keeps working because auth.uid() reflects
-- the real calling admin regardless of the definer-role switch.
--
-- INSERT is guarded too, not just UPDATE: user_settings has no unique
-- constraint on user_id, so an insert with a non-default plan would
-- otherwise be an equally-open bypass for any account that doesn't yet have
-- a row. handle_new_user() never sets plan explicitly (it relies on the
-- column default), so ordinary signups are unaffected.
CREATE OR REPLACE FUNCTION public.enforce_plan_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.plan IS DISTINCT FROM OLD.plan THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Only a platform admin can change plan';
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.plan IS DISTINCT FROM 'founding' THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Only a platform admin can set a non-default plan';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_plan_immutable ON public.user_settings;
CREATE TRIGGER enforce_plan_immutable
  BEFORE INSERT OR UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_plan_immutable();

-- 2. handle_new_user() collects a full name at signup (raw_user_meta_data
-- ->> 'full_name') but never wrote it anywhere the app actually reads:
-- user_settings.first_name (top bar / greetings) and
-- business_space_members.display_name (Business identity form, Team list)
-- were both left blank, so every new account showed empty name fields and
-- "No name set" in Team until the user manually retyped what they'd already
-- entered on the signup form.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_business_space_id uuid;
  ws_name text;
  pending_invite record;
  full_name_val text;
  first_name_val text;
BEGIN
  full_name_val := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
  first_name_val := NULLIF(SPLIT_PART(COALESCE(full_name_val, ''), ' ', 1), '');

  SELECT * INTO pending_invite
  FROM public.invites
  WHERE email = NEW.email AND accepted = false
  ORDER BY created_at ASC
  LIMIT 1;

  IF pending_invite.id IS NOT NULL THEN
    INSERT INTO public.user_profiles (user_id, business_space_id, role, display_name, invited_by)
    VALUES (NEW.id, pending_invite.business_space_id, pending_invite.role, full_name_val, pending_invite.invited_by);

    INSERT INTO public.business_space_members (business_space_id, user_id, role, display_name)
    VALUES (pending_invite.business_space_id, NEW.id, pending_invite.role, full_name_val);

    UPDATE public.invites SET accepted = true WHERE id = pending_invite.id;
  ELSE
    ws_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'workspace_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '') || '''s Workspace',
      'My Workspace'
    );

    INSERT INTO public.business_spaces (id, name, owner_id)
    VALUES (gen_random_uuid(), ws_name, NEW.id)
    RETURNING id INTO new_business_space_id;

    INSERT INTO public.user_profiles (user_id, business_space_id, role, display_name)
    VALUES (NEW.id, new_business_space_id, 'owner', full_name_val);

    INSERT INTO public.business_space_members (business_space_id, user_id, role, display_name)
    VALUES (new_business_space_id, NEW.id, 'owner', full_name_val);
  END IF;

  INSERT INTO public.user_settings (user_id, onboarding_completed, first_name)
  VALUES (NEW.id, false, first_name_val);

  RETURN NEW;
END;
$function$;

-- 3. Backfill: existing accounts signed up before this fix still have blank
-- first_name / display_name even though the full name they typed at signup
-- is sitting unused in auth.users.raw_user_meta_data. Only fills rows that
-- are currently blank so nobody's later edits get clobbered.
UPDATE public.user_settings us
SET first_name = NULLIF(SPLIT_PART(TRIM(u.raw_user_meta_data->>'full_name'), ' ', 1), '')
FROM auth.users u
WHERE us.user_id = u.id
  AND (us.first_name IS NULL OR us.first_name = '')
  AND NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), '') IS NOT NULL;

UPDATE public.business_space_members bsm
SET display_name = NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), '')
FROM auth.users u
WHERE bsm.user_id = u.id
  AND (bsm.display_name IS NULL OR bsm.display_name = '')
  AND NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), '') IS NOT NULL;
