import { useState } from 'react'
import { supabase } from '../supabaseClient'

// ── Brand tokens — pulled from the live gabspace.io site + transactional
// emails so this recreation matches exactly. ──────────────────────────────
const c = {
  bg: '#F7F5F0',
  card: '#FFFFFF',
  dark: '#1A1A2E',
  textSecondary: '#3D3D5C',
  textTertiary: '#8585A0',
  purple: '#7C5CBF',
  purpleLight: '#EDE5F4',
  green: '#6B8F71',
  border: 'rgba(26,26,46,0.09)',
  borderLight: 'rgba(26,26,46,0.06)',
}

const fonts = {
  heading: '"Syne", sans-serif',
  body: '"DM Sans", sans-serif',
}

const CREATIVE_TYPES = [
  'Photographer', 'Videographer', 'Graphic designer', 'Interior designer',
  'Illustrator / artist', 'Event planner', 'Content creator', 'Other creative',
]

const HOW_HEARD = [
  'Instagram', 'Facebook group', 'Reddit', 'Word of mouth / friend', 'Google search', 'Other',
]

const FEATURES = [
  { title: 'Client management', body: 'Track every client from lead to completed project with a built-in sales funnel — Lead, Prospect, Active, Completed.' },
  { title: 'Project profiles', body: 'Budget items, file uploads, contingency tracking, and project status — all in one shareable project view.' },
  { title: 'Simple finances', body: 'Track revenue and expenses without the complexity. Monthly snapshots, YTD totals, and receipt uploads included.' },
  { title: 'Client portal', body: "Share project updates with clients in a clean portal. They can react and comment — no login required." },
  { title: 'Marketing tracker', body: "Log campaigns and events, set goals, track outcomes, and see what's actually driving new business." },
  { title: 'Business dashboard', body: "A personalized overview of your business health — KPIs, recent activity, and upcoming work at a glance." },
]

const STEPS = [
  { n: '01', label: 'Apply', title: 'Request access', body: 'Submit a short request below. We review every application and prioritize creatives who are actively managing clients and projects.' },
  { n: '02', label: 'Onboard', title: 'Get set up in minutes', body: "We'll walk you through a quick onboarding checklist. No complicated setup — you'll be managing your first client the same day." },
  { n: '03', label: 'Use it', title: 'Run your business', body: "Use Gabspace for 4–6 weeks the way you'd use any real tool. Track clients, log revenue, update your portal, check your dashboard." },
  { n: '04', label: 'Share', title: 'Give us feedback', body: "A quick 20-minute call at the end. What worked? What didn't? What would you pay for? Your input directly shapes what gets built next." },
]

