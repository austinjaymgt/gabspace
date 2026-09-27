-- The Orbi tour auto-starts for brand-new accounts only (see App.jsx —
-- it also requires onboarding_intro_seen = false, which every existing
-- account was backfilled to true), so no backfill is needed here. Once a
-- user finishes or skips it, this stops it from starting again; they can
-- still replay it from the profile menu.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS tour_completed boolean NOT NULL DEFAULT false;
