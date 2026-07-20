-- Recurring invoice generation runs entirely in Postgres via pg_cron: v1
-- only ever produces 'draft' invoices (no auto-send), so there's no need
-- for an edge function in the loop at all — this is pure data generation.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- SECURITY DEFINER: this runs unattended (no auth.uid()), so it must
-- bypass RLS to touch every business space's rules, not just one caller's.
CREATE OR REPLACE FUNCTION public.generate_recurring_invoices()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rule RECORD;
  new_invoice_id uuid;
  owner_user_id uuid;
BEGIN
  FOR rule IN
    SELECT * FROM recurring_invoice_rules
    WHERE active = true AND next_run_date <= CURRENT_DATE
  LOOP
    SELECT owner_id INTO owner_user_id FROM business_spaces WHERE id = rule.business_space_id;

    INSERT INTO invoices (
      user_id, business_space_id, client_id, project_id,
      status, due_date, recurring_rule_id
    ) VALUES (
      owner_user_id, rule.business_space_id, rule.client_id, rule.project_id,
      'draft', rule.next_run_date, rule.id
    )
    RETURNING id INTO new_invoice_id;

    INSERT INTO line_items (invoice_id, description, quantity, unit_price)
    SELECT new_invoice_id, description, quantity, unit_price
    FROM recurring_invoice_rule_line_items
    WHERE recurring_rule_id = rule.id;

    -- Advances unconditionally regardless of whether the prior draft has
    -- been reviewed/sent yet — the schedule doesn't wait on review.
    UPDATE recurring_invoice_rules
    SET next_run_date = CASE rule.frequency
      WHEN 'weekly' THEN rule.next_run_date + INTERVAL '7 days'
      WHEN 'monthly' THEN rule.next_run_date + INTERVAL '1 month'
      WHEN 'custom' THEN rule.next_run_date + (rule.interval_days::text || ' days')::interval
    END
    WHERE id = rule.id;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_recurring_invoices() FROM PUBLIC;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'generate-recurring-invoices';

SELECT cron.schedule(
  'generate-recurring-invoices',
  '0 6 * * *',
  $$SELECT public.generate_recurring_invoices();$$
);
