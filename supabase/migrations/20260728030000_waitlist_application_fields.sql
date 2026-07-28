-- The gabspace-marketing static site (gabspace.io, a separate repo/deploy)
-- posts a richer "Founders Circle" application directly to this project's
-- REST API. It used to target beta_requests, but every piece of tooling
-- that acted on that table (BetaAdmin.jsx, notify-beta-request,
-- send-beta-confirmation) was removed when the beta gate was ungated - so
-- those submissions were landing somewhere nobody could see anymore.
-- Extending waitlist (nullable, so the in-app closed-signup form's plain
-- email-only inserts are unaffected) lets the marketing site's richer
-- application data land in the one place an admin can actually see it.
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS creative_type text,
  ADD COLUMN IF NOT EXISTS social_link text,
  ADD COLUMN IF NOT EXISTS how_heard text;
