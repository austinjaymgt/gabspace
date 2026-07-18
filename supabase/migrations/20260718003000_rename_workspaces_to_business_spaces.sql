-- Renames workspaces -> business_spaces and workspace_id -> business_space_id
-- everywhere, plus the function renames/fixes that go with it.
--
-- This captures what was actually run directly against production earlier
-- in this session (in two passes: the rename itself, then an emergency
-- follow-up once we discovered function bodies don't auto-update on
-- column rename the way RLS policies and foreign keys do). Recorded here
-- as one coherent migration so the tracked history matches reality.

BEGIN;

ALTER TABLE public.workspaces RENAME TO business_spaces;

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'workspace_id'
      AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I RENAME COLUMN workspace_id TO business_space_id',
      tbl.table_name
    );
  END LOOP;
END $$;

ALTER FUNCTION public.get_my_workspace_ids() RENAME TO get_my_business_space_ids;

COMMIT;

-- Function bodies are stored as text and don't get rewritten by the
-- column/table renames above (unlike RLS policies and FKs, which Postgres
-- tracks structurally). These three still referenced the old names
-- internally and needed explicit fixes.

CREATE OR REPLACE FUNCTION public.get_my_business_space_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT business_space_id
  FROM user_profiles
  WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_my_role(ws_id uuid)
 RETURNS public.workspace_role
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT role FROM public.user_profiles
  WHERE user_id = auth.uid() AND business_space_id = ws_id
  LIMIT 1;
$function$;

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

  INSERT INTO public.user_settings (user_id, onboarding_completed)
  VALUES (NEW.id, false);

  RETURN NEW;
END;
$function$;
