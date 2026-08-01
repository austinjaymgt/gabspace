import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { priceId, userId, isFounder } = req.body;

    if (!priceId || !userId) {
      return res.status(400).json({ error: 'Missing priceId or userId' });
    }

    // Look up the user's email from Supabase auth to prefill Checkout
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if this user already has a Stripe customer (avoid creating duplicates)
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('owner_id', userId)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userData.user.email,
        metadata: { owner_id: userId }, // critical — webhook uses this to match back to Supabase
      });
      customerId = customer.id;
    }

    const sessionParams = {
      customer: customerId,
      // Managed Payments (enabled by default on this Stripe account) picks
      // payment methods itself — passing payment_method_types explicitly is
      // a hard error on session creation.
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      // Embedded (renders inline on gabspace instead of redirecting to
      // checkout.stripe.com) — the frontend mounts this via client_secret
      // rather than navigating to a hosted url. 'embedded' is rejected on
      // this account's pinned API version ("no longer supported, use
      // embedded_page instead" — confirmed via a live 400 from Stripe).
      ui_mode: 'embedded_page',
      return_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    };

    // Apply the permanent founders coupon if this user was already flagged as
    // a founder (e.g. via admin panel). Otherwise let anyone self-serve enter
    // a promo code (like the founders code) at checkout — discounts and
    // allow_promotion_codes are mutually exclusive on a Checkout Session.
    if (isFounder) {
      sessionParams.discounts = [{ coupon: process.env.STRIPE_FOUNDERS_COUPON_ID }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.status(200).json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}