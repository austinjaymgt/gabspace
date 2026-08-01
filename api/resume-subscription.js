import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Undoes a pending cancel_at_period_end (see api/cancel-subscription.js) —
// only works before the period actually ends, since after that Stripe has
// already deleted the subscription and this would need to be a brand-new
// one via create-checkout-session.js instead.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('owner_id', userId)
      .maybeSingle();

    if (subError || !sub?.stripe_subscription_id) {
      return res.status(404).json({ error: 'No subscription to resume' });
    }

    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    res.status(200).json({ cancelAtPeriodEnd: updated.cancel_at_period_end });
  } catch (err) {
    console.error('Resume subscription error:', err);
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
}
