-- Lets expenses be grouped by vendor. The vendors table (and its
-- vendors_all RLS policy) already exists from baseline_schema, reused
-- as-is from the existing Vendors directory page - this just adds the
-- link from the expense side. Nullable: existing/unassigned expenses
-- fall back to an "Uncategorized" group in the UI rather than being blocked.
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;
