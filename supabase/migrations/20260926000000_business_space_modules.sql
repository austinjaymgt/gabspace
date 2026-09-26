-- Which feature modules a business has turned on used to live only in the
-- browser's localStorage (src/utils/businessModules.js) - so it never
-- followed the owner to another device, employees always saw every module
-- regardless of what the owner chose, and nothing server-side (the
-- upcoming MCP server / Orbi agent) could tell which modules were off.
-- Moves it onto business_spaces.
--
-- NULL means "never configured" and is read as every module on, matching
-- the old localStorage default for businesses with no stored entry. The
-- client pushes any existing localStorage choice up the first time an
-- owner/co-owner loads a business whose column is still NULL.

ALTER TABLE public.business_spaces ADD COLUMN IF NOT EXISTS enabled_modules jsonb;

-- Writes go through this rather than an UPDATE policy for the same reason
-- as update_business_identity: a permissive UPDATE policy on
-- business_spaces would also let co-owners rewrite owner_id.
CREATE OR REPLACE FUNCTION public.set_business_modules(target_business_space_id uuid, new_modules jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  allowed_keys text[] := ARRAY['clientManagement', 'portals', 'money', 'operations', 'creativeCollective', 'team'];
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

-- Default privileges auto-grant EXECUTE to anon on new public functions
-- (see 20260726160000_revoke_default_privilege_grants.sql), so revoke from
-- anon explicitly rather than relying on FROM PUBLIC.
REVOKE EXECUTE ON FUNCTION public.set_business_modules(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_business_modules(uuid, jsonb) TO authenticated;
