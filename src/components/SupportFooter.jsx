import { theme as t } from '../theme'

// Shown at the bottom of public-facing pages (login, signup, pricing, the
// client portal) that sit outside the authenticated app shell and so have
// no other route to support.
export default function SupportFooter({ dark = false }) {
  const color = dark ? 'rgba(255,255,255,0.55)' : t.colors.textTertiary
  const linkColor = dark ? 'rgba(255,255,255,0.85)' : t.colors.primary

  return (
    <div style={{ textAlign: 'center', padding: '8px 16px 0', fontSize: t.fontSizes.sm, color, fontFamily: t.fonts.sans }}>
      Got feedback or run into an issue? Email us at{' '}
      <a href="mailto:support@gabspace.io" style={{ color: linkColor, fontWeight: '600', textDecoration: 'underline' }}>
        support@gabspace.io
      </a>
    </div>
  )
}
