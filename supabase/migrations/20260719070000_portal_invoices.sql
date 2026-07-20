-- Lets a client's portal view (?portal=<token>, no auth) show that
-- client's non-draft invoices without opening up invoices/line_items RLS.
-- invoices contains financial data, so unlike the existing portal tables
-- this goes through a SECURITY DEFINER function that checks the token
-- server-side and returns only the matching rows, rather than a USING(true)
-- policy anyone with the anon key could enumerate.

CREATE OR REPLACE FUNCTION public.get_portal_invoices(p_token text)
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
   line_items jsonb
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
    ), '[]'::jsonb) AS line_items
  FROM invoices i
  JOIN portal_links pl ON pl.client_id = i.client_id
  WHERE pl.token = p_token AND pl.status = 'active' AND i.status != 'draft'
  ORDER BY i.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_portal_invoices(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_invoices(text) TO anon, authenticated;
