// Parses a YYYY-MM-DD date string as a local calendar date. Avoids the
// UTC-parsing day-shift that `new Date(str)` causes in negative-offset timezones.
export function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month) return null
  return new Date(year, month - 1, day || 1)
}

export function formatDate(dateStr, opts = { month: 'short', day: 'numeric' }) {
  const d = parseLocalDate(dateStr)
  return d ? d.toLocaleDateString('en-US', opts) : ''
}

export function quarterFromDate(dateStr) {
  const d = parseLocalDate(dateStr)
  return d ? `Q${Math.floor(d.getMonth() / 3) + 1}` : null
}

export function quarterInfoFromDate(dateStr) {
  const d = parseLocalDate(dateStr)
  return d ? { quarter: `Q${Math.floor(d.getMonth() / 3) + 1}`, year: d.getFullYear() } : null
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Resolves a date-filter preset ('all' | 'mtd' | 'ytd' | 'custom') into a
// concrete { start, end } range of YYYY-MM-DD strings (either bound may be
// null, meaning unbounded). MTD/YTD are always relative to today.
export function resolveDateRange(preset, custom = {}) {
  const today = new Date()
  if (preset === 'mtd') return { start: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)), end: toISODate(today) }
  if (preset === 'ytd') return { start: toISODate(new Date(today.getFullYear(), 0, 1)), end: toISODate(today) }
  if (preset === 'custom') return { start: custom.start || null, end: custom.end || null }
  return { start: null, end: null } // 'all'
}

// Plain YYYY-MM-DD strings compare correctly with standard string ordering.
export function isDateInRange(dateStr, range) {
  if (!range || (!range.start && !range.end)) return true
  if (!dateStr) return false
  if (range.start && dateStr < range.start) return false
  if (range.end && dateStr > range.end) return false
  return true
}
