import { useState } from 'react'
import { Icon } from './Icon'
import { theme as t } from '../theme'

// Curated, gender-neutral subset of the sitewide icon set (Icon.jsx / ICON_MAP)
// for tagging projects — mixes event, creative, and business categories.
// eslint-disable-next-line react-refresh/only-export-components
export const PROJECT_ICON_OPTIONS = [
  'events', 'photography', 'creative', 'idea', 'star', 'milestone',
  'win', 'team-goals', 'intranet', 'finance', 'contract', 'chart',
  'vendors', 'projects', 'guests', 'location',
]

export function ProjectIconBadge({ icon, size = 24, dark = false }) {
  if (!icon) return null
  const iconSize = Math.max(12, Math.round(size * 0.55))
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: dark ? 'rgba(255,255,255,0.16)' : t.colors.primary,
    }}>
      <Icon name={icon} size={iconSize} color="#fff" strokeWidth={2} />
    </span>
  )
}

export function ProjectIconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '44px', height: '44px', borderRadius: '50%', border: value ? 'none' : `1px dashed ${t.colors.borderLight}`,
          backgroundColor: value ? t.colors.primary : t.colors.bgCard, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: t.colors.textTertiary, padding: 0,
        }}
      >
        <Icon name={value || 'add'} size={value ? 20 : 18} color={value ? '#fff' : undefined} strokeWidth={2} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
          <div style={{
            position: 'absolute', top: '50px', left: 0, zIndex: 20, backgroundColor: t.colors.bgCard,
            border: `1px solid ${t.colors.borderLight}`, borderRadius: t.radius.lg, padding: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)', width: '228px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginBottom: '8px' }}>
              {PROJECT_ICON_OPTIONS.map(name => {
                const selected = value === name
                return (
                  <button
                    type="button"
                    key={name}
                    onClick={() => { onChange(name); setOpen(false) }}
                    title={name.replace(/-/g, ' ')}
                    style={{
                      width: '32px', height: '32px', border: selected ? `2px solid ${t.colors.primaryDark}` : 'none',
                      backgroundColor: t.colors.primary, borderRadius: '50%', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >
                    <Icon name={name} size={16} color="#fff" strokeWidth={2} />
                  </button>
                )
              })}
            </div>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                style={{ width: '100%', fontSize: t.fontSizes.xs, color: t.colors.textTertiary, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', fontFamily: t.fonts.sans }}
              >
                Clear icon
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
