-- Recurring invoice rules: a template that generate_recurring_invoices()
-- (next migration) turns into draft invoices on a schedule.
--
-- client_id is ON DELETE CASCADE, not SET NULL like invoices/projects use:
-- a rule with no client can never fire meaningfully again, so deleting the
-- client that owns it deletes the rule (and its template line items) too,
-- the same way contacts/notes already cascade off a deleted client.

CREATE TABLE public.recurring_invoice_rules (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  business_space_id uuid NOT NULL REFERENCES public.business_spaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'custom')),
  interval_days integer,
  next_run_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT recurring_invoice_rules_custom_interval CHECK (
    frequency != 'custom' OR interval_days IS NOT NULL
  )
);

CREATE TABLE public.recurring_invoice_rule_line_items (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  recurring_rule_id uuid NOT NULL REFERENCES public.recurring_invoice_rules(id) ON DELETE CASCADE,
  description text,
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- A generated invoice keeps its history if the rule is later deleted; only
-- the link back to the (now-gone) rule is cleared.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS recurring_rule_id uuid REFERENCES public.recurring_invoice_rules(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_invoice_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoice_rule_line_items ENABLE ROW LEVEL SECURITY;

-- Same shape as clients_all/invoices_all: scoped to the caller's current
-- business space.
CREATE POLICY "recurring_invoice_rules_all" ON public.recurring_invoice_rules
  USING (business_space_id IN (SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()))
  WITH CHECK (business_space_id IN (SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()));

-- Same shape as line_items_all: scoped indirectly through the parent rule.
CREATE POLICY "recurring_invoice_rule_line_items_all" ON public.recurring_invoice_rule_line_items
  USING (recurring_rule_id IN (
    SELECT recurring_invoice_rules.id FROM public.recurring_invoice_rules
    WHERE recurring_invoice_rules.business_space_id IN (
      SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()
    )
  ))
  WITH CHECK (recurring_rule_id IN (
    SELECT recurring_invoice_rules.id FROM public.recurring_invoice_rules
    WHERE recurring_invoice_rules.business_space_id IN (
      SELECT user_profiles.business_space_id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()
    )
  ));
