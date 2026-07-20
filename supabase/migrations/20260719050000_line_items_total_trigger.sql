-- invoices.total_amount is stored for query convenience but must always
-- equal SUM(line_items.total) for its invoice, and line_items.total must
-- always equal quantity * unit_price. Rather than recomputing either in
-- every place that touches line items (the UI form, and the
-- recurring-invoice generator added next), triggers are the single source
-- of truth: they fire identically whether a human edits line items or
-- generate_recurring_invoices() copies them from a template.

CREATE OR REPLACE FUNCTION public.set_line_item_total()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.total := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER line_items_set_total
  BEFORE INSERT OR UPDATE OF quantity, unit_price ON public.line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_line_item_total();

CREATE OR REPLACE FUNCTION public.recalc_invoice_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_invoice_id uuid;
BEGIN
  affected_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  UPDATE invoices
  SET total_amount = COALESCE((
    SELECT SUM(total) FROM line_items WHERE invoice_id = affected_invoice_id
  ), 0)
  WHERE id = affected_invoice_id;

  RETURN NULL;
END;
$function$;

CREATE TRIGGER line_items_recalc_invoice_total
  AFTER INSERT OR UPDATE OR DELETE ON public.line_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_total();
