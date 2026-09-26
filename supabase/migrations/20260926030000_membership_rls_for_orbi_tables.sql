-- Same additive membership policy as 20260926020000, for the two remaining
-- tables Orbi's briefing reads (src/utils/orbiItems.js): events and
-- team_goals. The briefing now spans every business the user is staff on,
-- and without these it would silently leave out other businesses' events
-- and goals. Existing active-business policies are untouched; client-role
-- members gain nothing.
-- Rollback: supabase/rollback/20260926_membership_rls_down.sql

DROP POLICY IF EXISTS "events_staff_member" ON public.events;
CREATE POLICY "events_staff_member" ON public.events TO authenticated
  USING (public.is_business_staff(business_space_id))
  WITH CHECK (public.is_business_staff(business_space_id));

DROP POLICY IF EXISTS "team_goals_staff_member" ON public.team_goals;
CREATE POLICY "team_goals_staff_member" ON public.team_goals TO authenticated
  USING (public.is_business_staff(business_space_id))
  WITH CHECK (public.is_business_staff(business_space_id));
