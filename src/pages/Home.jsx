import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Orb from '../components/Orb'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function riseAnim(delay, duration = 0.5) {
  return `home-enter-rise ${duration}s cubic-bezier(0.16,1,0.3,1) ${delay}s backwards`
}

// Distinct hover colors cycled across the business circles.
const CIRCLE_COLORS = [
  'rgba(107,26,122,0.85)',   // purple
  'rgba(46,143,186,0.85)',   // blue
  'rgba(198,120,60,0.85)',   // orange
  'rgba(76,150,110,0.85)',   // green
  'rgba(192,80,110,0.85)',   // rose
  'rgba(169,174,187,0.85)',  // slate
]

function BusinessCircle({ business, active, color, delay, switching, onClick }) {
  const [hovered, setHovered] = useState(false)
  const initial = business.name?.trim()?.[0]?.toUpperCase() || '?'

  return (
    <div
      style={{ ...s.circleWrap, animation: riseAnim(delay) }}
      onClick={e => { e.stopPropagation(); onClick(business.id) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          ...s.circle,
          ...(active ? s.circleActive : {}),
          ...(hovered ? { backgroundColor: color, borderColor: color, transform: 'scale(1.08)' } : {}),
          opacity: switching ? 0.5 : 1,
        }}
      >
        {business.logo_url ? (
          <img src={business.logo_url} alt="" style={s.circleLogo} />
        ) : (
          <span style={s.circleInitial}>{initial}</span>
        )}
      </div>
      <div style={s.circleLabel}>{business.name}</div>
    </div>
  )
}

// ── Home ─────────────────────────────────────────────────────────────────
// The landing moment right after sign-in — a distinct full-screen beat,
// not another page in the app shell. Chrome (sidebar/topbar) is skipped
// entirely by App.jsx while this is the current page.

export default function Home({ session, businessSpaceId, onSwitchBusinessSpace, onNavigate }) {
  const [firstName, setFirstName] = useState('')
  const [businesses, setBusinesses] = useState([])
  const [switchingId, setSwitchingId] = useState(null)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase.from('user_settings').select('first_name').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setFirstName(data?.first_name || session.user.email?.split('@')[0] || ''))
  }, [session])

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('business_space_members')
      .select('business_space_id, business_spaces(id, name, logo_url, archived_at)')
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        const rows = (data || [])
          .filter(r => r.business_spaces && !r.business_spaces.archived_at)
          .map(r => ({ id: r.business_spaces.id, name: r.business_spaces.name, logo_url: r.business_spaces.logo_url }))
        setBusinesses(rows)
      })
  }, [session])

  async function handleChipClick(id) {
    if (switchingId) return
    setSwitchingId(id)
    const { error } = await onSwitchBusinessSpace?.(id) || {}
    setSwitchingId(null)
    if (!error) onNavigate?.('dashboard')
  }

  return (
    <div style={s.screen}>
      <style>{`
        @keyframes home-enter-rise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={s.glowTop} />
      <div style={s.glowBottom} />

      <div style={s.center}>
        <div style={s.orbWrap}>
          <Orb size={150} halo />
        </div>

        <div style={{ ...s.greeting, animation: riseAnim(0.3) }}>
          {getGreeting()}, {firstName}
        </div>

        {businesses.length > 0 && (
          <div style={{ ...s.circlesRow, animation: riseAnim(0.5) }}>
            {businesses.map((business, i) => (
              <BusinessCircle
                key={business.id}
                business={business}
                active={business.id === businessSpaceId}
                color={CIRCLE_COLORS[i % CIRCLE_COLORS.length]}
                delay={0.55 + i * 0.08}
                switching={switchingId === business.id}
                onClick={handleChipClick}
              />
            ))}
          </div>
        )}

        <div style={{ ...s.hint, animation: riseAnim(1.1) }}>
          click a business to enter
        </div>
      </div>
    </div>
  )
}

const s = {
  screen: {
    position: 'relative',
    minHeight: '100vh',
    width: '100%',
    zIndex: 500,
    backgroundColor: '#07060a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'safe center',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '60px 24px',
    boxSizing: 'border-box',
  },
  glowTop: {
    position: 'fixed',
    top: '-15%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '900px',
    height: '900px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(107,26,122,0.5) 0%, rgba(107,26,122,0) 70%)',
    pointerEvents: 'none',
  },
  glowBottom: {
    position: 'fixed',
    bottom: '-20%',
    left: '62%',
    transform: 'translateX(-50%)',
    width: '900px',
    height: '900px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(169,174,187,0.32) 0%, rgba(169,174,187,0) 70%)',
    pointerEvents: 'none',
  },
  center: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
    maxWidth: '560px',
    width: '100%',
    boxSizing: 'border-box',
  },
  orbWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  greeting: {
    fontFamily: '"Montserrat", sans-serif',
    fontWeight: 400,
    fontSize: '46px',
    letterSpacing: '0.02em',
    color: 'rgba(244,238,248,0.94)',
    textAlign: 'center',
    lineHeight: 1.15,
    margin: 0,
  },
  circlesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '22px',
    marginTop: '22px',
    cursor: 'default',
  },
  circleWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    width: '84px',
  },
  circle: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
  },
  circleActive: {
    borderColor: 'rgba(169,174,187,0.6)',
    boxShadow: '0 0 0 2px rgba(169,174,187,0.2)',
  },
  circleLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  circleInitial: {
    fontFamily: '"Montserrat", sans-serif',
    fontSize: '24px',
    fontWeight: 500,
    color: 'rgba(244,238,248,0.9)',
  },
  circleLabel: {
    fontFamily: '"Inter", sans-serif',
    fontSize: '12px',
    fontWeight: 500,
    color: 'rgba(244,238,248,0.75)',
    textAlign: 'center',
    lineHeight: 1.25,
    wordBreak: 'break-word',
  },
  hint: {
    marginTop: '22px',
    fontFamily: '"Inter", sans-serif',
    fontSize: '11px',
    fontWeight: 400,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(244,238,248,0.35)',
  },
}
