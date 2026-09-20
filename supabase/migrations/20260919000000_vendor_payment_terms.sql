-- Payment terms (e.g. "Net-30", "Due on pickup") is vendor-specific billing
-- info distinct from tags (which are free-form, filterable labels) - give it
-- its own column so it renders as a dedicated detail field rather than
-- getting mixed into the tag filter list.
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS payment_terms text;
