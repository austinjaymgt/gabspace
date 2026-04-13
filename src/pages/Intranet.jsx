import { theme as t } from '../theme'

export default function Intranet() {
  return (
    <div style={{
      padding: '40px',
      fontFamily: t.fonts.sans,
      maxWidth: '800px',
    }}>
      <div style={{ marginBottom: '8px' }}>
        <span style={{
          fontSize: t.fontSizes.xs,
          fontWeight: '500',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: t.colors.primary,
        }}>
          Coming Soon
        </span>
      </div>

      <h1 style={{
        fontFamily: t.fonts.heading,
        fontSize: '32px',
        fontWeight: '800',
        color: t.colors.textPrimary,
        letterSpacing: '-0.02em',
        margin: '0 0 12px',
      }}>
        Employee Intranet
      </h1>

      <p style={{
        fontSize: t.fontSizes.lg,
        color: t.colors.textSecondary,
        lineHeight: 1.65,
        margin: '0 0 48px',
        maxWidth: '560px',
      }}>
        A dedicated space for team announcements, department resources, org charts, and internal communications. Being built as a standalone experience.
      </p>

      {/* Feature preview cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '48px',
      }}>
        {[
          { icon: '📢', title: 'Announcements', desc: 'Company-wide and department updates' },
          { icon: '🗂️', title: 'Org Chart', desc: 'Team structure and reporting lines' },
          { icon: '📋', title: 'Policies', desc: 'HR docs, guidelines, and handbooks' },
          { icon: '🎉', title: 'Recognition', desc: 'Celebrate team wins and milestones' },
        ].map(item => (
          <div key={item.title} style={{
            background: t.colors.bgCard,
            border: `1px solid ${t.colors.border}`,
            borderRadius: t.radius.lg,
            padding: '20px',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>{item.icon}</div>
            <div style={{
              fontSize: t.fontSizes.md,
              fontWeight: '600',
              color: t.colors.textPrimary,
              marginBottom: '4px',
            }}>
              {item.title}
            </div>
            <div style={{
              fontSize: t.fontSizes.sm,
              color: t.colors.textSecondary,
              lineHeight: 1.5,
            }}>
              {item.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Status banner */}
      <div style={{
        background: t.colors.nav,
        borderRadius: t.radius.lg,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: t.colors.accent,
          flexShrink: 0,
        }} />
        <div>
          <div style={{
            fontSize: t.fontSizes.md,
            fontWeight: '600',
            color: '#FFFFFF',
            marginBottom: '2px',
            fontFamily: t.fonts.heading,
          }}>
            In development
          </div>
          <div style={{
            fontSize: t.fontSizes.sm,
            color: 'rgba(255,255,255,0.45)',
          }}>
            The intranet will be built as a standalone platform and connected here when ready.
          </div>
        </div>
      </div>
    </div>
  )
}
