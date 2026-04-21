import { useState, useEffect } from 'react'
import { theme as t } from '../theme'
import { Icon } from './Icon'

  const navItems = [
  { label: 'Dashboard', icon: 'dashboard', path: 'dashboard' },
  {
    label: 'All Clients', icon: 'clients', path: 'allclients', children: [
      { label: 'All Clients', path: 'allclients' },
      { label: 'Projects', path: 'projects' },
      { label: 'Tasks', path: 'tasks' },
      { label: 'Client Portals', path: 'client-portal' },
    ]
  },
  {
    label: 'Events', icon: 'events', path: 'my-events', children: [
      { label: 'Brainstorm', path: 'brainstorm' },
      { label: 'All Events', path: 'my-events' },
    ]
  },
  {
    label: 'Playbooks', icon: 'book', path: 'packages', children: [
      { label: 'Packages', path: 'packages' },
      { label: 'Briefs', path: 'briefs' },
    ]
  },
  {
    label: 'Operations', icon: 'operations', path: 'business', children: [
      { label: 'Department Budget', path: 'department-budget' },
      { label: 'Vendors', path: 'vendors' },
      { label: 'Resources', path: 'resources' },
    ]
  },
  {
    label: 'Creative Collective', icon: 'creative', path: 'marketing', children: [
      { label: 'Creative Strategy', path: 'creative-strategy' },
      { label: 'Content Calendar', path: 'campaign-tracking' },
      { label: 'Company Assets', path: 'assets' },
    ]
  },
  {
    label: 'Team', icon: 'team', path: 'team', children: [
      { label: 'Team Goals', path: 'team-goals' },
      { label: 'Professional Dev', path: 'pro-dev' },
      { label: 'Community Events', path: 'business-events' },
    ]
  },
  {
    label: 'Intranet', icon: 'intranet', path: 'intranet', children: [
      { label: 'Third Spot', path: 'intranet' },
      { label: 'Manage content', path: 'intranet-manager' },
    ]
  },
  { label: 'Settings', icon: 'settings', path: 'settings' },
]

const SIDEBAR_WIDTH = 240

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  useEffect(() => {
    function handle() { setIsDesktop(window.innerWidth >= 1024) }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])
  return isDesktop
}

export default function Sidebar({ currentPage, onNavigate, isOpen, onClose, onLogout }) {  const [expanded, setExpanded] = useState(['Clients', 'Operations', 'Creative Collective', 'Events', 'Playbooks', 'Team'])
  const isDesktop = useIsDesktop()

  function toggleExpand(label) {
    setExpanded(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  function handleNav(path) {
    onNavigate(path)
    if (!isDesktop) onClose()
  }

  const sidebarContent = (
    <div style={{
      width: `${SIDEBAR_WIDTH}px`,
      height: '100vh',
      backgroundColor: t.colors.nav,
      borderRight: 'none',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontSize: '22px',
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: '-0.5px',
            fontFamily: t.fonts.heading,
            lineHeight: 1,
          }}>
            gabspace
          </div>
          <div style={{
            fontSize: t.fontSizes.xs,
            color: 'rgba(255,255,255,0.35)',
            marginTop: '4px',
            fontFamily: t.fonts.sans,
          }}>
            where events meet excellence.
          </div>
        </div>
        {!isDesktop && (
  <button
    onClick={onClose}
    style={{
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'rgba(255,255,255,0.4)',
      padding: '4px',
      display: 'flex',
      alignItems: 'center',
    }}
    aria-label="Close sidebar"
  >
    <Icon name="close" size="md" />
  </button>
)}
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 0', flex: 1 }}>
        {navItems.map(item => {
          const isActive = currentPage === item.path ||
            (item.children && item.children.some(c => c.path === currentPage))

          return (
            <div key={item.label}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 16px',
                  margin: '1px 8px',
                  borderRadius: t.radius.md,
                  cursor: 'pointer',
                  backgroundColor: isActive ? t.colors.navActive : 'transparent',
                  color: isActive ? t.colors.navTextActive : t.colors.navText,
                  fontSize: t.fontSizes.base,
                  fontWeight: '500',
                  fontFamily: t.fonts.sans,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = t.colors.navHover
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  if (item.children) toggleExpand(item.label)
                  else handleNav(item.path)
                }}
              >
<span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
  <Icon name={item.icon} size="sm" />
</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.children && (
  <span style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.25)' }}>
    <Icon name={expanded.includes(item.label) ? 'expand' : 'collapse'} size="sm" />
  </span>
)}
              </div>

              {item.children && expanded.includes(item.label) && (
                <div style={{ paddingLeft: '41px', paddingBottom: '4px' }}>
                  {item.children.map(child => (
                    <div
                      key={child.label}
                      style={{
                        padding: '7px 12px',
                        fontSize: t.fontSizes.sm,
                        color: currentPage === child.path ? t.colors.navAccent : 'rgba(255,255,255,0.4)',
                        fontWeight: currentPage === child.path ? '600' : '400',
                        cursor: 'pointer',
                        borderRadius: t.radius.md,
                        fontFamily: t.fonts.sans,
                        transition: 'color 0.15s',
                        borderLeft: currentPage === child.path
                          ? `2px solid ${t.colors.navAccent}`
                          : '2px solid transparent',
                      }}
                      onMouseEnter={e => {
                        if (currentPage !== child.path) e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                      }}
                      onMouseLeave={e => {
                        if (currentPage !== child.path) e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
                      }}
                      onClick={() => handleNav(child.path)}
                    >
                      {child.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom — New Event CTA */}
      <div style={{
        padding: '12px 16px 20px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <button
  onClick={() => handleNav('settings')}
  style={{
    width: '100%',
    padding: '9px',
    background: 'transparent',
    border: 'none',
    borderRadius: t.radius.md,
    color: 'rgba(255,255,255,0.35)',
    fontSize: t.fontSizes.sm,
    fontFamily: t.fonts.sans,
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }}
>
  <Icon name="settings" size="sm" />
  Settings
</button>
       <button
  onClick={onLogout}
  style={{
    width: '100%',
    padding: '9px',
    background: 'transparent',
    border: 'none',
    borderRadius: t.radius.md,
    color: 'rgba(255,255,255,0.35)',
    fontSize: t.fontSizes.sm,
    fontFamily: t.fonts.sans,
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }}
>
  <Icon name="signout" size="sm" />
  Sign out
</button>
        <button
  onClick={() => handleNav('my-events')}
  style={{
    width: '100%',
    padding: '10px',
    background: 'transparent',
    border: `1.5px solid ${t.colors.navAccent}`,
    borderRadius: t.radius.md,
    color: t.colors.navAccent,
    fontSize: t.fontSizes.base,
    fontWeight: '600',
    fontFamily: t.fonts.sans,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  }}
>
  <Icon name="add" size="sm" />
  New Event
</button>
      </div>
    </div>
  )

  if (isDesktop) {
    return sidebarContent
  }

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 40,
          }}
        />
      )}
      <div style={{
        position: 'fixed',
        top: 0, left: 0,
        zIndex: 50,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        boxShadow: isOpen ? t.shadows.lg : 'none',
      }}>
        {sidebarContent}
      </div>
    </>
  )
}
