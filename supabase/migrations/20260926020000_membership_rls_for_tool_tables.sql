-- Most business tables only expose rows for the caller's *active* business
-- (user_profiles.business_space_id). That's fine for the web app, which
-- always queries the active business, but it means the Claude connector
-- (supabase/functions/mcp) can't read or write any of the user's other
-- businesses, even ones they own - the query just comes back empty.
--
-- This ADDS a membership-based policy alongside each existing one. RLS
-- permissive policies are OR'd, and none of these tables have restrictive
-- policies, so:
--   - nobody loses any access they have today (existing policies untouched)
--   - staff (owner/co-owner/employee) gain the same access to every
--     non-archived business they're a member of
--   - money tables (invoices, line items, payments, revenue, expenses) stay
--     owner/co-owner only, matching the existing role scoping
--   - client-role members gain nothing
-- The web app is unaffected: every page filters by the active business id.
-- Rollback: supabase/rollback/20260926_membership_rls_down.sql

-- Caller is staff on this (non-archived) business. SECURITY DEFINER so the
-- membership lookup isn't itself subject to RLS on business_space_members.
CREATE OR REPLACE FUNCTION public.is_business_staff(bs_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM business_space_members m
    JOIN business_spaces bs ON bs.id = m.business_space_id
    WHERE m.user_id = auth.uid()
      AND m.business_space_id = bs_id
      AND m.role IN ('owner', 'co-owner', 'employee')
      AND bs.archived_at IS NULL
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_business_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_staff(uuid) TO authenticated;

-- ── Staff tables ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "clients_staff_member" ON public.clients;
CREATE POLICY "clients_staff_member" ON public.clients TO authenticated
  USING (public.is_business_staff(business_space_id))
  WITH CHECK (public.is_business_staff(business_space_id));

DROP POLICY IF EXISTS "projects_staff_member" ON public.projects;
CREATE POLICY "projects_staff_member" ON public.projects TO authenticated
  USING (public.is_business_staff(business_space_id))
  WITH CHECK (public.is_business_staff(business_space_id));

DROP POLICY IF EXISTS "tasks_staff_member" ON public.tasks;
CREATE POLICY "tasks_staff_member" ON public.tasks TO authenticated
  USING (public.is_business_staff(business_space_id))
  WITH CHECK (public.is_business_staff(business_space_id));

DROP POLICY IF EXISTS "project_milestones_staff_member" ON public.project_milestones;
CREATE POLICY "project_milestones_staff_member" ON public.project_milestones TO authenticated
  USING (public.is_business_staff(business_space_id))
  WITH CHECK (public.is_business_staff(business_space_id));

DROP POLICY IF EXISTS "content_calendar_staff_member" ON public.content_calendar;
CREATE POLICY "content_calendar_staff_member" ON public.content_calendar TO authenticated
  USING (public.is_business_staff(business_space_id))
  WITH CHECK (public.is_business_staff(business_space_id));

DROP POLICY IF EXISTS "business_events_staff_member" ON public.business_events;
CREATE POLICY "business_events_staff_member" ON public.business_events TO authenticated
  USING (public.is_business_staff(business_space_id))
  WITH CHECK (public.is_business_staff(business_space_id));

-- ── Money tables: owner/co-owner only ───────────────────────────────────

DROP POLICY IF EXISTS "invoices_manager_member" ON public.invoices;
CREATE POLICY "invoices_manager_member" ON public.invoices TO authenticated
  USING (public.can_manage_business(auth.uid(), business_space_id))
  WITH CHECK (public.can_manage_business(auth.uid(), business_space_id));

DROP POLICY IF EXISTS "revenue_manager_member" ON public.revenue;
CREATE POLICY "revenue_manager_member" ON public.revenue TO authenticated
  USING (public.can_manage_business(auth.uid(), business_space_id))
  WITH CHECK (public.can_manage_business(auth.uid(), business_space_id));

DROP POLICY IF EXISTS "expenses_manager_member" ON public.expenses;
CREATE POLICY "expenses_manager_member" ON public.expenses TO authenticated
  USING (public.can_manage_business(auth.uid(), business_space_id))
  WITH CHECK (public.can_manage_business(auth.uid(), business_space_id));

-- Child tables of invoices have no business_space_id of their own.
DROP POLICY IF EXISTS "line_items_manager_member" ON public.line_items;
CREATE POLICY "line_items_manager_member" ON public.line_items TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_manage_business(auth.uid(), i.business_space_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_manage_business(auth.uid(), i.business_space_id)));

DROP POLICY IF EXISTS "invoice_payments_manager_member" ON public.invoice_payments;
CREATE POLICY "invoice_payments_manager_member" ON public.invoice_payments TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_manage_business(auth.uid(), i.business_space_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.can_manage_business(auth.uid(), i.business_space_id)));
