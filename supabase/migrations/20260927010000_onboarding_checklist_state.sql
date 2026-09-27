-- The Getting Started checklist used to open only when the URL was
-- /welcome, which a new owner never reaches after paying (Stripe returns
-- to /billing/success). It's now driven purely by user_settings, so the
-- full checklist opens once and, after that, starts as the minimized pill
-- on every load until it's finished or hidden.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS onboarding_intro_seen boolean NOT NULL DEFAULT false;
