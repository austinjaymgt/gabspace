// Price IDs come from Stripe — tier `key` must match the `tier` metadata set
// on each Stripe Price (see API/stripe-webhook.js). Shared by Pricing.jsx and
// GetStarted.jsx so the two flows can't drift out of sync with each other.
export const TIERS = [
  {
    key: 'business',
    name: 'Business',
    tagline: 'For running one thing, beautifully.',
    monthlyPrice: 34,
    annualPrice: 326.4,
    priceIds: {
      monthly: 'price_1Tz35OEkYyhptbjVzB1ZGI9g',
      annual: 'price_1Tz35OEkYyhptbjV5kbWUXCj',
    },
    features: ['1 business profile', 'Clients, projects & deadlines', 'Core gabspace tools'],
  },
  {
    key: 'duo',
    name: 'Duo',
    tagline: 'For the people who run more than one thing.',
    monthlyPrice: 54,
    annualPrice: 518.4,
    priceIds: {
      monthly: 'price_1Tz35OEkYyhptbjVGinB1ZVP',
      annual: 'price_1Tz35NEkYyhptbjViccV4mLv',
    },
    features: ['2 business profiles', 'Orbi cross-business homescreen', 'Everything in Business'],
    popular: true,
  },
  {
    key: 'studio',
    name: 'Studio',
    tagline: 'For the full operation.',
    monthlyPrice: 89,
    annualPrice: 854.4,
    priceIds: {
      monthly: 'price_1Tz35OEkYyhptbjVPVjRlKJV',
      annual: 'price_1Tz35NEkYyhptbjV8YqZASCa',
    },
    features: ['3+ business profiles', 'Orbi scaled across every business', 'Everything in Duo'],
  },
]
