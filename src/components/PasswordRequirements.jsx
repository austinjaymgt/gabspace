import { theme as t } from '../theme'

// Mirrors Supabase Auth's configured password policy (Authentication →
// Policies → Password Requirements: "Lowercase, uppercase letters and
// digits", min length 8) — keep in sync if that setting changes.
const RULES = [
  { key: 'length', label: 'At least 8 characters', test: pw => pw.length >= 8 },
  { key: 'lower', label: 'One lowercase letter', test: pw => /[a-z]/.test(pw) },
  { key: 'upper', label: 'One uppercase letter', test: pw => /[A-Z]/.test(pw) },
  { key: 'digit', label: 'One number', test: pw => /[0-9]/.test(pw) },
]

// First unmet rule's label (e.g. "One uppercase letter"), or null when the
// password meets the policy.
// eslint-disable-next-line react-refresh/only-export-components
export function unmetPasswordRequirement(password) {
  return RULES.find(rule => !rule.test(password || ''))?.label || null
}

export default function PasswordRequirements({ password }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {RULES.map(rule => {
        const met = rule.test(password || '')
        return (
          <div key={rule.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: t.fontSizes.xs, color: met ? t.colors.success : t.colors.textTertiary }}>
            <span>{met ? '✓' : '○'}</span>
            <span>{rule.label}</span>
          </div>
        )
      })}
    </div>
  )
}
