-- Tracks multiple discrete payments per invoice instead of a single
-- manually-incremented amount_paid figure. invoices.amount_paid stays as a
-- stored-for-query-convenience column, but it's now derived — same
-- trigger-owns-the-aggregate pattern as line_items -> invoices.total_amount.

CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paid_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- Same shape as line_items_all: scoped indirectly through the parent invoice.
CREATE POLICY "invoice_payments_all" ON public.invoice_payments
  USING (invoice_id IN (
    SELECT invoices.id FROM public.invoices
    WHERE invoices.business_space_id IN (
      SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()
    )
  ))
  WITH CHECK (invoice_id IN (
    SELECT invoices.id FROM public.invoices
    WHERE invoices.business_space_id IN (
      SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()
    )
  ));

-- Recomputes amount_paid from the sum of payments, and moves status into/
-- out of 'paid' as that crosses total_amount. Only flips a 'paid' invoice
-- back to 'sent' (never back to 'draft') since a draft invoice couldn't
-- have received a payment through the app's own gating in the first place
-- without also being editable back to draft, which isn't a thing here.
CREATE OR REPLACE FUNCTION public.recalc_invoice_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_invoice_id uuid;
  new_amount_paid numeric;
  invoice_total numeric;
  current_status text;
  is_now_paid boolean;
BEGIN
  affected_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount), 0) INTO new_amount_paid
  FROM invoice_payments WHERE invoice_id = affected_invoice_id;

  SELECT total_amount, status INTO invoice_total, current_status
  FROM invoices WHERE id = affected_invoice_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  is_now_paid := invoice_total > 0 AND new_amount_paid >= invoice_total;

  UPDATE invoices SET
    amount_paid = new_amount_paid,
    status = CASE
      WHEN is_now_paid THEN 'paid'
      WHEN current_status = 'paid' THEN 'sent'
      ELSE current_status
    END,
    paid_date = CASE
      WHEN is_now_paid THEN (SELECT MAX(paid_date) FROM invoice_payments WHERE invoice_id = affected_invoice_id)
      WHEN current_status = 'paid' THEN NULL
      ELSE paid_date
    END
  WHERE id = affected_invoice_id;

  RETURN NULL;
END;
$function$;

CREATE TRIGGER invoice_payments_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_paid();

-- Preserve payment history for invoices that already had amount_paid set
-- directly (before this table existed) as a single backfilled payment.
INSERT INTO invoice_payments (invoice_id, amount, paid_date, note)
SELECT id, amount_paid, COALESCE(paid_date, created_at::date), 'Backfilled from prior single-payment total'
FROM invoices
WHERE amount_paid > 0;
