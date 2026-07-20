import { theme as t } from '../theme'

export default function Toggle({ checked, onChange, disabled = false }) {
  return (
    <span
      onClick={disabled ? undefined : onChange}
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      style={{
        width: '36px',
        height: '20px',
        borderRadius: t.radius.full,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px',
        boxSizing: 'border-box',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: checked ? t.colors.primary : t.colors.borderLight,
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.15s ease',
        flexShrink: 0,
      }}
    >
      <span style={{
        width: '16px',
        height: '16px',
        borderRadius: t.radius.full,
        backgroundColor: '#FFFFFF',
        transform: checked ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform 0.15s ease',
      }} />
    </span>
  )
}
