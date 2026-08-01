import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cancels at the end of the current paid period rather than immediately —
// the user keeps access through what they already paid for, no proration
// or refund needed. See api/resume-subscription.js for undoing this before
// the period ends.
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
      return res.status(404).json({ error: 'No active subscription to cancel' });
    }

    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // customer.subscription.updated webhook syncs cancel_at_period_end into
    // the subscriptions row — nothing else to do here.
    res.status(200).json({
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: updated.current_period_end,
    });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}
