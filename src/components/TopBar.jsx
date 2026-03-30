import { theme as t } from '../theme'

export default function TopBar({ session, onLogout, currentPage, onMenuClick, onNavigate }) {  const pageNames = {
    dashboard: 'Dashboard',
    clients: 'Clients',
    'client-portal': 'Client Portal',
    projects: 'Projects',
    events: 'Events',
    tasks: 'Tasks',
    invoices: 'Invoices',
    expenses: 'Expenses',
    campaigns: 'Campaigns',
    'campaign-tracking': 'Content Calendar',
    assets: 'Brand Assets',
    vendors: 'Vendors',
  }

  const initials = session?.user?.email?.charAt(0).toUpperCase() || 'U'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '60px',
      backgroundColor: t.colors.bgCard,
      borderBottom: `1px solid ${t.colors.borderLight}`,
      fontFamily: t.fonts.sans,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onMenuClick}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            color: t.colors.textSecondary,
            padding: '4px 6px',
            borderRadius: t.radius.md,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ☰
        </button>
        <div>
  <div style={{
    fontSize: '17px',
    fontWeight: '700',
    color: t.colors.textPrimary,
    letterSpacing: '-0.4px',
    lineHeight: 1.2,
    fontFamily: t.fonts.sans,
  }}>
    gabspace
  </div>
  <div style={{
    fontSize: t.fontSizes.xs,
    color: t.colors.textTertiary,
    fontFamily: t.fonts.sans,
  }}>
    Clarity meets creativity
  </div>
</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: t.colors.bg,
          borderRadius: t.radius.xl,
          padding: '8px 14px',
          border: `1px solid ${t.colors.borderLight}`,
        }}>
          <span style={{ fontSize: '13px', color: t.colors.textTertiary }}>🔍</span>
          <input
            style={{
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: t.fontSizes.base,
              color: t.colors.textSecondary,
              width: '160px',
              fontFamily: t.fonts.sans,
            }}
            placeholder="Search..."
          />
        </div>

        <div
          title="Settings"
onClick={() => onNavigate('settings')}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: t.radius.full,
            backgroundColor: t.colors.primary,
            color: t.colors.textInverse,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: t.fontSizes.base,
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: t.fonts.sans,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
      </div>
    </div>
  )
}