function BrandMark({ size = 32 }) {
  return (
    <div style={{
      width: size, height: size,
      background: `linear-gradient(135deg, ${c.purple}, ${c.green})`,
      borderRadius: size * 0.3,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg viewBox="0 0 28 28" width={size * 0.55} height={size * 0.55} fill="none">
        <rect x="3" y="3" width="9" height="9" rx="2.5" fill="white" fillOpacity="0.9" />
        <rect x="16" y="3" width="9" height="9" rx="2.5" fill="white" fillOpacity="0.55" />
        <rect x="3" y="16" width="9" height="9" rx="2.5" fill="white" fillOpacity="0.55" />
        <rect x="16" y="16" width="9" height="9" rx="2.5" fill="white" fillOpacity="0.9" />
      </svg>
    </div>
  )
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function Check() {
  return <span style={{ color: c.green, fontWeight: 700 }}>✓</span>
}
function Cross() {
  return <span style={{ color: '#C24949', fontWeight: 700 }}>✗</span>
}

export default function Landing() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [creativeType, setCreativeType] = useState('')
  const [socialLink, setSocialLink] = useState('')
  const [howHeard, setHowHeard] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: insertError } = await supabase.from('beta_requests').insert({
      name: fullName,
      email,
      creative_type: creativeType,
      social_link: socialLink || null,
      how_heard: howHeard || null,
      status: 'pending',
    })
    if (insertError) {
      console.error('beta_requests insert error:', insertError)
      setError('Something went wrong. Please try again or email us directly.')
    } else {
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  return (
    <div className="force-light-theme" style={{ background: c.bg, color: c.dark, fontFamily: fonts.body, minHeight: '100vh' }}>
      <style>{`
        .gs-nav-link { color: ${c.textSecondary}; text-decoration: none; font-size: 15px; font-weight: 500; }
        .gs-nav-link:hover { color: ${c.dark}; }
        .gs-footer-link:hover { color: ${c.dark}; }
        .gs-btn-dark { background: ${c.dark}; color: #fff; }
        .gs-btn-dark:hover { opacity: 0.92; }
        .gs-btn-outline { background: transparent; color: ${c.dark}; border: 1.5px solid ${c.border}; }
        .gs-btn-outline:hover { background: rgba(26,26,46,0.04); }
        .gs-features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
        .gs-compare-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
        .gs-steps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 28px; }
        .gs-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .gs-input, .gs-select { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px; border: 1.5px solid ${c.border}; font-family: ${fonts.body}; font-size: 14px; color: ${c.dark}; background: #fff; outline: none; }
        .gs-input:focus, .gs-select:focus { border-color: ${c.purple}; }
        .gs-hero-headline { font-family: ${fonts.heading}; font-weight: 800; letter-spacing: -1px; color: ${c.dark}; font-size: clamp(36px, 6vw, 60px); line-height: 1.08; margin: 0; text-align: center; }
        @media (max-width: 640px) {
          .gs-form-grid { grid-template-columns: 1fr; }
          .gs-hero-ctas { flex-direction: column; }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: c.bg, borderBottom: `1px solid ${c.borderLight}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandMark size={32} />
            <span style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 20, color: c.dark }}>gabspace</span>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <a className="gs-nav-link" onClick={(e) => { e.preventDefault(); scrollToId('features') }} href="#features">Features</a>
            <a className="gs-nav-link" onClick={(e) => { e.preventDefault(); scrollToId('how-it-works') }} href="#how-it-works">How it works</a>
            <a className="gs-nav-link" onClick={(e) => { e.preventDefault(); scrollToId('apply') }} href="#apply">Early access</a>
          </nav>
          <button
            className="gs-btn-dark"
            onClick={() => scrollToId('apply')}
            style={{ border: 'none', borderRadius: 100, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: fonts.body }}
          >
            Request access
          </button>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '80px 32px 40px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: c.purpleLight, color: c.purple, fontSize: 12, fontWeight: 700,
          letterSpacing: '0.06em', padding: '8px 18px', borderRadius: 100, marginBottom: 28,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.purple, display: 'inline-block' }} />
          CLOSED BETA — NOW ACCEPTING EARLY USERS
        </div>

        <h1 className="gs-hero-headline">
          Business clarity for<br />
          <em style={{ fontStyle: 'italic', color: c.purple }}>creative entrepreneurs</em>
        </h1>

        <p style={{ fontSize: 18, color: c.textSecondary, lineHeight: 1.6, maxWidth: 640, margin: '28px auto 0' }}>
          One clean space to manage clients, projects, finances, and marketing — without the learning curve. Built for how creatives actually work.
        </p>

        <div className="gs-hero-ctas" style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 36 }}>
          <button
            className="gs-btn-dark"
            onClick={() => scrollToId('apply')}
            style={{ border: 'none', borderRadius: 100, padding: '15px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: fonts.body }}
          >
            Request early access →
          </button>
          <button
            className="gs-btn-outline"
            onClick={() => scrollToId('how-it-works')}
            style={{ borderRadius: 100, padding: '15px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: fonts.body }}
          >
            See how it works
          </button>
        </div>

        <p style={{ fontSize: 13, color: c.textTertiary, marginTop: 20 }}>
          Free during beta &nbsp;·&nbsp; Limited spots &nbsp;·&nbsp; Your feedback shapes the product
        </p>
      </section>

      {/* ── Trust strip ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '0 32px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {[
            'Built for creative businesses',
            'Set up in under 10 minutes',
            'Client portal on every plan',
            'No data locked behind exports',
          ].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: c.textSecondary, fontWeight: 500 }}>
              <Check /> {t}
            </div>
          ))}
        </div>
      </section>

      {/* ── Dashboard preview mock ─────────────────────────────────── */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '0 32px 96px' }}>
        <div style={{ background: c.dark, borderRadius: 20, padding: 8, boxShadow: '0 30px 60px rgba(26,26,46,0.18)' }}>
          <div style={{ background: c.bg, borderRadius: 14, overflow: 'hidden', display: 'flex', minHeight: 320 }}>
            {/* mini sidebar */}
            <div style={{ width: 160, background: c.dark, padding: '20px 14px', flexShrink: 0, display: 'none' }} className="gs-mock-sidebar">
              <div style={{ color: '#fff', fontFamily: fonts.heading, fontWeight: 800, fontSize: 15, marginBottom: 24 }}>gabspace</div>
              {[
                { label: 'CLIENTS', items: ['Dashboard', 'Clients', 'Projects'] },
                { label: 'BUSINESS', items: ['Finance', 'Tasks', 'Vendors'] },
                { label: 'MARKETING', items: ['Campaigns', 'Events'] },
              ].map((g) => (
                <div key={g.label} style={{ marginBottom: 16 }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.08em', marginBottom: 6 }}>{g.label}</div>
                  {g.items.map((it) => (
                    <div key={it} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, padding: '5px 0' }}>{it}</div>
                  ))}
                </div>
              ))}
            </div>
            {/* main panel */}
            <div style={{ flex: 1, padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.dark }}>Good morning, Jordan</div>
                  <div style={{ fontSize: 12, color: c.textTertiary }}>April 2026 · 3 active projects</div>
                </div>
                <div style={{ background: c.dark, color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 100 }}>+ New client</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'REVENUE YTD', value: '$14,200', sub: '↑ 18% vs last year' },
                  { label: 'ACTIVE CLIENTS', value: '9', sub: '2 new this month' },
                  { label: 'PENDING', value: '$3,800', sub: '2 in progress' },
                ].map((s) => (
                  <div key={s.label} style={{ background: c.card, border: `1px solid ${c.borderLight}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 10, color: c.textTertiary, letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: c.dark }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: c.green, marginTop: 4 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: c.card, border: `1px solid ${c.borderLight}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 10, color: c.textTertiary, letterSpacing: '0.06em', marginBottom: 10 }}>RECENT CLIENTS</div>
                {[
                  { i: 'SR', name: 'Sarah R.', status: 'ACTIVE' },
                  { i: 'JM', name: 'James M.', status: 'PROSPECT' },
                  { i: 'KL', name: 'Kim L.', status: 'COMPLETED' },
                ].map((row) => (
                  <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${c.borderLight}` }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: c.purpleLight, color: c.purple, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{row.i}</div>
                    <div style={{ flex: 1, fontSize: 13, color: c.dark, fontWeight: 500 }}>{row.name}</div>
                    <div style={{ fontSize: 10, color: c.textTertiary, fontWeight: 600 }}>{row.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 96px' }}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 48px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: c.purple, marginBottom: 12 }}>EVERYTHING IN ONE PLACE</div>
          <h2 style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 'clamp(28px, 4vw, 38px)', color: c.dark, margin: '0 0 14px' }}>
            Built around how creatives actually work
          </h2>
          <p style={{ fontSize: 16, color: c.textSecondary, lineHeight: 1.6 }}>
            Not a generic CRM. Not a complicated suite. Gabspace is structured for the way creative businesses move — from first inquiry to final delivery.
          </p>
        </div>
        <div className="gs-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: c.card, border: `1px solid ${c.borderLight}`, borderRadius: 16, padding: 26 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: c.dark, margin: '0 0 10px' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.6, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison ─────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px 96px' }}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 48px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: c.purple, marginBottom: 12 }}>WHY GABSPACE</div>
          <h2 style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 'clamp(28px, 4vw, 38px)', color: c.dark, margin: '0 0 14px' }}>
            Not too rigid. Not too complex.
          </h2>
          <p style={{ fontSize: 16, color: c.textSecondary, lineHeight: 1.6 }}>
            HoneyBook locks you in. Dubsado takes weeks to configure. Gabspace works on day one — and grows with you.
          </p>
        </div>
        <div className="gs-compare-grid">
          {[
            { name: 'HoneyBook', price: '$39/mo', highlight: false, rows: [
              { ok: true, t: 'Client management' }, { ok: true, t: 'Invoicing & contracts' },
              { ok: false, t: 'Rigid, template-driven' }, { ok: false, t: 'No marketing tracking' }, { ok: false, t: 'Limited flexibility' },
            ]},
            { name: 'Gabspace', price: 'Free during beta', highlight: true, rows: [
              { ok: true, t: 'Client management' }, { ok: true, t: 'Project + finance tracking' },
              { ok: true, t: 'Works immediately' }, { ok: true, t: 'Marketing & event tracking' }, { ok: true, t: 'Branded client portal' },
            ]},
            { name: 'Dubsado', price: '$40/mo', highlight: false, rows: [
              { ok: true, t: 'Highly customizable' }, { ok: true, t: 'Powerful workflows' },
              { ok: false, t: 'Steep learning curve' }, { ok: false, t: 'Weeks to set up' }, { ok: false, t: 'Overwhelming for solo users' },
            ]},
          ].map((col) => (
            <div key={col.name} style={{
              background: col.highlight ? c.dark : c.card,
              border: col.highlight ? 'none' : `1px solid ${c.borderLight}`,
              borderRadius: 16, padding: 26,
              transform: col.highlight ? 'scale(1.03)' : 'none',
              boxShadow: col.highlight ? '0 20px 40px rgba(26,26,46,0.2)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {col.highlight && <BrandMark size={20} />}
                <div style={{ fontSize: 16, fontWeight: 700, color: col.highlight ? '#fff' : c.dark }}>{col.name}</div>
              </div>
              <div style={{ fontSize: 13, color: col.highlight ? c.purpleLight : c.textTertiary, marginBottom: 18 }}>{col.price}</div>
              {col.rows.map((r) => (
                <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: 13.5, color: col.highlight ? 'rgba(255,255,255,0.85)' : c.textSecondary }}>
                  {r.ok ? <Check /> : <Cross />} {r.t}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section id="how-it-works" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px 96px' }}>
        <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 48px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: c.purple, marginBottom: 12 }}>EARLY ACCESS PROGRAM</div>
          <h2 style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 'clamp(28px, 4vw, 38px)', color: c.dark, margin: '0 0 14px' }}>
            How the beta works
          </h2>
          <p style={{ fontSize: 16, color: c.textSecondary, lineHeight: 1.6 }}>
            Gabspace is in closed beta. We're working closely with a small group of creative entrepreneurs to make sure the product fits the way you actually run your business — before we open the doors wider.
          </p>
        </div>
        <div className="gs-steps-grid">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div style={{ fontFamily: fonts.heading, fontSize: 30, fontWeight: 800, color: c.purpleLight, marginBottom: 4 }}>{s.n}</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: c.purple, marginBottom: 8 }}>{s.label.toUpperCase()}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: c.dark, margin: '0 0 8px' }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.6, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Apply form ─────────────────────────────────────────────── */}
      <section id="apply" style={{ maxWidth: 720, margin: '0 auto', padding: '0 32px 96px' }}>
        <div style={{ background: c.card, border: `1px solid ${c.borderLight}`, borderRadius: 20, padding: 40, boxShadow: '0 20px 50px rgba(26,26,46,0.06)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: c.purple, marginBottom: 12 }}>APPLY FOR EARLY ACCESS</div>
          <h2 style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 30, color: c.dark, margin: '0 0 10px' }}>Let's get you in.</h2>

          {submitted ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: c.dark, marginBottom: 6 }}>You're on the list.</div>
              <p style={{ fontSize: 14, color: c.textSecondary, lineHeight: 1.6 }}>
                Thanks for applying — check your email for confirmation. We review every application and will follow up within a few days.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 14.5, color: c.textSecondary, lineHeight: 1.6, margin: '0 0 28px' }}>
                Fill in the details below and we'll review your application. Accepted users receive an access link and confirmation email within a few days.
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="gs-form-grid">
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: c.dark, marginBottom: 6 }}>Full name</label>
                    <input className="gs-input" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: c.dark, marginBottom: 6 }}>Email address</label>
                    <input className="gs-input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                </div>
                <div className="gs-form-grid">
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: c.dark, marginBottom: 6 }}>Type of creative</label>
                    <select className="gs-select" required value={creativeType} onChange={(e) => setCreativeType(e.target.value)}>
                      <option value="">Select your craft</option>
                      {CREATIVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: c.dark, marginBottom: 6 }}>Instagram or website</label>
                    <input className="gs-input" value={socialLink} onChange={(e) => setSocialLink(e.target.value)} placeholder="@yourhandle or yoursite.com" />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: c.dark, marginBottom: 6 }}>How did you hear about Gabspace?</label>
                  <select className="gs-select" value={howHeard} onChange={(e) => setHowHeard(e.target.value)}>
                    <option value="">Select one</option>
                    {HOW_HEARD.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {error && (
                  <div style={{ fontSize: 13.5, color: '#C24949', background: '#FBEAEA', border: '1px solid rgba(194,73,73,0.25)', borderRadius: 10, padding: '10px 14px' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="gs-btn-dark"
                  style={{ border: 'none', borderRadius: 100, padding: '15px 24px', fontSize: 15, fontWeight: 600, cursor: submitting ? 'default' : 'pointer', fontFamily: fonts.body, opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Submitting…' : 'Apply for early access →'}
                </button>

                <p style={{ fontSize: 12.5, color: c.textTertiary, textAlign: 'center', margin: 0 }}>
                  Free during beta &nbsp;·&nbsp; No credit card needed &nbsp;·&nbsp; Limited spots available
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section style={{ background: c.dark, padding: '80px 32px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 'clamp(26px, 4vw, 36px)', color: '#fff', margin: '0 0 14px' }}>
          Your business, finally organized.
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', margin: '0 0 28px' }}>
          Join creatives already using Gabspace to run clearer, calmer businesses.
        </p>
        <button
          onClick={() => scrollToId('apply')}
          style={{ background: '#fff', color: c.dark, border: 'none', borderRadius: 100, padding: '15px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: fonts.body }}
        >
          Request early access — it's free
        </button>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{ padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          <BrandMark size={24} />
          <span style={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: 16, color: c.dark }}>gabspace</span>
        </div>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: 'Features', onClick: () => scrollToId('features') },
            { label: 'How it works', onClick: () => scrollToId('how-it-works') },
            { label: 'Early access', onClick: () => scrollToId('apply') },
            { label: 'Terms', href: '/terms.html' },
            { label: 'Privacy', href: '/privacy.html' },
            { label: 'Cookies', href: '/cookies.html' },
            { label: 'Acceptable Use', href: '/acceptable-use.html' },
            { label: 'Subprocessors', href: '/subprocessors.html' },
          ].map((l) => (
            <a
              key={l.label}
              className="gs-footer-link"
              href={l.href || '#'}
              onClick={l.onClick ? (e) => { e.preventDefault(); l.onClick() } : undefined}
              style={{ fontSize: 13, color: c.textTertiary, textDecoration: 'none' }}
            >
              {l.label}
            </a>
          ))}
        </div>
        <div style={{ fontSize: 12, color: c.textTertiary }}>© 2026 Gabspace. All rights reserved.</div>
      </footer>
    </div>
  )
}
