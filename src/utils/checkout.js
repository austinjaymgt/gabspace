import { loadStripe } from '@stripe/stripe-js'

// Singleton — loadStripe() shouldn't be called more than once per publishable key.
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// Thin wrapper around the checkout-session API so Pricing.jsx and
// GetStarted.jsx (via EmbeddedCheckout's fetchClientSecret) don't duplicate
// this fetch. Returns a client_secret for Stripe's embedded checkout, not a
// redirect url — see api/create-checkout-session.js (ui_mode: 'embedded_page').
// Only for brand-new subscriptions — see changeSubscription for existing ones.
export async function createCheckoutSession({ priceId, userId, isFounder }) {
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId, userId, isFounder }),
  })
  if (!res.ok) throw new Error('Checkout session failed')
  const { clientSecret } = await res.json()
  return clientSecret
}

// For an existing subscriber changing plans — updates their subscription's
// price in place (Stripe prorates automatically) instead of creating a
// second, parallel subscription. See api/change-subscription.js.
export async function changeSubscription({ userId, priceId }) {
  const res = await fetch('/api/change-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, priceId }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}))
    throw new Error(error || 'Failed to change subscription')
  }
}
