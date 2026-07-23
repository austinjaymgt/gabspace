import { theme as t } from '../theme'
import Orb from './Orb'

export default function SplashScreen({ tagline }) {
  return (
    <div className="force-light-theme" style={s.overlay}>
      <style>{`
        @keyframes splash-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes splash-rise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={s.orbWrap}>
        <Orb size={110} halo />
      </div>
      <p style={s.wordmark}>gabspace</p>
      {tagline && <p style={s.tagline}>{tagline}</p>}
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    backgroundImage: 'var(--gradient-bg)',
    fontFamily: t.fonts.sans,
    animation: 'splash-fade-in 0.25s ease',
  },
  orbWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'splash-rise 0.4s ease',
  },
  wordmark: {
    fontFamily: t.fonts.heading,
    fontSize: '28px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: '#FFFFFF',
    margin: 0,
    animation: 'splash-rise 0.4s ease 0.05s backwards',
  },
  tagline: {
    fontSize: t.fontSizes.md,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
    margin: 0,
    animation: 'splash-rise 0.4s ease 0.1s backwards',
  },
}
