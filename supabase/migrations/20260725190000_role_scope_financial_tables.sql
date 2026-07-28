-- invoices/expenses/revenue RLS only checked business_space_id membership,
-- not role - so any member of a business (including the low-privilege
-- 'member'/'client'/'employee' roles) could read and write full financial
-- records directly via the Supabase client, even though the UI only ever
-- shows these pages to owners/admins (isOwnerOrAdmin gate in App.jsx).
-- Bring the RLS in line with what the UI already assumes.

DROP POLICY IF EXISTS "invoices_all" ON public.invoices;
CREATE POLICY "invoices_all" ON public.invoices
  USING (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'admin')
  ))
  WITH CHECK (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
CREATE POLICY "expenses_all" ON public.expenses
  USING (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'admin')
  ))
  WITH CHECK (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS "revenue_all" ON public.revenue;
CREATE POLICY "revenue_all" ON public.revenue
  USING (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'admin')
  ))
  WITH CHECK (business_space_id IN (
    SELECT user_profiles.business_space_id FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid() AND user_profiles.role IN ('owner', 'admin')
  ));
