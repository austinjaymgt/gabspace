-- Restructures the workspace_role tiers:
--   - 'admin' stops being a per-business assignable role. It becomes a
--     platform-wide, email-locked concept (already implemented as
--     is_platform_admin(), hardcoded to mgtostyn@gmail.com, gating the
--     beta-admin page) — no longer something an owner can hand to a
--     teammate.
--   - 'co-owner' (new enum value, added in the prior migration) takes over
--     everything 'admin' used to do for a business: invite/manage
--     teammates, see financials, edit business identity. Everything Owner
--     has except archive/restore and immunity from removal.
--   - 'member' is renamed to 'employee' (which already existed as a dead
--     enum value) — same access, new label.
-- Existing data is migrated in place so nobody's actual access changes:
-- every current 'admin' becomes 'co-owner', every current 'member' becomes
-- 'employee'. 'admin' and 'member' remain in the enum (Postgres can't drop
-- enum values) but become unused/reserved, same as 'client'/'employee' were
-- before this migration.

-- 1. Data migration — preserve current access under the new names.
UPDATE public.business_space_members SET role = 'co-owner' WHERE role = 'admin';
UPDATE public.business_space_members SET role = 'employee' WHERE role = 'member';

UPDATE public.user_profiles SET role = 'co-owner' WHERE role = 'admin';
UPDATE public.user_profiles SET role = 'employee' WHERE role = 'member';

UPDATE public.invites SET role = 'co-owner' WHERE role = 'admin' AND accepted = false;
UPDATE public.invites SET role = 'employee' WHERE role = 'member' AND accepted = false;

-- 2. New default role for new members/invites is 'employee', not 'member'.
ALTER TABLE public.business_space_members ALTER COLUMN role SET DEFAULT 'employee';
ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'employee';
ALTER TABLE public.invites ALTER COLUMN role SET DEFAULT 'employee';

-- 3. Role-cap enforcement. Hardcoded for now (co-owner: 1, employee: 3) —
-- not yet tied to a pricing plan, same style as create_business_space()'s
-- hardcoded free/duo/studio business-space caps. Counts existing
-- *accepted* business_space_members rows for the target role, excluding
-- one user_id so re-saving your own current role never self-blocks.
CREATE OR REPLACE FUNCTION public.check_role_cap(target_business_space_id uuid, target_role public.workspace_role, excluding_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  role_cap integer;
  current_count integer;
BEGIN
  role_cap := CASE target_role
    WHEN 'co-owner' THEN 1
    WHEN 'employee' THEN 3
    ELSE NULL
  END;

  IF role_cap IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO current_count
  FROM business_space_members
  WHERE business_space_id = target_business_space_id
    AND role = target_role
    AND user_id != excluding_user_id;

  IF current_count >= role_cap THEN
    RAISE EXCEPTION 'role_cap_reached: % limit reached for this business', target_role;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_role_cap(uuid, public.workspace_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_role_cap(uuid, public.workspace_role, uuid) TO authenticated, service_role;

-- 4. update_member_role: caller must be owner/co-owner (was owner/admin);
-- 'admin' can no longer be assigned through this action either, so it's
-- permanently unreachable as a business role now that it's platform-only;
-- and the new role must respect the cap above.
CREATE OR REPLACE FUNCTION public.update_member_role(target_user_id uuid, target_business_space_id uuid, new_role public.workspace_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF new_role IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Cannot assign % role through this action', new_role;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM business_space_members
    WHERE business_space_id = target_business_space_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'co-owner')
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage members of this business';
  END IF;

  IF EXISTS (
    SELECT 1 FROM business_space_members
    WHERE business_space_id = target_business_space_id
      AND user_id = target_user_id
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Cannot change the owner''s role';
  END IF;

  PERFORM public.check_role_cap(target_business_space_id, new_role, target_user_id);

  UPDATE business_space_members
  SET role = new_role
  WHERE business_space_id = target_business_space_id
    AND user_id = target_user_id;

  UPDATE user_profiles
  SET role = new_role
  WHERE user_id = target_user_id
    AND business_space_id = target_business_space_id;
END;
$function$;

-- 5. remove_business_member / update_business_identity: caller must be
-- owner/co-owner (was owner/admin).
CREATE OR REPLACE FUNCTION public.remove_business_member(target_user_id uuid, target_business_space_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fallback_business_space_id uuid;
  fallback_role public.workspace_role;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM business_space_members
    WHERE business_space_id = target_business_space_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'co-owner')
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage members of this business';
  END IF;

  IF EXISTS (
    SELECT 1 FROM business_space_members
    WHERE business_space_id = target_business_space_id
      AND user_id = target_user_id
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Cannot remove the owner';
  END IF;

  IF (SELECT business_space_id FROM user_profiles WHERE user_id = target_user_id) = target_business_space_id THEN
    SELECT business_space_id, role INTO fallback_business_space_id, fallback_role
    FROM business_space_members
    WHERE user_id = target_user_id AND business_space_id != target_business_space_id
    LIMIT 1;

    IF fallback_business_space_id IS NULL THEN
      RAISE EXCEPTION 'This member has no other business to fall back to and cannot be removed';
    END IF;

    UPDATE user_profiles
    SET business_space_id = fallback_business_space_id, role = fallback_role
    WHERE user_id = target_user_id;
  END IF;

  DELETE FROM business_space_members
  WHERE business_space_id = target_business_space_id
    AND user_id = target_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_business_identity(target_business_space_id uuid, new_name text, new_logo_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM business_space_members
    WHERE business_space_id = target_business_space_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'co-owner')
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this business';
  END IF;

  UPDATE business_spaces
  SET name = COALESCE(NULLIF(TRIM(new_name), ''), name),
      logo_url = new_logo_url
  WHERE id = target_business_space_id;
END;
$function$;

-- 6. get_my_intranet_role(): drop the dead 'admin'/'member' priority
-- branches, add 'co-owner'.
CREATE OR REPLACE FUNCTION public.get_my_intranet_role() RETURNS public.workspace_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT role FROM user_profiles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'owner' THEN 1
    WHEN 'co-owner' THEN 2
    WHEN 'employee' THEN 3
    ELSE 4
  END
  LIMIT 1;
$$;

-- 7. RLS: financial tables were scoped to owner/admin; now owner/co-owner.
DROP POLICY IF EXISTS "invoices_all" ON public.invoices;
CREATE POLICY "invoices_all" ON public.invoices
  USING (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'co-owner')
  ))
  WITH CHECK (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'co-owner')
  ));

DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
CREATE POLICY "expenses_all" ON public.expenses
  USING (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'co-owner')
  ))
  WITH CHECK (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'co-owner')
  ));

DROP POLICY IF EXISTS "revenue_all" ON public.revenue;
CREATE POLICY "revenue_all" ON public.revenue
  USING (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'co-owner')
  ))
  WITH CHECK (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'co-owner')
  ));

-- 8. RLS: legacy intranet policies — 'admin' -> 'co-owner', 'member' folded
-- into 'employee'.
DROP POLICY IF EXISTS "announcements_insert" ON "public"."announcements";
CREATE POLICY "announcements_insert" ON "public"."announcements" FOR INSERT WITH CHECK (("public"."get_my_intranet_role"() = ANY (ARRAY['co-owner'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));

DROP POLICY IF EXISTS "announcements_update" ON "public"."announcements";
CREATE POLICY "announcements_update" ON "public"."announcements" FOR UPDATE USING (("public"."get_my_intranet_role"() = ANY (ARRAY['co-owner'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));

DROP POLICY IF EXISTS "announcements_select" ON "public"."announcements";
CREATE POLICY "announcements_select" ON "public"."announcements" FOR SELECT USING (("public"."get_my_intranet_role"() = ANY (ARRAY['employee'::"public"."workspace_role", 'co-owner'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));

DROP POLICY IF EXISTS "intranet_config_insert" ON "public"."intranet_config";
CREATE POLICY "intranet_config_insert" ON "public"."intranet_config" FOR INSERT WITH CHECK (("public"."get_my_intranet_role"() = ANY (ARRAY['co-owner'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));

DROP POLICY IF EXISTS "intranet_config_update" ON "public"."intranet_config";
CREATE POLICY "intranet_config_update" ON "public"."intranet_config" FOR UPDATE USING (("public"."get_my_intranet_role"() = ANY (ARRAY['co-owner'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));

DROP POLICY IF EXISTS "intranet_config_select" ON "public"."intranet_config";
CREATE POLICY "intranet_config_select" ON "public"."intranet_config" FOR SELECT USING (("public"."get_my_intranet_role"() = ANY (ARRAY['employee'::"public"."workspace_role", 'co-owner'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));
