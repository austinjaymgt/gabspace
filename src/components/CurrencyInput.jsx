import { useState } from 'react'
import { theme as t } from '../theme'

export default function CurrencyInput({ value, onChange, placeholder = '0', style = {} }) {
  const [focused, setFocused] = useState(false)

  const display = focused
    ? (value || '')
    : value ? Number(value).toLocaleString() : ''

  return (
    <input
      type="text"
      value={display}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => onChange(e.target.value.replace(/,/g, ''))}
      style={{
        width: '100%',
        padding: '9px 12px',
        borderRadius: t.radius.md,
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