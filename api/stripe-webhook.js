import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role bypasses RLS — needed for webhook writes
);

// Vercel needs the raw body for Stripe signature verification
export const config = {
  api: { bodyParser: false },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.type === 'checkout.session.completed'
          ? await stripe.subscriptions.retrieve(event.data.object.subscription)
          : event.data.object;

        await syncSubscription(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', event.data.object.id);
        break;
      }

      default:
        // Ignore other event types
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function syncSubscription(subscription) {
  const price = subscription.items.data[0].price;
  const tier = price.metadata.tier; // e.g. 'business', 'duo', 'studio'
  const profileLimit = parseInt(price.metadata.profile_limit, 10);
  const billingPeriod = price.recurring.interval === 'year' ? 'annual' : 'monthly';
  const isFounder = subscription.discount?.coupon?.name === 'founders'; // adjust to your coupon's actual name/id

  const customer = await stripe.customers.retrieve(subscription.customer);
  const ownerId = customer.metadata.owner_id; // set this when creating the customer at checkout

  // Upsert subscription row
  await supabase.from('subscriptions').upsert({
    owner_id: ownerId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    tier,
    billing_period: billingPeriod,
    status: subscription.status,
    profile_limit: profileLimit,
    is_founder: isFounder,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id' });

  // Enforce profile limit — flip least-recently-active spaces to read_only if over limit
  await enforceProfileLimit(ownerId, profileLimit);

  // Mirror the tier onto user_settings.plan — that's what create_business_space()
  // reads for the per-user business cap, and what Settings/Pricing display.
  // requires_checkout=false clears the mandatory checkout gate new owners
  // hit post-signup (see the 20260730130000 migration). Runs as
  // service_role, which enforce_plan_immutable() lets bypass the admin-only
  // guard.
  await supabase
    .from('user_settings')
    .update({ plan: tier, is_founder: isFounder, requires_checkout: false })
    .eq('user_id', ownerId);
}

async function enforceProfileLimit(ownerId, profileLimit) {
  const { data: spaces } = await supabase
    .from('business_spaces')
    .select('id, last_active_at')
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .order('last_active_at', { ascending: false }); // most recent first

  if (!spaces || spaces.length <= profileLimit) {
    // Under or at limit — make sure everything's active
    if (spaces?.length) {
      await supabase
        .from('business_spaces')
        .update({ access_status: 'active' })
        .in('id', spaces.map(s => s.id));
    }
    return;
  }

  const keepActive = spaces.slice(0, profileLimit).map(s => s.id);
  const makeReadOnly = spaces.slice(profileLimit).map(s => s.id);

  await supabase.from('business_spaces').update({ access_status: 'active' }).in('id', keepActive);
  await supabase.from('business_spaces').update({ access_status: 'read_only' }).in('id', makeReadOnly);
}