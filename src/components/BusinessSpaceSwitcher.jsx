import { useState, useRef, useEffect } from 'react'
import { theme as t } from '../theme'
import { Icon } from './Icon'

// Mock data for UI validation only — no backend multi-business support yet.
const MOCK_BUSINESSES = [
  { id: 'gabspace-events', name: 'Gabspace Events', tagline: 'creativity meets clarity', icon: 'events', color: t.colors.primary },
  { id: 'studio-nova', name: 'Studio Nova', tagline: 'branding & design', icon: 'creative', color: t.colors.accent },
  { id: 'the-local-collective', name: 'The Local Collective', tagline: 'community & marketing', icon: 'campaigns', color: t.colors.highlight },
]

const STORAGE_KEY = 'gabspace-active-business'

function getInitialActiveId() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return MOCK_BUSINESSES.some(b => b.id === stored) ? stored : MOCK_BUSINESSES[0].id
}

function Avatar({ business, size }) {
  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: t.radius.md,
      backgroundColor: business.color,
      color: t.colors.textInverse,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name={business.icon} size="sm" />
    </div>
  )
}

export default function BusinessSpaceSwitcher({ isMobile = false, onNavigate }) {
  const [activeId, setActiveId] = useState(getInitialActiveId)
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const active = MOCK_BUSINESSES.find(b => b.id === activeId)

  function handleSelect(id) {
    setOpen(false)
    if (id === activeId) return
    setActiveId(id)
    localStorage.setItem(STORAGE_KEY, id)
    onNavigate?.('dashboard')
  }

  const dropdown = open && (
    <div style={{
      position: isMobile ? 'fixed' : 'absolute',
      top: isMobile ? '68px' : 'calc(100% + 8px)',
      left: isMobile ? '12px' : 0,
      right: isMobile ? '12px' : 'auto',
      width: isMobile ? 'auto' : '260px',
      backgroundColor: t.colors.bgCard,
      borderRadius: t.radius.lg,
      border: `1px solid ${t.colors.borderLight}`,
      boxShadow: t.shadows.lg,
      zIndex: 100,
      fontFamily: t.fonts.sans,
      overflow: 'hidden',
    }}>
      {MOCK_BUSINESSES.map(business => (
        <div
          key={business.id}
          onClick={() => handleSelect(business.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = t.colors.bg}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Avatar business={business} size={28} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: t.fontSizes.base,
              color: t.colors.textPrimary,
              fontWeight: '600',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {business.name}
            </div>
            <div style={{
              fontSize: t.fontSizes.xs,
              color: t.colors.textTertiary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {business.tagline}
            </div>
          </div>
          {business.id === activeId && (
            <span style={{ display: 'flex', alignItems: 'center', color: t.colors.primary, flexShrink: 0 }}>
              <Icon name="success" size="sm" />
            </span>
          )}
        </div>
      ))}
    </div>
  )

  if (isMobile) {
    return (
      <div ref={containerRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(p => !p)}
          aria-label="Switch business"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Avatar business={active} size={30} />
          <Icon name="expand" size="sm" color={t.colors.textTertiary} />
        </button>
        {dropdown}
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        aria-label="Switch business"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 6px',
          borderRadius: t.radius.md,
          fontFamily: t.fonts.sans,
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = t.colors.bg}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Avatar business={active} size={32} />
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <div style={{
            fontSize: '17px',
            fontWeight: '800',
            color: t.colors.textPrimary,
            letterSpacing: '-0.4px',
            lineHeight: 1.2,
            fontFamily: t.fonts.heading,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {active.name}
          </div>
          <div style={{
            fontSize: t.fontSizes.xs,
            color: t.colors.textTertiary,
            fontFamily: t.fonts.sans,
            whiteSpace: 'nowrap',
          }}>
            {active.tagline}
          </div>
        </div>
        <Icon name="expand" size="sm" color={t.colors.textTertiary} />
      </button>
      {dropdown}
    </div>
  )
}
