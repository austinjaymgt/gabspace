-- Invoicing v1: invoices.status becomes an app-lifecycle field only
-- (draft -> sent -> paid). "partial" and "overdue" are never stored; they're
-- derived in the UI from amount_paid/total_amount and due_date. The
-- existing Invoices.jsx let users set status='overdue' directly, so that's
-- backfilled to 'sent' before the constraint goes on.

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sent_at timestamptz;

UPDATE public.invoices SET status = 'sent' WHERE status = 'overdue';

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid'));
