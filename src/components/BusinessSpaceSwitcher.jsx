import { useState, useRef, useEffect } from 'react'
import { theme as t } from '../theme'
import { supabase } from '../supabaseClient'
import { Icon } from './Icon'

const AVATAR_COLORS = [t.colors.primary, t.colors.accent, t.colors.highlight]

function colorFor(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function Avatar({ business, size }) {
  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: t.radius.md,
      backgroundColor: colorFor(business.id),
      color: t.colors.textInverse,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontSize: `${Math.round(size * 0.45)}px`,
      fontWeight: '700',
      fontFamily: t.fonts.sans,
    }}>
      {business.name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function BusinessSpaceSwitcher({ isMobile = false, onNavigate, session, businessSpaceId, onSwitch }) {
  const [businesses, setBusinesses] = useState([])
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
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

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('business_space_members')
      .select('business_space_id, business_spaces(id, name)')
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        const rows = (data || [])
          .filter(r => r.business_spaces)
          .map(r => ({ id: r.business_spaces.id, name: r.business_spaces.name }))
        setBusinesses(rows)
      })
  }, [session])

  const active = businesses.find(b => b.id === businessSpaceId) || { id: businessSpaceId || '', name: 'Loading…' }

  async function handleSelect(id) {
    setOpen(false)
    if (id === businessSpaceId || switching) return
    setSwitching(true)
    const { error } = await onSwitch?.(id) || {}
    setSwitching(false)
    if (!error) onNavigate?.('dashboard')
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
      {businesses.map(business => (
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
          </div>
          {business.id === businessSpaceId && (
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
        </div>
        <Icon name="expand" size="sm" color={t.colors.textTertiary} />
      </button>
      {dropdown}
    </div>
  )
}
