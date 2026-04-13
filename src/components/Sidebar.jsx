import { useState, useEffect } from 'react'
import { theme as t } from '../theme'

const navItems = [
  { label: 'Dashboard', icon: '⊞', path: 'dashboard' },
  {
    label: 'Stakeholders', icon: '👥', path: 'clients', children: [
      { label: 'All Stakeholders', path: 'clients' },
      { label: 'Projects', path: 'projects' },
      { label: 'Tasks', path: 'tasks' },
      { label: 'Stakeholder Portals', path: 'client-portal' },
    ]
  },
  {
    label: 'Events', icon: '🎪', path: 'my-events', children: [
      { label: 'Inquiries', path: 'inquiries' },
      { label: 'Brainstorm', path: 'brainstorm' },
      { label: 'All Events', path: 'my-events' },
    ]
  },
  {
    label: 'Operations', icon: '⚙️', path: 'business', children: [
      { label: 'Overview', path: 'finance-overview' },
      { label: 'Revenue', path: 'revenue' },
      { label: 'Expenses', path: 'expenses' },
      { label: 'Vendors', path: 'vendors' },
      { label: 'Team Goals', path: 'team-goals' },
      { label: 'Resources', path: 'resources' },
    ]
  },
  {
    label: 'Creative Collective', icon: '🎨', path: 'marketing', children: [
      { label: 'Campaigns', path: 'campaigns' },
      { label: 'Content Calendar', path: 'campaign-tracking' },
      { label: 'Community Events', path: 'business-events' },
      { label: 'Company Assets', path: 'assets' },
    ]
  },
  { label: 'Intranet', icon: '🏢', path: 'intranet' },
  { label: 'Settings', icon: '⚙️', path: 'settings' },
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

export default function Sidebar({ currentPage, onNavigate, isOpen, onClose, onLogout }) {  const [expanded, setExpanded] = useState(['Stakeholders', 'Operations', 'Creative Collective', 'Events'])
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
            curators
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
              fontSize: '18px',
              color: 'rgba(255,255,255,0.4)',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ✕
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
                <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.children && (
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                    {expanded.includes(item.label) ? '▾' : '▸'}
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
          }}
        >
          ⚙️ Settings
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
          }}
        >
          → Sign out
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
          }}
        >
          + New Event
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
