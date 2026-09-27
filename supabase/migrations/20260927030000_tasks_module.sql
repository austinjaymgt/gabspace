-- Tasks becomes its own module instead of living under Client Management
-- (a task list doesn't need clients or projects). Adds 'tasks' to the keys
-- set_business_modules accepts, and backfills configured businesses so
-- Tasks starts out matching whatever they had Client Management set to —
-- a business that turned Client Management off doesn't suddenly see Tasks.
-- NULL enabled_modules still means everything on.

UPDATE public.business_spaces
SET enabled_modules = enabled_modules || jsonb_build_object('tasks', COALESCE(enabled_modules -> 'clientManagement', 'true'::jsonb))
WHERE enabled_modules IS NOT NULL
  AND NOT enabled_modules ? 'tasks';

CREATE OR REPLACE FUNCTION public.set_business_modules(target_business_space_id uuid, new_modules jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  allowed_keys text[] := ARRAY['tasks', 'clientManagement', 'portals', 'money', 'operations', 'creativeCollective', 'team'];
  k text;
BEGIN
  IF NOT public.can_manage_business(auth.uid(), target_business_space_id) THEN
    RAISE EXCEPTION 'Not authorized to update this business';
  END IF;

  IF new_modules IS NULL OR jsonb_typeof(new_modules) <> 'object' THEN
    RAISE EXCEPTION 'Modules must be a JSON object';
  END IF;

  FOR k IN SELECT jsonb_object_keys(new_modules) LOOP
    IF NOT k = ANY(allowed_keys) THEN
      RAISE EXCEPTION 'Unknown module: %', k;
    END IF;
    IF jsonb_typeof(new_modules -> k) <> 'boolean' THEN
      RAISE EXCEPTION 'Module % must be true or false', k;
    END IF;
  END LOOP;

  UPDATE business_spaces
  SET enabled_modules = new_modules
  WHERE id = target_business_space_id;
END;
$function$;
