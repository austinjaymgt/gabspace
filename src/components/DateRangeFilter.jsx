import { theme as t } from '../theme'

const PRESETS = [
  { key: 'all', label: 'All dates' },
  { key: 'mtd', label: 'Month to date' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'custom', label: 'Custom range' },
]

export default function DateRangeFilter({ preset, start, end, onPresetChange, onStartChange, onEndChange }) {
  return (
    <div style={styles.wrap}>
      <select
        value={preset}
        onChange={e => onPresetChange(e.target.value)}
        style={styles.select}
      >
        {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      {preset === 'custom' && (
        <>
          <input type="date" value={start || ''} onChange={e => onStartChange(e.target.value)} style={styles.dateInput} />
          <span style={styles.to}>to</span>
          <input type="date" value={end || ''} onChange={e => onEndChange(e.target.value)} style={styles.dateInput} />
        </>
      )}
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  select: {
    padding: '9px 12px',
    borderRadius: t.radius.full,
    border: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.sm,
    color: t.colors.textPrimary,
    backgroundColor: t.colors.bgCard,
    fontFamily: t.fonts.sans,
    outline: 'none',
  },
  dateInput: {
    padding: '8px 12px',
    borderRadius: t.radius.full,
    border: `1px solid ${t.colors.border}`,
    fontSize: t.fontSizes.sm,
    color: t.colors.textPrimary,
    backgroundColor: t.colors.bgCard,
    fontFamily: t.fonts.sans,
    outline: 'none',
  },
  to: { fontSize: t.fontSizes.sm, color: t.colors.textTertiary },
}
