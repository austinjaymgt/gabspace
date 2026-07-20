-- Business name/logo and each member's display name/job title were all
-- stored on user_settings, keyed only by user_id - so switching between
-- businesses never changed what Settings/the sub-header/the dashboard
-- showed, since it was always the same single row regardless of which
-- business was active. Splits these into where they actually belong:
--   - name/logo -> business_spaces (one per business, owner/admin-edited)
--   - display_name/job_title -> business_space_members (one per person
--     per business, since the same person can present differently across
--     businesses they belong to)
-- user_settings.first_name stays as-is - that's a personal greeting, not
-- tied to any business.

ALTER TABLE public.business_spaces ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.business_space_members ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.business_space_members ADD COLUMN IF NOT EXISTS job_title text;

-- Backfill. business_spaces.name has never had an edit UI (it's set once
-- at creation), while user_settings.business_name is the field people
-- have actually been intentionally maintaining via Settings - prefer that
-- where it's set.
UPDATE public.business_spaces bs
SET name = us.business_name
FROM public.user_settings us
WHERE us.user_id = bs.owner_id
  AND us.business_name IS NOT NULL AND TRIM(us.business_name) != '';

UPDATE public.business_spaces bs
SET logo_url = us.logo_url
FROM public.user_settings us
WHERE us.user_id = bs.owner_id
  AND us.logo_url IS NOT NULL AND TRIM(us.logo_url) != '';

-- Seed every membership row with the user's current (previously global)
-- display name / job title as a starting point - they can differentiate
-- per business from here.
UPDATE public.business_space_members bsm
SET display_name = us.display_name, job_title = us.job_title
FROM public.user_settings us
WHERE us.user_id = bsm.user_id;

-- The existing business_spaces SELECT policy only allows seeing a
-- business if you own it or it's your currently *active* one - meaning a
-- member added to a second business couldn't see that business's row at
-- all (including through the switcher's embedded select) until they
-- switch into it, which they can't do without seeing it first. Add
-- membership-based visibility, matching the pattern already used for
-- business_space_members/user_settings/invites.
DROP POLICY IF EXISTS "business_spaces_select_member" ON public.business_spaces;
CREATE POLICY "business_spaces_select_member" ON public.business_spaces
  FOR SELECT USING (id IN (SELECT public.get_my_business_space_ids()));

-- Updating name/logo goes through this instead of a raw RLS policy
-- because business_spaces also has owner_id - a permissive UPDATE policy
-- for owner/admin members would let an admin reassign ownership to
-- themselves by writing that column too.
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
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this business';
  END IF;

  UPDATE business_spaces
  SET name = COALESCE(NULLIF(TRIM(new_name), ''), name),
      logo_url = new_logo_url
  WHERE id = target_business_space_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_business_identity(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_business_identity(uuid, text, text) TO authenticated;

-- Updating your own display name/job title for a given business. Self-only
-- (auth.uid() is implicit, not a parameter), and scoped to just these two
-- columns so it can't be used to touch role.
CREATE OR REPLACE FUNCTION public.update_my_business_profile(target_business_space_id uuid, new_display_name text, new_job_title text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE business_space_members
  SET display_name = new_display_name, job_title = new_job_title
  WHERE business_space_id = target_business_space_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this business';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_business_profile(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_business_profile(uuid, text, text) TO authenticated;
