const c = {
  bg: '#F7F5F0',
  card: '#FFFFFF',
  dark: '#1A1A2E',
  textTertiary: '#8585A0',
  purple: '#7C5CBF',
  green: '#6B8F71',
}

function BrandMark() {
  return (
    <div style={{
      width: 48, height: 48,
      background: `linear-gradient(135deg, ${c.purple}, ${c.green})`,
      borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 24px',
    }}>
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
        <rect x="3" y="3" width="9" height="9" rx="2.5" fill="white" opacity="0.9" />
        <rect x="16" y="3" width="9" height="9" rx="2.5" fill="white" opacity="0.55" />
        <rect x="3" y="16" width="9" height="9" rx="2.5" fill="white" opacity="0.55" />
        <rect x="16" y="16" width="9" height="9" rx="2.5" fill="white" opacity="0.9" />
      </svg>
    </div>
  )
}

export default function BetaStatusScreen() {
  const params = new URLSearchParams(window.location.search)
  const title = params.get('title') || 'Done'
  const message = params.get('message') || ''

  return (
    <div className="force-light-theme" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: c.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '24px',
    }}>
      <div style={{
        background: c.card, borderRadius: 16, padding: '48px 40px', textAlign: 'center',
        maxWidth: 400, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <BrandMark />
        <h1 style={{ fontSize: 24, color: c.dark, margin: '0 0 12px' }}>{title}</h1>
        <p style={{ fontSize: 15, color: c.textTertiary, margin: 0, lineHeight: 1.6 }}>{message}</p>
      </div>
    </div>
  )
}
