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
