-- Real multi-business membership, phase 1.
--
-- user_profiles.business_space_id remains the single "currently active"
-- business space that every existing page/query already scopes by - that
-- design is deliberate, it means none of the ~40 existing RLS policies or
-- frontend queries need to change. This migration adds the actual
-- many-to-many layer on top: which businesses a user is allowed to make
-- active in the first place.

CREATE TABLE IF NOT EXISTS public.business_space_members (
  id uuid primary key default gen_random_uuid(),
  business_space_id uuid not null references public.business_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz default now(),
  unique (business_space_id, user_id)
);

ALTER TABLE public.business_space_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_space_members_select_own" ON public.business_space_members;
CREATE POLICY "business_space_members_select_own" ON public.business_space_members
  FOR SELECT USING (user_id = auth.uid());

-- Backfill: every existing user_profiles row becomes a membership row,
-- preserving current access exactly as-is for all existing users.
-- Excludes rows whose user_id no longer exists in auth.users (orphaned
-- profile rows from deleted/reset accounts) - those aren't real users to
-- carry forward and would violate the FK below anyway.
INSERT INTO public.business_space_members (business_space_id, user_id, role)
SELECT up.business_space_id, up.user_id, up.role
FROM public.user_profiles up
WHERE up.business_space_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = up.user_id)
ON CONFLICT (business_space_id, user_id) DO NOTHING;

-- get_my_business_space_ids() now reflects real membership (potentially
-- multiple rows) instead of the single active business_space_id.
CREATE OR REPLACE FUNCTION public.get_my_business_space_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT business_space_id
  FROM business_space_members
  WHERE user_id = auth.uid();
$function$;

-- New signups get a membership row alongside their profile row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_business_space_id uuid;
  ws_name text;
BEGIN
  ws_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'workspace_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '') || '''s Workspace',
    'My Workspace'
  );

  INSERT INTO public.business_spaces (id, name, owner_id)
  VALUES (gen_random_uuid(), ws_name, NEW.id)
  RETURNING id INTO new_business_space_id;

  INSERT INTO public.user_profiles (user_id, business_space_id, role, display_name)
  VALUES (NEW.id, new_business_space_id, 'owner', NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.business_space_members (business_space_id, user_id, role)
  VALUES (new_business_space_id, NEW.id, 'owner');

  INSERT INTO public.user_settings (user_id, onboarding_completed)
  VALUES (NEW.id, false);

  RETURN NEW;
END;
$function$;

-- Security guard: a user may only set their active business_space_id to
-- one they actually have a membership row for. Without this, the existing
-- "profiles_update" RLS policy (USING (user_id = auth.uid())) would let a
-- user switch into any business space's data, since every other table's
-- RLS policy trusts user_profiles.business_space_id.
CREATE OR REPLACE FUNCTION public.enforce_active_business_space_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.business_space_id IS DISTINCT FROM OLD.business_space_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM business_space_members
      WHERE user_id = NEW.user_id AND business_space_id = NEW.business_space_id
    ) THEN
      RAISE EXCEPTION 'Not a member of business space %', NEW.business_space_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_active_business_space_membership ON public.user_profiles;
CREATE TRIGGER enforce_active_business_space_membership
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_active_business_space_membership();
