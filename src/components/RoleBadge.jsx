import { theme as t } from '../theme'
import { ROLE_LABELS, ROLE_COLORS } from '../utils/roles'

export default function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] || ROLE_COLORS.employee
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '100px',
      fontSize: t.fontSizes.xs, fontWeight: '500',
      backgroundColor: c.bg, color: c.color,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {ROLE_LABELS[role] || role}
    </span>
  )
}
