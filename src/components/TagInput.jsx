import { useState } from 'react'
import { theme as t } from '../theme'
import { Icon } from './Icon'

export default function TagInput({ value = [], onChange, placeholder = 'Add tag...' }) {
  const [draft, setDraft] = useState('')

  function commit(raw) {
    const tag = raw.trim()
    if (!tag) return
    const exists = value.some(v => v.toLowerCase() === tag.toLowerCase())
    if (exists) {
      setDraft('')
      return
    }
    onChange([...value, tag])
    setDraft('')
  }

  function removeAt(idx) {
    onChange(value.filter((_, i) => i !== idx))
  }

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      // Backspace on empty input removes the last tag
      removeAt(value.length - 1)
    }
  }

  return (
    <div style={styles.wrap}>
      {value.map((tag, idx) => (
        <span key={`${tag}-${idx}`} style={styles.chip}>
          {tag}
          <button
            type="button"
            onClick={() => removeAt(idx)}
            style={styles.chipX}
            aria-label={`Remove ${tag}`}
          >
            <Icon name="close" size="sm" />
          </button>
        </span>
      ))}
      <input
        style={styles.input}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : ''}
      />
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '6px 8px',
    borderRadius: t.radius.full,
    border: `1px solid ${t.colors.border}`,
    backgroundColor: t.colors.bgCard,
    minHeight: '40px',
    alignItems: 'center',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 4px 3px 10px',
    borderRadius: t.radius.full,
    backgroundColor: t.colors.primaryLight,
    color: t.colors.primary,
    fontSize: t.fontSizes.xs,
    fontWeight: 500,
    fontFamily: t.fonts.sans,
  },
  chipX: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: t.colors.primary,
    display: 'flex',
    alignItems: 'center',
    padding: '0 2px',
  },
  input: {
    flex: 1,
    minWidth: '120px',
    border: 'none',
    outline: 'none',
    padding: '4px 6px',
    fontSize: t.fontSizes.base,
    color: t.colors.textPrimary,
    backgroundColor: 'transparent',
    fontFamily: t.fonts.sans,
  },
}