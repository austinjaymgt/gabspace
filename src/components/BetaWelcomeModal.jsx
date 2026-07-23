import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { theme as t } from '../theme'
import { Icon } from './Icon'
import Pixel from './Pixel'

// ─── Swap these URLs once your Loom recordings are ready ───────────────────
const LOOM_NAVIGATION = 'https://www.loom.com/embed/YOUR_NAVIGATION_VIDEO_ID'
const LOOM_FEEDBUCKET = 'https://www.loom.com/embed/YOUR_FEEDBUCKET_VIDEO_ID'
const NDA_URL         = 'https://gabspace.io/nda.html'
// ───────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Welcome'    },
  { id: 2, label: 'Navigation' },
  { id: 3, label: 'Feedback'   },
  { id: 4, label: 'Agreement'  },
]

export default function BetaWelcomeModal({ session, businessSpaceId, onComplete }) {
  const [step, setStep]           = useState(1)
  const [ndaChecked, setNdaChecked] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  const isFirst = step === 1
  const isLast  = step === STEPS.length

  function next() { if (!isLast) setStep(s => s + 1) }
  function back() { if (!isFirst) setStep(s => s - 1) }

  async function handleComplete() {
    if (!ndaChecked) return
    setSaving(true)
    setError(null)
    const { error: dbError } = await supabase
      .from('user_profiles')
      .update({
        onboarding_complete:      true,
        onboarding_completed_at:  new Date().toISOString(),
      })
      .eq('user_id',      session.user.id)
      .eq('business_space_id', businessSpaceId)

    setSaving(false)
    if (dbError) {
      setError('Something went wrong. Please try again.')
      return
    }
    onComplete()
  }

  return (
    <div style={s.overlay}>
      <div style={s.sheet}>

        {/* ── Progress bar ── */}
        <div style={s.progressBar}>
          {STEPS.map((st, i) => (
            <div key={st.id} style={s.progressTrack}>
              <div
                style={{
                  ...s.progressFill,
                  width: step > st.id ? '100%' : step === st.id ? '50%' : '0%',
                  backgroundColor: step >= st.id ? t.colors.primary : t.colors.borderLight,
                  transition: 'width 0.35s ease, background-color 0.2s',
                }}
              />
            </div>
          ))}
        </div>

        {/* ── Step label ── */}
        <div style={s.stepLabel}>
          Step {step} of {STEPS.length} — {STEPS[step - 1].label}
        </div>

        {/* ══════════════════════════════════════
            STEP 1 — WELCOME
        ══════════════════════════════════════ */}
        {step === 1 && (
          <div style={s.stepBody}>
            <div style={s.pixelWrap}>
              <Pixel mood="celebrating" size={96} sparkles animated wave />
            </div>
            <h2 style={s.heading}>You're in. Welcome to the beta. 🎉</h2>
            <p style={s.body}>
              We're really glad you're here. Gabspace is still being shaped, and having
              real creative entrepreneurs using it — and telling us what's working and
              what isn't — is exactly how we make it better.
            </p>
            <p style={s.body}>
              This short walkthrough covers the three things you need to know before
              you start exploring: how the app is organized, how to send feedback, and
              your NDA acknowledgment.
            </p>
            <p style={{ ...s.body, color: t.colors.textMuted, fontStyle: 'italic' }}>
              It'll take about two minutes.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 2 — NAVIGATION OVERVIEW
        ══════════════════════════════════════ */}
        {step === 2 && (
          <div style={s.stepBody}>
            <h2 style={s.heading}>Finding your way around</h2>
            <p style={s.body}>
              Here's a quick tour of how Gabspace is organized — the sidebar, the main
              sections, and where to go for clients, projects, tasks, and more.
            </p>
            <div style={s.videoWrap}>
              <iframe
                src={LOOM_NAVIGATION}
                frameBorder="0"
                allowFullScreen
                style={s.video}
                title="Gabspace navigation overview"
              />
            </div>
            <div style={s.tipRow}>
              <Icon name="info" size="sm" />
              <span style={s.tipText}>
                Use the sidebar to switch sections. Your favorites bar at the top gives
                you quick access to the pages you visit most.
              </span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 3 — FEEDBUCKET
        ══════════════════════════════════════ */}
        {step === 3 && (
          <div style={s.stepBody}>
            <h2 style={s.heading}>How to send feedback</h2>
            <p style={s.body}>
              Feedbucket is built right into the app — no separate form, no email
              thread. You can send a screenshot, annotate it, and describe what you're
              seeing in under a minute.
            </p>
            <div style={s.videoWrap}>
              <iframe
                src={LOOM_FEEDBUCKET}
                frameBorder="0"
                allowFullScreen
                style={s.video}
                title="How to use Feedbucket"
              />
            </div>
            <div style={s.tipRow}>
              <Icon name="info" size="sm" />
              <span style={s.tipText}>
                The Feedbucket button lives in the corner of every page. Bug, idea,
                or just a thought — send it. Every message goes straight to us.
              </span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 4 — NDA ACKNOWLEDGMENT
        ══════════════════════════════════════ */}
        {step === 4 && (
          <div style={s.stepBody}>
            <h2 style={s.heading}>One last thing — your NDA</h2>
            <p style={s.body}>
              As a beta tester you'll have early access to features and details that
              aren't public yet. We ask that you keep what you see here confidential
              for now.
            </p>

            <div style={s.ndaCard}>
              <div style={s.ndaPoints}>
                {[
                  { icon: 'lock',    text: 'Keep product features, design, and roadmap confidential' },
                  { icon: 'warning', text: 'Don\'t share screenshots or recordings without permission' },
                  { icon: 'success', text: 'Your feedback belongs to Gabspace — we may use it to improve the product' },
                  { icon: 'info',    text: 'This agreement lasts 2 years after the beta ends' },
                ].map(({ icon, text }) => (
                  <div key={text} style={s.ndaPoint}>
                    <div style={s.ndaIconWrap}>
                      <Icon name={icon} size="sm" />
                    </div>
                    <span style={s.ndaPointText}>{text}</span>
                  </div>
                ))}
              </div>

              <a
                href={NDA_URL}
                target="_blank"
                rel="noreferrer"
                style={s.ndaLink}
              >
                Read the full Beta NDA
                <Icon name="external" size="sm" />
              </a>
            </div>

            <label style={s.checkboxLabel}>
              <input
                type="checkbox"
                checked={ndaChecked}
                onChange={e => setNdaChecked(e.target.checked)}
                style={s.checkbox}
              />
              <span style={s.checkboxText}>
                I have read and agree to the{' '}
                <a href={NDA_URL} target="_blank" rel="noreferrer" style={s.inlineLink}>
                  Gabspace Beta NDA
                </a>
                . I understand this is a pre-release product and agree to keep
                what I see confidential.
              </span>
            </label>

            {error && (
              <p style={s.errorText}>{error}</p>
            )}
          </div>
        )}

        {/* ── Footer navigation ── */}
        <div style={s.footer}>
          <button
            onClick={back}
            disabled={isFirst}
            style={{
              ...s.btnGhost,
              opacity: isFirst ? 0 : 1,
              pointerEvents: isFirst ? 'none' : 'auto',
            }}
          >
            <Icon name="back" size="sm" />
            Back
          </button>

          <div style={s.dots}>
            {STEPS.map(st => (
              <div
                key={st.id}
                style={{
                  ...s.dot,
                  backgroundColor: step === st.id
                    ? t.colors.primary
                    : t.colors.borderLight,
                  transform: step === st.id ? 'scale(1.3)' : 'scale(1)',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>

          {isLast ? (
            <button
              onClick={handleComplete}
              disabled={!ndaChecked || saving}
              style={{
                ...s.btnPrimary,
                opacity: (!ndaChecked || saving) ? 0.5 : 1,
                cursor: (!ndaChecked || saving) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Start exploring'}
              {!saving && <Icon name="success" size="sm" />}
            </button>
          ) : (
            <button onClick={next} style={s.btnPrimary}>
              Next
              <Icon name="expand" size="sm" style={{ transform: 'rotate(-90deg)' }} />
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  overlay: {
    position:        'fixed',
    inset:           0,
    backgroundColor: 'rgba(26,26,46,0.55)',
    backdropFilter:  'blur(4px)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          200,
    padding:         '16px',
  },
  sheet: {
    backgroundColor: t.colors.bgCard,
    borderRadius:    t.radius.card,
    width:           '100%',
    maxWidth:        '540px',
    maxHeight:       '90vh',
    overflowY:       'auto',
    boxShadow:       t.shadows.lg,
    display:         'flex',
    flexDirection:   'column',
  },

  // Progress
  progressBar: {
    display:         'flex',
    gap:             '6px',
    padding:         '20px 24px 0',
  },
  progressTrack: {
    flex:            1,
    height:          '3px',
    borderRadius:    '99px',
    backgroundColor: t.colors.borderLight,
    overflow:        'hidden',
  },
  progressFill: {
    height:          '100%',
    borderRadius:    '99px',
  },
  stepLabel: {
    fontSize:        t.fontSizes.xs,
    fontWeight:      500,
    letterSpacing:   '0.08em',
    textTransform:   'uppercase',
    color:           t.colors.textMuted,
    padding:         '10px 24px 0',
    fontFamily:      t.fonts.sans,
  },

  // Content
  stepBody: {
    padding:         '24px 28px 8px',
    flex:            1,
  },
  pixelWrap: {
    display:         'flex',
    justifyContent:  'center',
    marginBottom:    '20px',
  },
  heading: {
    fontFamily:      t.fonts.display,
    fontSize:        t.fontSizes['2xl'],
    fontWeight:      800,
    color:           t.colors.textPrimary,
    letterSpacing:   '-0.02em',
    lineHeight:      1.2,
    marginBottom:    '14px',
  },
  body: {
    fontFamily:      t.fonts.sans,
    fontSize:        t.fontSizes.base,
    color:           t.colors.textSecondary,
    lineHeight:      1.65,
    marginBottom:    '12px',
  },

  // Video
  videoWrap: {
    position:        'relative',
    paddingTop:      '56.25%', // 16:9
    borderRadius:    t.radius.lg,
    overflow:        'hidden',
    backgroundColor: t.colors.bgPage,
    marginBottom:    '14px',
  },
  video: {
    position:        'absolute',
    top:             0,
    left:            0,
    width:           '100%',
    height:          '100%',
    borderRadius:    t.radius.lg,
  },
  tipRow: {
    display:         'flex',
    alignItems:      'flex-start',
    gap:             '8px',
    backgroundColor: t.colors.primaryLight,
    borderRadius:    t.radius.md,
    padding:         '10px 14px',
    color:           t.colors.primary,
  },
  tipText: {
    fontFamily:      t.fonts.sans,
    fontSize:        t.fontSizes.sm,
    color:           t.colors.primary,
    lineHeight:      1.55,
  },

  // NDA card
  ndaCard: {
    backgroundColor: t.colors.bgPage,
    border:          `1px solid ${t.colors.borderLight}`,
    borderRadius:    t.radius.card,
    padding:         '16px',
    marginBottom:    '18px',
  },
  ndaPoints: {
    display:         'flex',
    flexDirection:   'column',
    gap:             '10px',
    marginBottom:    '14px',
  },
  ndaPoint: {
    display:         'flex',
    alignItems:      'flex-start',
    gap:             '10px',
  },
  ndaIconWrap: {
    color:           t.colors.primary,
    flexShrink:      0,
    marginTop:       '2px',
  },
  ndaPointText: {
    fontFamily:      t.fonts.sans,
    fontSize:        t.fontSizes.sm,
    color:           t.colors.textSecondary,
    lineHeight:      1.55,
  },
  ndaLink: {
    display:         'inline-flex',
    alignItems:      'center',
    gap:             '5px',
    fontSize:        t.fontSizes.sm,
    color:           t.colors.primary,
    textDecoration:  'none',
    fontWeight:      500,
    fontFamily:      t.fonts.sans,
  },

  // Checkbox
  checkboxLabel: {
    display:         'flex',
    alignItems:      'flex-start',
    gap:             '10px',
    cursor:          'pointer',
    marginBottom:    '8px',
  },
  checkbox: {
    marginTop:       '3px',
    flexShrink:      0,
    accentColor:     t.colors.primary,
    width:           '16px',
    height:          '16px',
    cursor:          'pointer',
  },
  checkboxText: {
    fontFamily:      t.fonts.sans,
    fontSize:        t.fontSizes.sm,
    color:           t.colors.textSecondary,
    lineHeight:      1.6,
  },
  inlineLink: {
    color:           t.colors.primary,
    textDecoration:  'underline',
  },
  errorText: {
    fontFamily:      t.fonts.sans,
    fontSize:        t.fontSizes.sm,
    color:           t.colors.danger,
    marginTop:       '8px',
  },

  // Footer
  footer: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         '16px 24px 20px',
    borderTop:       `1px solid ${t.colors.borderLight}`,
    marginTop:       '8px',
  },
  dots: {
    display:         'flex',
    gap:             '6px',
    alignItems:      'center',
  },
  dot: {
    width:           '6px',
    height:          '6px',
    borderRadius:    '99px',
  },
  btnPrimary: {
    display:         'inline-flex',
    alignItems:      'center',
    gap:             '6px',
    backgroundColor: t.colors.primary,
    color:           '#fff',
    border:          'none',
    borderRadius:    t.radius.full,
    padding:         '10px 20px',
    fontSize:        t.fontSizes.sm,
    fontWeight:      500,
    fontFamily:      t.fonts.sans,
    cursor:          'pointer',
  },
  btnGhost: {
    display:         'inline-flex',
    alignItems:      'center',
    gap:             '6px',
    backgroundColor: 'transparent',
    color:           t.colors.textMuted,
    border:          `1px solid ${t.colors.borderLight}`,
    borderRadius:    t.radius.full,
    padding:         '10px 20px',
    fontSize:        t.fontSizes.sm,
    fontWeight:      500,
    fontFamily:      t.fonts.sans,
    cursor:          'pointer',
  },
}
