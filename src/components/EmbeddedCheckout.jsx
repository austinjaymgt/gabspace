import { useCallback } from 'react'
import { EmbeddedCheckoutProvider, EmbeddedCheckout as StripeEmbeddedCheckout } from '@stripe/react-stripe-js'
import { stripePromise, createCheckoutSession } from '../utils/checkout'

// Renders Stripe's payment form inline (no redirect to checkout.stripe.com)
// for a single tier/billing-period combo. Used by both GetStarted.jsx
// (signup) and Pricing.jsx (in-app plan changes) so there's one checkout
// mechanism across the app.
export default function EmbeddedCheckout({ priceId, userId, isFounder = false }) {
  const fetchClientSecret = useCallback(
    () => createCheckoutSession({ priceId, userId, isFounder }),
    [priceId, userId, isFounder]
  )

  return (
    <div style={{ minHeight: '460px' }}>
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <StripeEmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}
