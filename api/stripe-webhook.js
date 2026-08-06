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

// Minimal escape for user-supplied strings (full_name, workspace_name) that
// get interpolated straight into the email HTML.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Same shell as supabase/functions/invite-user/index.ts's emailShell() — kept
// in sync by hand since one's a Deno edge function and this is a Node
// serverless function, but every transactional email should look identical.
function emailShell(eyebrow, eyebrowColor, heading, bodyHtml, ctaHref, ctaLabel, ctaColor) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${heading}</title>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:'Manrope',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;border:1px solid #E2E2E4;max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#2b0f2a,#160814);padding:28px 40px;border-radius:16px 16px 0 0;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7fd8ff,#4fa8e8 55%,#6a5cd0);"></td>
            <td style="width:10px;"></td>
            <td><span style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;">gabspace</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:${eyebrowColor};margin:0 0 12px;font-weight:600;">${eyebrow}</p>
          <h1 style="font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:26px;color:#2b1a2a;margin:0 0 16px;letter-spacing:-0.02em;">${heading}</h1>
          ${bodyHtml}
          <table cellpadding="0" cellspacing="0" style="margin:28px 0 4px;">
            <tr><td style="border-radius:10px;background:${ctaColor};">
              <a href="${ctaHref}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">${ctaLabel}</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #E2E2E4;">
          <p style="font-size:12px;color:#9CA3AF;margin:0;">© 2026 Gabspace · <a href="https://gabspace.io" style="color:#9CA3AF;text-decoration:none;">gabspace.io</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendWelcomeEmail(details) {
  if (!process.env.RESEND_API_KEY || !details?.email) return;

  const { email, fullName, workspaceName, tier, isFounder, monthlyAmount, interval } = details;
  const firstName = escapeHtml(fullName?.split(' ')[0] || 'there');
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
  const workspace = workspaceName ? escapeHtml(workspaceName) : 'your workspace';
  const heading = workspaceName ? `${workspace} is ready` : 'Welcome to gabspace';

  const eyebrow = isFounder ? "You're a founder" : "You're in";
  const eyebrowColor = isFounder ? '#e0399b' : '#6a3f7a';
  const bodyText = isFounder
    ? `Hi ${firstName} — you're locked in with Founder pricing on the <strong>${tierName}</strong> plan: 100% off, forever. Thanks for being one of the first in.`
    : `Hi ${firstName} — your 14-day free trial of the <strong>${tierName}</strong> plan has started. After that, you'll be billed $${monthlyAmount}/${interval}. Cancel anytime from Settings.`;
  const body = `<p style="font-size:15px;color:#6B7280;line-height:1.75;margin:0;">${bodyText}</p>`;

  const html = emailShell(eyebrow, eyebrowColor, heading, body, process.env.APP_URL, 'Open gabspace', eyebrowColor);

  try {
    const res = await fetch('https://api.resend.com/emails', {
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
    if (!res.ok) {
      console.error('Welcome email rejected by Resend:', res.status, await res.text());
    }
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