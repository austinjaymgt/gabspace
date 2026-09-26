-- Same additive membership policies as 20260926020000, for the connector's
-- create_vendor tool (vendors) and log_expense / log_income, which match the
-- category against the business's expense/income category list
-- (budget_categories). Without these, both only work in the active
-- business. Existing active-business policies are untouched; client-role
-- members gain nothing. Categories are money data, so owner/co-owner only.
-- Rollback: supabase/rollback/20260926_membership_rls_down.sql

DROP POLICY IF EXISTS "vendors_staff_member" ON public.vendors;
CREATE POLICY "vendors_staff_member" ON public.vendors TO authenticated
  USING (public.is_business_staff(business_space_id))
  WITH CHECK (public.is_business_staff(business_space_id));

DROP POLICY IF EXISTS "budget_categories_manager_member" ON public.budget_categories;
CREATE POLICY "budget_categories_manager_member" ON public.budget_categories TO authenticated
  USING (public.can_manage_business(auth.uid(), business_space_id))
  WITH CHECK (public.can_manage_business(auth.uid(), business_space_id));
