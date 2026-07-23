import { useState, useRef, useEffect } from 'react'
import { theme as t } from '../theme'
import { supabase } from '../supabaseClient'
import { Icon } from './Icon'

const AVATAR_COLORS = [t.colors.primary, t.colors.accent, t.colors.highlight]

const PLAN_CAPS = { free: 1, duo: 2, studio: 3, enterprise: null }
const NEXT_PLAN = { free: 'Duo', duo: 'Studio', studio: 'Enterprise' }
const PLAN_LABELS = { free: 'Free', duo: 'Duo', studio: 'Studio', enterprise: 'Enterprise' }

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

export default function BusinessSpaceSwitcher({ isMobile = false, onNavigate, session, businessSpaceId, onSwitch, onOpenCreate, onRestore, refreshKey }) {
  const [businesses, setBusinesses] = useState([])
  const [archivedBusinesses, setArchivedBusinesses] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [restoringId, setRestoringId] = useState(null)
  const [plan, setPlan] = useState('free')
  const [capBlocked, setCapBlocked] = useState(false)
  const containerRef = useRef(null)

  function closeDropdown() {
    setOpen(false)
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function fetchBusinesses() {
    if (!session?.user?.id) return
    supabase
      .from('business_space_members')
      .select('business_space_id, role, business_spaces(id, name, archived_at)')
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        const rows = (data || [])
          .filter(r => r.business_spaces)
          .map(r => ({ id: r.business_spaces.id, name: r.business_spaces.name, archived: !!r.business_spaces.archived_at, isOwner: r.role === 'owner' }))
        setBusinesses(rows.filter(r => !r.archived))
        setArchivedBusinesses(rows.filter(r => r.archived))
      })
  }

  function fetchPlan() {
    if (!session?.user?.id) return
    supabase
      .from('user_settings')
      .select('plan')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setPlan(data?.plan || 'free'))
  }

  useEffect(fetchBusinesses, [session, refreshKey])
  useEffect(fetchPlan, [session, refreshKey])

  const active = businesses.find(b => b.id === businessSpaceId) || { id: businessSpaceId || '', name: 'Loading…' }

  function toggleDropdown() {
    if (!open) {
      fetchBusinesses()
      fetchPlan()
      setCapBlocked(false)
    }
    setOpen(o => !o)
  }

  async function handleSelect(id) {
    closeDropdown()
    if (id === businessSpaceId || switching) return
    setSwitching(true)
    const { error } = await onSwitch?.(id) || {}
    setSwitching(false)
    if (!error) onNavigate?.('dashboard')
  }

  const planCap = PLAN_CAPS[plan] ?? 1
  const atCap = planCap !== null && businesses.length >= planCap

  function handleOpenCreate() {
    if (atCap) {
      setCapBlocked(true)
      return
    }
    closeDropdown()
    onOpenCreate?.()
  }

  async function handleRestore(id) {
    if (restoringId) return
    setRestoringId(id)
    await onRestore?.(id)
    fetchBusinesses()
    setRestoringId(null)
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

      {archivedBusinesses.length > 0 && (
        <div style={{ borderTop: `1px solid ${t.colors.borderLight}` }}>
          <div
            onClick={() => setShowArchived(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              cursor: 'pointer',
              color: t.colors.textTertiary,
              fontSize: t.fontSizes.sm,
              fontWeight: '500',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = t.colors.bg}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Archived ({archivedBusinesses.length})
            <Icon name="expand" size="sm" style={{ transform: showArchived ? 'rotate(180deg)' : 'none' }} />
          </div>
          {showArchived && archivedBusinesses.map(business => (
            <div
              key={business.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 14px 8px 44px',
              }}
            >
              <div style={{
                fontSize: t.fontSizes.base,
                color: t.colors.textTertiary,
                fontWeight: '500',
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {business.name}
              </div>
              {business.isOwner ? (
                <button
                  onClick={() => handleRestore(business.id)}
                  disabled={restoringId === business.id}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: t.colors.primary,
                    fontSize: t.fontSizes.xs,
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: t.fonts.sans,
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  {restoringId === business.id ? 'Restoring…' : 'Restore'}
                </button>
              ) : (
                <span style={{ fontSize: t.fontSizes.xs, color: t.colors.textTertiary, flexShrink: 0 }}>
                  Owner only
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: `1px solid ${t.colors.borderLight}` }}>
        {capBlocked ? (
          <div style={{ padding: '12px 14px', fontSize: t.fontSizes.sm, color: t.colors.textSecondary, lineHeight: 1.5 }}>
            <strong style={{ color: t.colors.textPrimary }}>You've reached your {PLAN_LABELS[plan] || 'Free'} plan limit.</strong>
            {NEXT_PLAN[plan] && <> Upgrade to {NEXT_PLAN[plan]} for {plan === 'free' ? 'a second' : 'another'} business.</>}
          </div>
        ) : (
          <div
            onClick={handleOpenCreate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              cursor: 'pointer',
              color: t.colors.textSecondary,
              fontSize: t.fontSizes.base,
              fontWeight: '500',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = t.colors.bg}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: t.radius.md, border: `1px dashed ${t.colors.border}`, flexShrink: 0 }}>
              <Icon name="add" size="sm" color={t.colors.textTertiary} />
            </span>
            Create business
          </div>
        )}
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <div ref={containerRef} style={{ position: 'relative' }}>
        <button
          onClick={toggleDropdown}
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
        onClick={toggleDropdown}
        aria-label="Switch business"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 10px 4px 4px',
          borderRadius: t.radius.full,
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
