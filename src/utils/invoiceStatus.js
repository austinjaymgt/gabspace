import { theme as t } from '../theme'

export const statusConfig = {
  draft:   { bg: t.colors.bg,           color: t.colors.textTertiary, label: 'Draft' },
  sent:    { bg: t.colors.primaryLight, color: t.colors.primary,      label: 'Sent' },
  partial: { bg: t.colors.warningLight, color: t.colors.warning,      label: 'Partial' },
  paid:    { bg: t.colors.successLight, color: t.colors.success,      label: 'Paid' },
  overdue: { bg: t.colors.dangerLight,  color: t.colors.danger,       label: 'Overdue' },
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

// due_date/status are the only stored fields — partial and overdue are
// always derived so they can never drift out of sync with reality.
export function computeDisplayStatus(invoice) {
  if (invoice.status === 'paid') return 'paid'
  if (invoice.status === 'draft') return 'draft'
  if (invoice.due_date && invoice.due_date < todayISO()) return 'overdue'
  if (parseFloat(invoice.amount_paid) > 0) return 'partial'
  return 'sent'
}
