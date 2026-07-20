-- The Team list resolves member names from user_profiles.display_name,
-- but that column is only ever set once at signup (from signup metadata)
-- and is never touched by the Settings UI afterward - it's effectively
-- always blank in practice. The name people actually keep current lives in
-- user_settings (first_name / display_name, edited under "Business
-- identity" in Settings), but that table's RLS is strictly self-only, so
-- teammates can't see each other's names there either. This adds
-- cross-member visibility, matching the same business-membership pattern
-- already used for business_space_members.
DROP POLICY IF EXISTS "user_settings_select_same_business" ON public.user_settings;
CREATE POLICY "user_settings_select_same_business" ON public.user_settings
  FOR SELECT USING (
    user_id IN (
      SELECT user_id FROM public.business_space_members
      WHERE business_space_id IN (SELECT public.get_my_business_space_ids())
    )
  );
