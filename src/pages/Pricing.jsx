import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from '../components/Icon'
import { TIERS } from '../utils/pricingTiers'
import EmbeddedCheckoutForm from '../components/EmbeddedCheckout'

// Same plain light radial GetStarted.jsx uses — see the comment there for
// why this isn't var(--gradient-bg) (that resolves to the dark brand
// gradient under .force-light-theme).
const LIGHT_BG = 'radial-gradient(circle at 50% 0%, #f7f0f6 0%, #F5F5F7 70%)'

export default function Pricing({ session, onNavigate, mandatory = false, onLogout }) {
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [error, setError] = useState(null)
  const [currentPlan, setCurrentPlan] = useState(null)
  const [isFounder, setIsFounder] = useState(false)
  const [checkoutTier, setCheckoutTier] = useState(null)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('user_settings')
      .select('plan, is_founder')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCurrentPlan(data.plan)
          setIsFounder(!!data.is_founder)
        }
      })
  }, [session])

  // Fallback for someone who picked a plan during signup (GetStarted.jsx)
  // but landed here without finishing payment — e.g. closed the tab
  // mid-checkout. Pre-highlight what they already chose instead of making
  // them pick again from scratch.
  useEffect(() => {
    if (!mandatory) return
    const key = session?.user?.user_metadata?.selected_tier
    const period = session?.user?.user_metadata?.selected_billing_period
    if (key && TIERS.some(tier => tier.key === key)) {
      if (period === 'annual' || period === 'monthly') setBillingPeriod(period)
    }
  }, [mandatory, session])

  function handleChooseTier(tier) {
    if (!session?.user?.id) {
      setError('Please log in first.')
      return
    }
    setError(null)
    setCheckoutTier(tier)
  }

  const content = checkoutTier ? (
    <div style={{ padding: mandatory ? '0' : '32px', maxWidth: '560px', margin: mandatory ? '0 auto' : 0, fontFamily: t.fonts.sans }}>
      <button
        type="button"
        onClick={() => setCheckoutTier(null)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontFamily: t.fonts.sans,
          marginBottom: '20px',
        }}
      >
        <Icon name="back" size="sm" /> Choose a different plan
      </button>
      <div style={{ marginBottom: '20px', textAlign: mandatory ? 'center' : 'left' }}>
        <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 8px', fontFamily: t.fonts.heading }}>
          Start your {checkoutTier.name} trial
        </h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
          14 days free, then ${(billingPeriod === 'monthly' ? checkoutTier.monthlyPrice : checkoutTier.annualPrice / 12).toFixed(0)}/mo. Cancel anytime.
        </p>
      </div>
      <EmbeddedCheckoutForm
        priceId={checkoutTier.priceIds[billingPeriod]}
        userId={session.user.id}
        isFounder={isFounder}
      />
    </div>
  ) : (
    <div style={{ padding: mandatory ? '0' : '32px', maxWidth: '1040px', fontFamily: t.fonts.sans }}>
      {!mandatory && onNavigate && (
        <button
          onClick={() => onNavigate('settings')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontFamily: t.fonts.sans,
            marginBottom: '20px',
          }}
        >
          <Icon name="back" size="sm" /> Back to settings
        </button>
      )}

      {mandatory && onLogout && (
        <button
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontFamily: t.fonts.sans,
            marginBottom: '20px',
          }}
        >
          Sign out
        </button>
      )}

      <div style={{ marginBottom: '32px', textAlign: mandatory ? 'center' : 'left' }}>
        <h2 style={{ fontSize: t.fontSizes.h1, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 8px', fontFamily: t.fonts.heading }}>
          {mandatory ? "You're almost in" : 'Choose your plan'}
        </h2>
        <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: mandatory ? '0 auto' : 0, maxWidth: '520px' }}>
          {mandatory
            ? 'Pick a plan to start your trial and get into your workspace.'
            : 'Every plan includes the full gabspace toolkit — the difference is how many businesses you can run at once. 14-day trial on all plans.'}
        </p>
      </div>

      {/* ── Billing toggle ── */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '2px',
        backgroundColor: t.colors.bg, border: `1px solid ${t.colors.border}`,
        borderRadius: t.radius.full, padding: '4px', marginBottom: '32px',
      }}>
        {['monthly', 'annual'].map((period) => (
          <button
            key={period}
            onClick={() => setBillingPeriod(period)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', borderRadius: t.radius.full, border: 'none',
              backgroundColor: billingPeriod === period ? t.colors.bgCard : 'transparent',
              boxShadow: billingPeriod === period ? t.shadows.sm : 'none',
              color: billingPeriod === period ? t.colors.textPrimary : t.colors.textTertiary,
              fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans,
              transition: 'background-color 0.15s',
            }}
          >
            {period === 'monthly' ? 'Monthly' : 'Annual'}
            {period === 'annual' && (
              <span style={{
                fontSize: t.fontSizes.xs, fontWeight: '700', color: t.colors.success,
                backgroundColor: t.colors.successLight, padding: '2px 8px', borderRadius: t.radius.full,
              }}>
                Save 20%
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight,
          color: t.colors.danger, fontSize: t.fontSizes.sm, marginBottom: '24px',
        }}>
          {error}
        </div>
      )}

      {/* ── Tier cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px',
        alignItems: 'start',
      }}>
        {TIERS.map((tier) => {
          const price = billingPeriod === 'monthly' ? tier.monthlyPrice : tier.annualPrice / 12
          const isCurrent = currentPlan === tier.key
          return (
            <div
              key={tier.key}
              style={{
                position: 'relative',
                backgroundColor: t.colors.bgCard,
                borderRadius: t.radius.card,
                border: tier.popular ? `2px solid ${t.colors.primary}` : `1px solid ${t.colors.borderLight}`,
                boxShadow: tier.popular ? t.shadows.lg : t.shadows.sm,
                padding: '28px 24px',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {tier.popular && (
                <div style={{
                  position: 'absolute', top: '-13px', left: '24px',
                  backgroundColor: t.colors.primary, color: t.colors.textInverse,
                  fontSize: t.fontSizes.xs, fontWeight: '700', letterSpacing: '0.04em',
                  padding: '4px 12px', borderRadius: t.radius.full,
                }}>
                  MOST POPULAR
                </div>
              )}

              <h3 style={{ fontSize: t.fontSizes.xl, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px', fontFamily: t.fonts.heading }}>
                {tier.name}
              </h3>
              <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: '0 0 20px', minHeight: '36px' }}>
                {tier.tagline}
              </p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '34px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading }}>
                  ${price.toFixed(0)}
                </span>
                <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>/mo</span>
              </div>
              <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginBottom: '20px', minHeight: '16px' }}>
                {billingPeriod === 'annual' ? `billed $${tier.annualPrice.toFixed(2)}/yr` : ' '}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {tier.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
                    <span style={{ color: t.colors.success, fontWeight: '700', flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleChooseTier(tier)}
                disabled={isCurrent}
                style={{
                  padding: '13px 20px', borderRadius: t.radius.full, border: 'none',
                  backgroundColor: isCurrent ? t.colors.bg : (tier.popular ? t.colors.primary : t.colors.textPrimary),
                  color: isCurrent ? t.colors.textTertiary : t.colors.textInverse,
                  fontSize: t.fontSizes.md, fontWeight: '600', fontFamily: t.fonts.sans,
                  cursor: isCurrent ? 'default' : 'pointer',
                }}
              >
                {isCurrent ? 'Current plan' : `Choose ${tier.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {isFounder && (
        <p style={{ fontSize: t.fontSizes.sm, color: t.colors.primary, marginTop: '24px' }}>
          You're on founding-member pricing — locked in permanently.
        </p>
      )}
      <p style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '12px', textAlign: mandatory ? 'center' : 'left' }}>
        14-day trial on all plans. Cancel anytime.
      </p>
    </div>
  )

  if (!mandatory) return content

  return (
    <div className="force-light-theme" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.colors.bg, backgroundImage: LIGHT_BG, fontFamily: t.fonts.sans,
      padding: '40px 24px', boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: '1040px' }}>
        {content}
      </div>
    </div>
  )
}
