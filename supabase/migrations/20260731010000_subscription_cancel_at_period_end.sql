-- Tracks whether a subscription is set to cancel at the end of its current
-- paid period (Settings -> Cancel subscription uses cancel_at_period_end,
-- not immediate cancellation, so the user keeps what they already paid
-- for). The webhook (customer.subscription.updated) already fires when
-- this flips, via api/cancel-subscription.js and api/resume-subscription.js.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
