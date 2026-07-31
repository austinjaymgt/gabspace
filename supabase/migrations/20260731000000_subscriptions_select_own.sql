-- public.subscriptions has RLS enabled (via whatever created it — no
-- migration in this repo did) but zero policies, so nothing short of the
-- service role can read it today. Pricing.jsx needs to check whether the
-- signed-in user already has an active subscription (to decide: update the
-- existing one in place vs. create a new one via Checkout) — scope reads to
-- each user's own row, same shape as every other owner-scoped table here.
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
