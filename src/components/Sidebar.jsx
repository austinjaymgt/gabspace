import { useState, useEffect } from 'react'
import { theme as t } from '../theme'
import { Icon } from './Icon'

  const navItems = [
  { label: 'Dashboard', icon: 'dashboard', path: 'dashboard' },

    {
    label: 'Client Management', icon: 'clients', path: 'allclients', children: [
      { label: 'Clients', path: 'allclients' },
      { label: 'Projects', icon: 'projects', path: 'projects' },
      { label: 'Tasks', path: 'tasks' },
  ]
  },

  { label: 'Portals', icon: 'portal', path: 'client-portal-manager', accent: true },

  /* Hidden for now — keeping for backup. Spark moved to Creative Collective.
  {
    label: 'Toolkit', icon: 'sparkles', path: 'packages', children: [
      { label: 'Packages', path: 'packages' },
      { label: 'Briefs', path: 'briefs' },
      { label: 'Spark', path: 'spark' },
    ]
  },
  */

  {
    label: 'Operations', icon: 'operations', path: 'business', children: [
      { label: 'Budget', path: 'department-budget' },
      { label: 'Vendors', path: 'vendors' },
      { label: 'Resources', path: 'resources' },
    ]
  },
  {
    label: 'Creative Collective', icon: 'creative', path: 'marketing', children: [
      { label: 'Spark', path: 'spark' },
      { label: 'Creative Strategy', path: 'creative-strategy' },
      { label: 'Content Calendar', path: 'campaign-tracking' },
      { label: 'Creative Assets', path: 'assets' },
    ]
  },
  {
    label: 'Team', icon: 'team', path: 'team', children: [
      { label: ' Goals', path: 'team-goals' },
      { label: 'Professional Development', path: 'pro-dev' },
      { label: 'Networking', path: 'business-events' },
    ]
  },
  { label: 'Settings', icon: 'settings', path: 'settings' },
]

const SIDEBAR_WIDTH = 240
const SIDEBAR_COLLAPSED_WIDTH = 56

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  useEffect(() => {
    function handle() { setIsDesktop(window.innerWidth >= 1024) }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])
  return isDesktop
}

export default function Sidebar({ currentPage, onNavigate, isOpen, onClose, onLogout, collapsed, onToggleCollapse }) {
  const [expanded, setExpanded] = useState([])
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

  const width = isDesktop && collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  const sidebarContent = (
    <div style={{
      width: `${width}px`,
      height: '100dvh',
      backgroundColor: t.colors.nav,
      borderRight: 'none',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
      flexShrink: 0,
      transition: 'width 0.2s ease',
    }}>
      {/* Logo / Header */}
      <div style={{
        padding: collapsed ? '20px 0 16px' : '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        {!collapsed && (
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
              creativity meets clarity
            </div>
          </div>
        )}

        {/* Desktop collapse toggle */}
        {isDesktop && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name="sidebar-toggle" size="md" />
          </button>
        )}

        {/* Mobile close button */}
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
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: collapsed ? '0' : '10px',
                  padding: collapsed ? '9px 0' : '9px 16px',
                  margin: '1px 8px',
                  borderRadius: t.radius.md,
                  cursor: 'pointer',
                  backgroundColor: isActive ? t.colors.navActive : 'transparent',
                  color: isActive ? t.colors.navTextActive : t.colors.navText,
                  fontSize: t.fontSizes.base,
                  fontWeight: item.accent ? '600' : '500',
                  fontFamily: t.fonts.sans,
                  transition: 'background 0.15s',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  border: '1px solid transparent',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = t.colors.navHover
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  if (collapsed && isDesktop) {
                    // expand sidebar on click when collapsed
                    onToggleCollapse()
                  } else if (item.children) {
                    toggleExpand(item.label)
                  } else {
                    handleNav(item.path)
                  }
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <Icon name={item.icon} size="sm" />
                </span>
                {!collapsed && (
                  <>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.children && (
                      <span style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.25)' }}>
                        <Icon name={expanded.includes(item.label) ? 'expand' : 'collapse'} size="sm" />
                      </span>
                    )}
                  </>
                )}
              </div>

              {!collapsed && item.children && expanded.includes(item.label) && (
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

      {/* Bottom */}
      <div style={{
        padding: collapsed ? '12px 0 20px' : '12px 16px 20px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: collapsed ? 'center' : 'stretch',
      }}>
        <button
          onClick={() => handleNav('settings')}
          title={collapsed ? 'Settings' : undefined}
          style={{
            width: collapsed ? 'auto' : '100%',
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
            gap: collapsed ? '0' : '10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <Icon name="settings" size="sm" />
          {!collapsed && 'Settings'}
        </button>
        <button
          onClick={onLogout}
          title={collapsed ? 'Sign out' : undefined}
          style={{
            width: collapsed ? 'auto' : '100%',
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
            gap: collapsed ? '0' : '10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <Icon name="signout" size="sm" />
          {!collapsed && 'Sign out'}
        </button>
        {!collapsed && (
          <button
            onClick={() => handleNav('projects')}
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
        )}
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <div style={{
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100dvh',
        flexShrink: 0,
        width: `${width}px`,
        transition: 'width 0.2s ease',
      }}>
        {sidebarContent}
      </div>
    )
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
