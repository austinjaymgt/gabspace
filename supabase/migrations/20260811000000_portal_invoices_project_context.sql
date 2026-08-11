-- The client portal shows an invoice's line items but not which project it
-- belongs to, so a client with multiple projects can't tell them apart.
-- Add project_id/title to the existing get_portal_invoices RPC (same
-- SECURITY DEFINER shape, just two more columns from a LEFT JOIN since
-- invoices.project_id is nullable).

-- CREATE OR REPLACE can't change a RETURNS TABLE column set, so drop first.
DROP FUNCTION IF EXISTS public.get_portal_invoices(text);

CREATE FUNCTION public.get_portal_invoices(p_token text)
 RETURNS TABLE (
   id uuid,
   invoice_number text,
   status text,
   due_date date,
   sent_at timestamptz,
   paid_date date,
   total_amount numeric,
   amount_paid numeric,
   created_at timestamptz,
   line_items jsonb,
   project_id uuid,
   project_title text
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    i.id, i.invoice_number, i.status, i.due_date, i.sent_at, i.paid_date,
    i.total_amount, i.amount_paid, i.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'description', li.description,
        'quantity', li.quantity,
        'unit_price', li.unit_price,
        'total', li.total
      ))
      FROM line_items li WHERE li.invoice_id = i.id
    ), '[]'::jsonb) AS line_items,
    p.id AS project_id,
    p.title AS project_title
  FROM invoices i
  JOIN portal_links pl ON pl.client_id = i.client_id
  LEFT JOIN projects p ON p.id = i.project_id
  WHERE pl.token = p_token AND pl.status = 'active' AND i.status != 'draft'
  ORDER BY i.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_portal_invoices(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_invoices(text) TO anon, authenticated;
