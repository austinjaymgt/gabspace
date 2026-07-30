-- Lets each user tune how many days ahead Orbi looks (1-7, default 3).
-- Account-wide like the rest of user_settings, not per-business, since
-- Orbi's feed already spans every business the user belongs to.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS orbi_window_days smallint NOT NULL DEFAULT 3;

ALTER TABLE public.user_settings
  ADD CONSTRAINT orbi_window_days_range CHECK (orbi_window_days BETWEEN 1 AND 7);
