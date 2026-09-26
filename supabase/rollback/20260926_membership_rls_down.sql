-- Rollback for 20260926020000_membership_rls_for_tool_tables.sql
--
-- NOT a migration — run by hand only if the membership policies need to be
-- removed. Drops only the policies that migration added; the original
-- active-business policies were never touched, so access returns to exactly
-- what it was before. No data is deleted. The MCP server will then only see
-- the active business again (other businesses come back empty), so also
-- redeploy the mcp function from before this change. Afterwards, remove the
-- row from supabase_migrations.schema_migrations (at the bottom).

BEGIN;

DROP POLICY IF EXISTS "clients_staff_member" ON public.clients;
DROP POLICY IF EXISTS "projects_staff_member" ON public.projects;
DROP POLICY IF EXISTS "tasks_staff_member" ON public.tasks;
DROP POLICY IF EXISTS "project_milestones_staff_member" ON public.project_milestones;
DROP POLICY IF EXISTS "content_calendar_staff_member" ON public.content_calendar;
DROP POLICY IF EXISTS "business_events_staff_member" ON public.business_events;
DROP POLICY IF EXISTS "invoices_manager_member" ON public.invoices;
DROP POLICY IF EXISTS "revenue_manager_member" ON public.revenue;
DROP POLICY IF EXISTS "expenses_manager_member" ON public.expenses;
DROP POLICY IF EXISTS "line_items_manager_member" ON public.line_items;
DROP POLICY IF EXISTS "invoice_payments_manager_member" ON public.invoice_payments;

DROP FUNCTION IF EXISTS public.is_business_staff(uuid);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260926020000';

COMMIT;
