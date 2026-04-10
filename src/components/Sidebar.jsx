import { useState, useEffect } from 'react'
import { theme as t } from '../theme'

const navItems = [
  { label: 'Dashboard', icon: '⊞', path: 'dashboard' },
  {
    label: 'Clients', icon: '👥', path: 'clients', children: [
      { label: 'All Clients', path: 'clients' },
      { label: 'Projects', path: 'projects' },
      { label: 'Tasks', path: 'tasks' },
      { label: 'Client Portals', path: 'client-portal' },
    ]
  },
{
  label: 'Events', icon: '🎪', path: 'my-events', children: [
    { label: 'All Events', path: 'my-events' },
  ]
},
{ label: 'Idea Curation', icon: '💡', path: 'brainstorm' },
  {
    label: 'Business', icon: '💼', path: 'business', children: [
      { label: 'Overview', path: 'finance-overview' },
      { label: 'Revenue', path: 'revenue' },
      { label: 'Expenses', path: 'expenses' },
      { label: 'Vendors', path: 'vendors' },
    ]
  },
  {
    label: 'Marketing', icon: '📣', path: 'marketing', children: [
      { label: 'Campaigns', path: 'campaigns' },
      { label: 'Content Calendar', path: 'campaign-tracking' },
      { label: 'Community Events', path: 'business-events' },
      { label: 'Company Assets', path: 'assets' },
    ]
  },
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

export default function Sidebar({ currentPage, onNavigate, isOpen, onClose }) {
  const [expanded, setExpanded] = useState(['Clients', 'Business', 'Marketing', 'Events'])
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
      backgroundColor: t.colors.bgCard,
      borderRight: `1px solid ${t.colors.borderLight}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: `1px solid ${t.colors.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: t.colors.textPrimary, letterSpacing: '-0.5px', fontFamily: t.fonts.sans }}>
            gabspace
          </div>
          <div style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, marginTop: '2px' }}>
            Clarity meets creativity
          </div>
        </div>
        {!isDesktop && (
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: t.colors.textTertiary, padding: '4px', lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 0', flex: 1 }}>
        {navItems.map(item => (
          <div key={item.label}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 20px',
                cursor: 'pointer',
                backgroundColor: currentPage === item.path ? t.colors.primaryLight : 'transparent',
                color: currentPage === item.path ? t.colors.primary : t.colors.textSecondary,
                fontSize: t.fontSizes.base,
                fontWeight: '500',
                fontFamily: t.fonts.sans,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (currentPage !== item.path) e.currentTarget.style.backgroundColor = t.colors.bgHover }}
              onMouseLeave={e => { if (currentPage !== item.path) e.currentTarget.style.backgroundColor = 'transparent' }}
              onClick={() => {
                if (item.children) toggleExpand(item.label)
                else handleNav(item.path)
              }}
            >
              <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.children && (
                <span style={{ fontSize: '10px', color: t.colors.textTertiary }}>
                  {expanded.includes(item.label) ? '▾' : '▸'}
                </span>
              )}
            </div>

            {item.children && expanded.includes(item.label) && (
              <div style={{ paddingLeft: '45px' }}>
                {item.children.map(child => (
                  <div
                    key={child.label}
                    style={{
                      padding: '7px 12px',
                      fontSize: t.fontSizes.sm,
                      color: currentPage === child.path ? t.colors.primary : t.colors.textSecondary,
                      fontWeight: currentPage === child.path ? '600' : '400',
                      cursor: 'pointer',
                      borderRadius: t.radius.md,
                      fontFamily: t.fonts.sans,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (currentPage !== child.path) e.currentTarget.style.backgroundColor = t.colors.bgHover }}
                    onMouseLeave={e => { if (currentPage !== child.path) e.currentTarget.style.backgroundColor = 'transparent' }}
                    onClick={() => handleNav(child.path)}
                  >
                    {child.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
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
            backgroundColor: 'rgba(0,0,0,0.2)',
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