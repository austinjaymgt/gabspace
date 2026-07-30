// Thin wrapper around the checkout-session API so Pricing.jsx (manual plan
// changes) and GetStarted.jsx (auto-checkout right after email
// confirmation) don't duplicate this fetch.
export async function createCheckoutSession({ priceId, userId, isFounder }) {
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId, userId, isFounder }),
  })
  if (!res.ok) throw new Error('Checkout session failed')
  const { url } = await res.json()
  return url
}
