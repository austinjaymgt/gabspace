import { useState, useId } from 'react'
import { theme as t } from '../../theme'
import { cityMatches, formatCity } from '../../utils/communityHelpers'
import { inputStyle } from './communityStyles'

const MAX_SUGGESTIONS = 6

// Free-typed city field with suggestions from cities already in use. Uses
// the same matching as the directory/board filters, so typing "texas" or
// "aus" suggests "Austin, TX". Used for both entry (Settings, posting) and
// filtering; `formatOnBlur` tidies entries into "City, ST".
export default function CityInput({ value, onChange, suggestions = [], placeholder = 'City', formatOnBlur = false, style, ...rest }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()

  const query = value?.trim() || ''
  const matches = query
    ? suggestions.filter(s => cityMatches(s, query) && s.toLowerCase() !== query.toLowerCase()).slice(0, MAX_SUGGESTIONS)
    : []
  const showList = open && matches.length > 0

  function pick(city) {
    onChange(city)
    setOpen(false)
    setActive(-1)
  }

  function handleKeyDown(e) {
    if (!showList) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => (i <= 0 ? matches.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      pick(matches[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleBlur() {
    setOpen(false)
    setActive(-1)
    if (formatOnBlur) {
      const formatted = formatCity(value) || ''
      if (formatted !== value) onChange(formatted)
    }
  }

  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        {...rest}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={80}
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{ ...inputStyle, width: '100%' }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
            margin: 0, padding: '4px', listStyle: 'none',
            backgroundColor: t.colors.bgCard, border: `1px solid ${t.colors.borderLight}`,
            borderRadius: t.radius.md, boxShadow: t.shadows.md,
          }}
        >
          {matches.map((city, i) => (
            <li
              key={city}
              role="option"
              aria-selected={i === active}
              // mousedown (not click) so it fires before the input's blur
              onMouseDown={e => { e.preventDefault(); pick(city) }}
              onMouseEnter={() => setActive(i)}
              style={{
                padding: '7px 10px', borderRadius: t.radius.sm, cursor: 'pointer',
                fontSize: t.fontSizes.sm, fontFamily: t.fonts.sans, color: t.colors.textPrimary,
                backgroundColor: i === active ? t.colors.bgHover : 'transparent',
              }}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
