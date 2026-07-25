import { theme as t } from '../theme'

export const statusConfig = {
  draft:   { bg: t.colors.bg,           color: t.colors.textTertiary, label: 'Draft' },
  sent:    { bg: t.colors.primaryLight, color: t.colors.primary,      label: 'Sent' },
  partial: { bg: t.colors.warningLight, color: t.colors.warning,      label: 'Partial' },
  paid:    { bg: t.colors.successLight, color: t.colors.success,      label: 'Paid' },
  overdue: { bg: t.colors.dangerLight,  color: t.colors.danger,       label: 'Overdue' },
}

// Local calendar date as YYYY-MM-DD — not new Date().toISOString(), which is
// UTC and drifts a day off due_date comparisons for anyone not on UTC.
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// due_date/status are the only stored fields — partial and overdue are
// always derived so they can never drift out of sync with reality.
export function computeDisplayStatus(invoice) {
  if (invoice.status === 'paid') return 'paid'
  if (invoice.status === 'draft') return 'draft'
  if (invoice.due_date && invoice.due_date < todayISO()) return 'overdue'
  if (parseFloat(invoice.amount_paid) > 0) return 'partial'
  return 'sent'
}
