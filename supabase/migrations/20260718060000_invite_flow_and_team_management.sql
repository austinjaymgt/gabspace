-- Makes the (already-built but hidden) Team section in Settings actually
-- work under the multi-business model, and fixes invite acceptance for
-- brand-new signups.

-- 1. handle_new_user() previously ignored the invites table entirely, so
-- an invited person who didn't have an account yet would sign up into
-- their own brand-new owned business instead of joining the one they were
-- invited to. Now it checks for a pending invite by email first.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_business_space_id uuid;
  ws_name text;
  pending_invite record;
BEGIN
  SELECT * INTO pending_invite
  FROM public.invites
  WHERE email = NEW.email AND accepted = false
  ORDER BY created_at ASC
  LIMIT 1;

  IF pending_invite.id IS NOT NULL THEN
    INSERT INTO public.user_profiles (user_id, business_space_id, role, display_name, invited_by)
    VALUES (NEW.id, pending_invite.business_space_id, pending_invite.role, NEW.raw_user_meta_data->>'full_name', pending_invite.invited_by);

    INSERT INTO public.business_space_members (business_space_id, user_id, role)
    VALUES (pending_invite.business_space_id, NEW.id, pending_invite.role);

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
    VALUES (NEW.id, new_business_space_id, 'owner', NEW.raw_user_meta_data->>'full_name');

    INSERT INTO public.business_space_members (business_space_id, user_id, role)
    VALUES (new_business_space_id, NEW.id, 'owner');
  END IF;

  INSERT INTO public.user_settings (user_id, onboarding_completed)
  VALUES (NEW.id, false);

  RETURN NEW;
END;
$function$;

-- 2. The Team list needs to show everyone who's actually a member of the
-- business, not just whoever currently has it as their active space - the
-- existing select-own-row-only policy doesn't allow that.
DROP POLICY IF EXISTS "business_space_members_select_same_business" ON public.business_space_members;
CREATE POLICY "business_space_members_select_same_business" ON public.business_space_members
  FOR SELECT USING (business_space_id IN (SELECT public.get_my_business_space_ids()));

-- 3. Revoking a pending invite had no policy to allow it at all (insert
-- and update existed, delete didn't), so the button silently no-op'd.
DROP POLICY IF EXISTS "invites_delete" ON public.invites;
CREATE POLICY "invites_delete" ON public.invites
  FOR DELETE USING (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid()
  ));

-- 4. Lets the invite-user edge function check whether an invited email
-- already belongs to an existing account, so it can add them directly to
-- business_space_members instead of sending a signup invite that would
-- fail ("already registered"). auth.users isn't exposed via the API, so
-- this is the lookup path. Restricted to service_role only - granting
-- this to authenticated users would let anyone probe arbitrary emails for
-- an account.
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(lookup_email text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT id FROM auth.users WHERE email = lookup_email LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO service_role;

-- 5. Changing a teammate's role: the existing "profiles_update" policy is
-- self-only (user_id = auth.uid()), so an owner/admin couldn't update
-- someone else's row directly. Runs as SECURITY DEFINER instead, gated on
-- the caller actually being owner/admin of that specific business, and
-- keeps business_space_members (authoritative per-business role) and
-- user_profiles.role (mirror of the role in the currently *active*
-- business) in sync.
CREATE OR REPLACE FUNCTION public.update_member_role(target_user_id uuid, target_business_space_id uuid, new_role public.workspace_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF new_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot assign owner role through this action';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM business_space_members
    WHERE business_space_id = target_business_space_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
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

REVOKE ALL ON FUNCTION public.update_member_role(uuid, uuid, public.workspace_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, public.workspace_role) TO authenticated;

-- 6. Removing a member: same self-only-update problem, plus there was no
-- delete policy on user_profiles at all. If the removed member currently
-- has this business active, reassign them to another business they still
-- belong to first (business_space_id is NOT NULL, so they can't be left
-- pointing at nothing) - if they have none, block the removal rather than
-- leaving them with stale access to data they're no longer a member of.
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
      AND role IN ('owner', 'admin')
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

REVOKE ALL ON FUNCTION public.remove_business_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_business_member(uuid, uuid) TO authenticated;
