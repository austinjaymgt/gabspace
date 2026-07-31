import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Updates an existing subscription's price in place (with Stripe's standard
// proration — immediate prorated charge on upgrade, credit toward the next
// invoice on downgrade) instead of create-checkout-session.js's path, which
// always creates a brand-new subscription. Using that for an existing
// subscriber would leave them with two active subscriptions billing in
// parallel rather than a clean plan change.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { userId, priceId } = req.body;

    if (!userId || !priceId) {
      return res.status(400).json({ error: 'Missing userId or priceId' });
    }

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('owner_id', userId)
      .maybeSingle();

    if (subError || !sub?.stripe_subscription_id) {
      return res.status(404).json({ error: 'No active subscription to change' });
    }

    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const itemId = subscription.items.data[0].id;

    if (subscription.items.data[0].price.id === priceId) {
      return res.status(400).json({ error: 'Already on this plan' });
    }

    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
    });

    // The customer.subscription.updated webhook (api/stripe-webhook.js)
    // fires from this update and syncs tier/plan/profile_limit into
    // subscriptions and user_settings — nothing else to do here.
    res.status(200).json({ status: updated.status });
  } catch (err) {
    console.error('Change subscription error:', err);
    res.status(500).json({ error: 'Failed to change subscription' });
  }
}
