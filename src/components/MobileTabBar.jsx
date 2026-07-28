import { useState } from 'react'
import { theme as t } from '../theme'
import { Icon } from './Icon'
import { getModules } from '../utils/businessModules'

// Consolidated from the sidebar's full nav list down to the handful of
// things used most on a day-to-day basis. Everything else (Portals, Money,
// Operations, Team, Settings) lives one tap away under "More" instead of
// competing for space in a 5-icon bar.
const PRIMARY_TABS = [
  { label: 'Dashboard', icon: 'dashboard', path: 'dashboard' },
  { label: 'Clients', icon: 'clients', path: 'allclients', activePaths: ['allclients', 'projects'], moduleKey: 'clientManagement' },
  { label: 'Tasks', icon: 'checklist', path: 'tasks', moduleKey: 'clientManagement' },
  { label: 'Creative', icon: 'creative', path: 'spark', activePaths: ['spark', 'creative-strategy', 'campaign-tracking', 'assets'], moduleKey: 'creativeCollective' },
]

const MORE_ITEMS = [
  { label: 'Portals', icon: 'portal', path: 'client-portal-manager', moduleKey: 'portals' },
  { label: 'Money', icon: 'finance', path: 'income', moduleKey: 'money' },
  { label: 'Operations', icon: 'operations', path: 'vendors', moduleKey: 'operations' },
  { label: 'Team', icon: 'team', path: 'team-goals', moduleKey: 'team' },
  { label: 'Settings', icon: 'settings', path: 'settings' },
]

export default function MobileTabBar({ currentPage, onNavigate, onLogout, businessSpaceId, isPlatformAdmin }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const modules = getModules(businessSpaceId)

  const tabs = PRIMARY_TABS.filter(tab => !tab.moduleKey || modules[tab.moduleKey])
  const moreItems = MORE_ITEMS.filter(item => !item.moduleKey || modules[item.moduleKey])
  if (isPlatformAdmin) moreItems.push({ label: 'Admin', icon: 'star', path: 'admin' })
  const moreActive = moreItems.some(item => item.path === currentPage)

  function go(path) {
    setMoreOpen(false)
    onNavigate(path)
  }

  return (
    <>
      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 60 }}
        />
      )}

      {moreOpen && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61,
          backgroundColor: t.colors.bgCard,
          borderTopLeftRadius: t.radius.xl, borderTopRightRadius: t.radius.xl,
          boxShadow: t.shadows.lg, padding: '8px 8px 24px', fontFamily: t.fonts.sans,
        }}>
          <div style={{ width: '36px', height: '4px', backgroundColor: t.colors.borderLight, borderRadius: t.radius.full, margin: '6px auto 14px' }} />
          {moreItems.map(item => (
            <div
              key={item.label}
              onClick={() => go(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: t.radius.md,
                color: currentPage === item.path ? t.colors.primary : t.colors.textPrimary,
                fontWeight: currentPage === item.path ? '600' : '500',
                fontSize: t.fontSizes.md, cursor: 'pointer',
              }}
            >
              <Icon name={item.icon} size="md" />
              {item.label}
            </div>
          ))}
          <div
            onClick={() => { setMoreOpen(false); onLogout() }}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', marginTop: '4px',
              borderTop: `1px solid ${t.colors.borderLight}`,
              color: t.colors.danger, fontWeight: '500', fontSize: t.fontSizes.md, cursor: 'pointer',
            }}
          >
            <Icon name="signout" size="md" />
            Sign out
          </div>
        </div>
      )}

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
        display: 'flex',
        backgroundColor: t.colors.bgCard,
        borderTop: `1px solid ${t.colors.borderLight}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        fontFamily: t.fonts.sans,
      }}>
        {tabs.map(tab => {
          const isActive = tab.activePaths ? tab.activePaths.includes(currentPage) : currentPage === tab.path
          return (
            <button
              key={tab.label}
              onClick={() => go(tab.path)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '2px', padding: '8px 4px 10px', background: 'none', border: 'none', cursor: 'pointer',
                color: isActive ? t.colors.primary : t.colors.textTertiary,
              }}
            >
              <Icon name={tab.icon} size="md" />
              <span style={{ fontSize: '10px', fontWeight: isActive ? '700' : '500' }}>{tab.label}</span>
            </button>
          )
        })}
        <button
          onClick={() => setMoreOpen(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '2px', padding: '8px 4px 10px', background: 'none', border: 'none', cursor: 'pointer',
            color: moreActive ? t.colors.primary : t.colors.textTertiary,
          }}
        >
          <Icon name="more" size="md" />
          <span style={{ fontSize: '10px', fontWeight: moreActive ? '700' : '500' }}>More</span>
        </button>
      </div>
    </>
  )
}
