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
      // Only checkout.session.completed triggers the welcome email — it fires
      // once per successful checkout, unlike subscription.created/updated
      // which also fire on renewals, upgrades, and cancellations.
      case 'checkout.session.completed': {
        const subscription = await stripe.subscriptions.retrieve(event.data.object.subscription);
        const details = await syncSubscription(subscription);
        await sendWelcomeEmail(details);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await syncSubscription(event.data.object);
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
  const item = subscription.items.data[0];
  const price = item.price;
  const tier = price.metadata.tier; // e.g. 'business', 'duo', 'studio'
  const profileLimit = parseInt(price.metadata.profile_limit, 10);
  const billingPeriod = price.recurring.interval === 'year' ? 'annual' : 'monthly';
  // Match by coupon ID, not display name — coupon names are freeform ("Founder's
  // Circle") and drift, but the ID is the same one used to apply the discount
  // in create-checkout-session.js.
  const isFounder = subscription.discount?.coupon?.id === process.env.STRIPE_FOUNDERS_COUPON_ID;

  const customer = await stripe.customers.retrieve(subscription.customer);
  const ownerId = customer.metadata.owner_id; // set this when creating the customer at checkout

  const { data: userData } = await supabase.auth.admin.getUserById(ownerId);
  const fullName = userData?.user?.user_metadata?.full_name;
  const workspaceName = userData?.user?.user_metadata?.workspace_name;

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
    // current_period_end moved from the top-level Subscription object down to
    // each subscription item in this account's pinned API version.
    current_period_end: new Date(item.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id' });

  // Enforce profile limit — flip least-recently-active spaces to read_only if over limit
  await enforceProfileLimit(ownerId, profileLimit, isFounder);

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

  return {
    email: customer.email,
    fullName,
    workspaceName,
    tier,
    billingPeriod,
    isFounder,
    monthlyAmount: price.unit_amount / 100,
    interval: price.recurring.interval,
  };
}

async function sendWelcomeEmail(details) {
  if (!process.env.RESEND_API_KEY || !details?.email) return;

  const { email, fullName, workspaceName, tier, isFounder, monthlyAmount, interval } = details;
  const firstName = fullName?.split(' ')[0] || 'there';
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);

  const planLine = isFounder
    ? `You're in as a Founder — 100% off the ${tierName} plan, forever. Thanks for being one of the first in.`
    : `Your 14-day free trial of the ${tierName} plan has started. After that, you'll be billed $${monthlyAmount}/${interval} — cancel anytime from Settings.`;

  const html = `
    <p>Hi ${firstName},</p>
    <p>Welcome to gabspace${workspaceName ? ` — ${workspaceName} is ready to go` : ''}.</p>
    <p>${planLine}</p>
    <p><a href="${process.env.APP_URL}">Head into your workspace →</a></p>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: 'Welcome to gabspace',
        html,
      }),
    });
  } catch (err) {
    // Don't fail the webhook over a non-critical email delivery issue —
    // Stripe would retry the whole event otherwise.
    console.error('Welcome email failed:', err);
  }
}

async function enforceProfileLimit(ownerId, profileLimit, isFounder) {
  const { data: spaces } = await supabase
    .from('business_spaces')
    .select('id, last_active_at')
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .order('last_active_at', { ascending: false }); // most recent first

  // Founders are unlimited regardless of the price tier's profile_limit —
  // billing status shouldn't be able to cap founder access.
  if (isFounder) {
    if (spaces?.length) {
      await supabase
        .from('business_spaces')
        .update({ access_status: 'active' })
        .in('id', spaces.map(s => s.id));
    }
    return;
  }

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