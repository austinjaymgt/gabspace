import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import gabspaceLockup from '../assets/gabspace-lockup-dark-bg.svg'
import { TIERS } from '../utils/pricingTiers'
import EmbeddedCheckout from '../components/EmbeddedCheckout'

// Reads ?tier=business|duo|studio from a marketing-site pricing card link
// (see gabspace-marketing/index.html) so the plan step arrives pre-selected.
function initialTierFromUrl() {
  const key = new URLSearchParams(window.location.search).get('tier')
  return TIERS.find(tier => tier.key === key)?.key || TIERS.find(tier => tier.popular)?.key || TIERS[0].key
}

// A plain light radial — NOT var(--gradient-bg), which under
// .force-light-theme resolves to the dark plum brand gradient (intentional
// for the existing sign-in card's dark-backdrop look, kept as-is there).
// Account creation through payment should read as one consistent light
// surface instead.
const LIGHT_BG = 'radial-gradient(circle at 50% 0%, #f7f0f6 0%, #F5F5F7 70%)'

const inputStyle = { padding: '10px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans, width: '100%', boxSizing: 'border-box' }
const labelStyle = { fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }

export default function GetStarted({ onBackToLogin }) {
  const [signupsOpen, setSignupsOpen] = useState(true)
  const [checkingSignups, setCheckingSignups] = useState(true)
  const [step, setStep] = useState('account') // 'account' | 'plan' | 'checkout' | 'sent'
  const [fullName, setFullName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [selectedTierKey, setSelectedTierKey] = useState(initialTierFromUrl)
  const [submittingTier, setSubmittingTier] = useState(null)
  const [newUserId, setNewUserId] = useState(null)
  const [error, setError] = useState(null)
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistDone, setWaitlistDone] = useState(false)

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('signups_open')
      .single()
      .then(({ data }) => {
        if (data) setSignupsOpen(data.signups_open)
        setCheckingSignups(false)
      })
  }, [])

  async function handleWaitlistSubmit(e) {
    e.preventDefault()
    setWaitlistSubmitting(true)
    setError(null)
    const { error: waitlistError } = await supabase.from('waitlist').insert({ email })
    if (waitlistError) {
      setError(waitlistError.message.includes('duplicate') ? "You're already on the waitlist." : waitlistError.message)
    } else {
      setWaitlistDone(true)
    }
    setWaitlistSubmitting(false)
  }

  function handleAccountSubmit(e) {
    e.preventDefault()
    setError(null)
    setStep('plan')
  }

  async function handleChoosePlan(tier) {
    setError(null)
    setSubmittingTier(tier.key)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          workspace_name: workspaceName,
          // Read by the mandatory checkout gate (App.jsx/Pricing.jsx) to
          // pre-highlight this tier if someone ends up back there without
          // having finished payment (e.g. closed the tab mid-checkout).
          selected_tier: tier.key,
          selected_billing_period: billingPeriod,
        },
        emailRedirectTo: `${window.location.origin}/welcome`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setSubmittingTier(null)
      setStep('account')
      return
    }

    setSubmittingTier(null)

    // Email confirmation is off for this project, so signUp() already
    // returns an active session — move straight into the embedded payment
    // step, right here on the same page. If confirmation ever gets turned
    // back on, signUp() won't return a session yet and this falls through
    // to the "check your email" step instead.
    if (data.session) {
      setNewUserId(data.session.user.id)
      setStep('checkout')
      return
    }

    setStep('sent')
  }

  const selectedTier = TIERS.find(x => x.key === selectedTierKey) || TIERS[0]
  const cardMaxWidth = step === 'plan' || step === 'checkout' ? '1040px' : '440px'

  return (
    <div className="force-light-theme" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px', backgroundImage: LIGHT_BG, fontFamily: t.fonts.sans, padding: '40px 16px', boxSizing: 'border-box' }}>
      <img src={gabspaceLockup} alt="gabspace" style={{ height: '44px', width: 'auto' }} />

      <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.card, padding: step === 'plan' || step === 'checkout' ? '40px' : '48px', width: '100%', maxWidth: cardMaxWidth, boxShadow: t.shadows.lg, transition: 'max-width 0.2s' }}>
        {checkingSignups ? (
          <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary, textAlign: 'center', margin: 0 }}>Loading…</p>
        ) : !signupsOpen ? (
          <>
            {waitlistDone ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>✨</div>
                <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 8px', fontFamily: t.fonts.heading }}>You're on the list.</h2>
                <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>We'll email you the moment signups open back up.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary, margin: '0 0 24px', fontStyle: 'italic' }}>signups are paused — join the waitlist.</p>
                <form onSubmit={handleWaitlistSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {error && (
                    <div style={{ padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base }}>{error}</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={labelStyle}>Email</label>
                    <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <button type="submit" disabled={waitlistSubmitting} style={{ padding: '12px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.md, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}>
                    {waitlistSubmitting ? 'Joining…' : 'Join waitlist'}
                  </button>
                </form>
              </>
            )}
          </>
        ) : step === 'sent' ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✨</div>
            <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 10px', fontFamily: t.fonts.heading }}>Check your email</h2>
            <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0, lineHeight: 1.6 }}>
              We sent a confirmation link to <strong style={{ color: t.colors.textPrimary }}>{email}</strong>. Click it and we'll take you straight into checkout for <strong style={{ color: t.colors.textPrimary }}>{selectedTier.name}</strong> ({billingPeriod}) to start your trial.
            </p>
          </div>
        ) : step === 'account' ? (
          <>
            <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary, margin: '0 0 8px', fontStyle: 'italic' }}>create your space.</p>
            <p style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, margin: '0 0 24px' }}>Step 1 of 3 — your account</p>
            <form onSubmit={handleAccountSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div style={{ padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.base }}>{error}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Your name</label>
                <input style={inputStyle} type="text" placeholder="Jane Doe" value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Workspace name</label>
                <input style={inputStyle} type="text" placeholder="Jane Doe Studio" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inputStyle, paddingRight: '44px' }} type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                  <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: t.colors.textTertiary, padding: '2px', lineHeight: 1 }}>
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <button type="submit" style={{ padding: '12px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.md, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}>
                Continue to plan →
              </button>
              <div style={{ textAlign: 'center', marginTop: '4px', paddingTop: '16px', borderTop: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>
                Already have an account?{' '}
                <button type="button" onClick={onBackToLogin} style={{ background: 'none', border: 'none', color: t.colors.primary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, padding: 0 }}>
                  Sign in
                </button>
              </div>
            </form>
          </>
        ) : step === 'checkout' ? (
          <>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, margin: '0 0 10px' }}>Step 3 of 3 — payment</p>
              <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 8px', fontFamily: t.fonts.heading }}>
                Start your {selectedTier.name} trial
              </h2>
              <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: 0 }}>
                14 days free, then ${billingPeriod === 'monthly' ? selectedTier.monthlyPrice.toFixed(0) : (selectedTier.annualPrice / 12).toFixed(0)}/mo. Cancel anytime.
              </p>
            </div>
            <EmbeddedCheckout
              priceId={selectedTier.priceIds[billingPeriod]}
              userId={newUserId}
              isFounder={false}
            />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep('account')}
              style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontFamily: t.fonts.sans, marginBottom: '16px' }}
            >
              ← Back
            </button>

            <div style={{ marginBottom: '28px', textAlign: 'center' }}>
              <p style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, margin: '0 0 10px' }}>Step 2 of 3 — your plan</p>
              <h2 style={{ fontSize: t.fontSizes['2xl'], fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 8px', fontFamily: t.fonts.heading }}>
                Choose your plan to start your trial
              </h2>
              <p style={{ fontSize: t.fontSizes.base, color: t.colors.textTertiary, margin: '0 auto', maxWidth: '480px' }}>
                14-day trial on every plan — pick one and pay right here to get started.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', backgroundColor: t.colors.bg, border: `1px solid ${t.colors.border}`, borderRadius: t.radius.full, padding: '4px' }}>
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
                    }}
                  >
                    {period === 'monthly' ? 'Monthly' : 'Annual'}
                    {period === 'annual' && (
                      <span style={{ fontSize: t.fontSizes.xs, fontWeight: '700', color: t.colors.success, backgroundColor: t.colors.successLight, padding: '2px 8px', borderRadius: t.radius.full }}>
                        Save 20%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: t.radius.md, backgroundColor: t.colors.dangerLight, color: t.colors.danger, fontSize: t.fontSizes.sm, marginBottom: '24px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'start' }}>
              {TIERS.map((tier) => {
                const price = billingPeriod === 'monthly' ? tier.monthlyPrice : tier.annualPrice / 12
                const isSelected = tier.key === selectedTierKey
                return (
                  <div
                    key={tier.key}
                    onClick={() => setSelectedTierKey(tier.key)}
                    style={{
                      position: 'relative', cursor: 'pointer',
                      backgroundColor: t.colors.bgCard,
                      borderRadius: t.radius.card,
                      border: isSelected ? `2px solid ${t.colors.primary}` : `1px solid ${t.colors.borderLight}`,
                      boxShadow: isSelected ? t.shadows.lg : t.shadows.sm,
                      padding: '24px 22px',
                      display: 'flex', flexDirection: 'column',
                    }}
                  >
                    {tier.popular && (
                      <div style={{ position: 'absolute', top: '-13px', left: '22px', backgroundColor: t.colors.primary, color: t.colors.textInverse, fontSize: t.fontSizes.xs, fontWeight: '700', letterSpacing: '0.04em', padding: '4px 12px', borderRadius: t.radius.full }}>
                        MOST POPULAR
                      </div>
                    )}
                    <h3 style={{ fontSize: t.fontSizes.lg, fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px', fontFamily: t.fonts.heading }}>{tier.name}</h3>
                    <p style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary, margin: '0 0 16px', minHeight: '36px' }}>{tier.tagline}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '30px', fontWeight: '700', color: t.colors.textPrimary, fontFamily: t.fonts.heading }}>${price.toFixed(0)}</span>
                      <span style={{ fontSize: t.fontSizes.sm, color: t.colors.textTertiary }}>/mo</span>
                    </div>
                    <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginBottom: '16px', minHeight: '16px' }}>
                      {billingPeriod === 'annual' ? `billed $${tier.annualPrice.toFixed(2)}/yr` : ' '}
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      {tier.features.map((f) => (
                        <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: t.fontSizes.sm, color: t.colors.textSecondary }}>
                          <span style={{ color: t.colors.success, fontWeight: '700', flexShrink: 0 }}>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTierKey(tier.key); handleChoosePlan(tier) }}
                      disabled={submittingTier === tier.key}
                      style={{
                        padding: '12px 18px', borderRadius: t.radius.full, border: 'none',
                        backgroundColor: tier.popular ? t.colors.primary : t.colors.textPrimary,
                        color: t.colors.textInverse,
                        fontSize: t.fontSizes.md, fontWeight: '600', fontFamily: t.fonts.sans,
                        cursor: submittingTier === tier.key ? 'default' : 'pointer',
                        opacity: submittingTier === tier.key ? 0.7 : 1,
                      }}
                    >
                      {submittingTier === tier.key ? 'Creating account…' : `Start with ${tier.name}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
