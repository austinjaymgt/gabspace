import { theme as t } from '../theme'
import { formatPhoneNumber } from '../utils/formatPhone'

export default function PhoneInput({ value, onChange, placeholder = '(555) 000-0000', style = {} }) {
  return (
    <input
      type="tel"
      value={value || ''}
      placeholder={placeholder}
      onChange={e => onChange(formatPhoneNumber(e.target.value))}
      style={{
        width: '100%',
        padding: '9px 12px',
        borderRadius: t.radius.full,
        border: `1px solid ${t.colors.border}`,
        fontSize: t.fontSizes.base,
        fontFamily: t.fonts.sans,
        boxSizing: 'border-box',
        color: t.colors.textPrimary,
        ...style,
      }}
    />
  )
}
