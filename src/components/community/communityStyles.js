import { theme as t } from '../../theme'

// Shared inline styles + helpers for the Community pages — same idiom as the
// rest of the app (see Tutorials.jsx / Settings.jsx). Kept apart from
// CommunityUI.jsx so that file only exports components (fast refresh).

export const pageStyle = { padding: '32px', maxWidth: '1100px', fontFamily: t.fonts.sans }

export const inputStyle = {
  padding: '9px 14px',
  borderRadius: t.radius.full,
  border: `1px solid ${t.colors.border}`,
  fontSize: t.fontSizes.sm,
  outline: 'none',
  color: t.colors.textPrimary,
  backgroundColor: t.colors.bgCard,
  fontFamily: t.fonts.sans,
  boxSizing: 'border-box',
}

export const textareaStyle = {
  ...inputStyle,
  borderRadius: t.radius.md,
  width: '100%',
  minHeight: '96px',
  resize: 'vertical',
  lineHeight: 1.5,
}

export const labelStyle = { fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }

export const cardStyle = {
  borderRadius: t.radius.lg,
  border: `1px solid ${t.colors.borderLight}`,
  backgroundColor: t.colors.bgCard,
  padding: '16px 18px',
}

export function primaryButtonStyle(disabled = false) {
  return {
    padding: '9px 18px',
    borderRadius: t.radius.full,
    border: 'none',
    backgroundColor: t.colors.primary,
    color: '#fff',
    fontSize: t.fontSizes.sm,
    fontWeight: '600',
    fontFamily: t.fonts.sans,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    whiteSpace: 'nowrap',
  }
}

export const secondaryButtonStyle = {
  padding: '8px 16px',
  borderRadius: t.radius.full,
  border: `1px solid ${t.colors.border}`,
  background: 'transparent',
  color: t.colors.textPrimary,
  fontSize: t.fontSizes.sm,
  fontWeight: '500',
  fontFamily: t.fonts.sans,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export function formatDate(value) {
  if (!value) return ''
  // Plain dates ('2026-10-01') are calendar days — parse as local, not UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function isExpired(request) {
  return new Date(request.expires_at) <= new Date()
}
