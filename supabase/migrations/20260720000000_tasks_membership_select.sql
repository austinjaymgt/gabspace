-- tasks_all still scopes to the single *active* business_space_id on
-- user_profiles (pre-dates business_space_members / real multi-business
-- membership). The new person-level Home screen needs to read a member's
-- tasks across every business they belong to, not just whichever one is
-- currently active, so switch it to the membership-based function
-- (same pattern already used for goal_subtasks/resources/business_spaces).

DROP POLICY IF EXISTS "tasks_all" ON public.tasks;
CREATE POLICY "tasks_all" ON public.tasks
  USING (business_space_id IN (SELECT public.get_my_business_space_ids()))
  WITH CHECK (business_space_id IN (SELECT public.get_my_business_space_ids()));
