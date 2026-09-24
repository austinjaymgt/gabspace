import { useState, useEffect, useRef } from 'react'
import { theme as t } from '../theme'
import { supabase } from '../supabaseClient'
import { Icon } from './Icon'
import { useThemeMode } from '../ThemeContext'
import { useIsNotDesktop } from '../hooks/useMediaQuery'
import BusinessSpaceSwitcher from './BusinessSpaceSwitcher'
import NotificationsPanel from './NotificationsPanel'

export default function TopBar({ session, onLogout, onMenuClick, onNavigate, businessSpaceId, onSwitchBusinessSpace, onOpenCreateBusinessFlow, onRestoreBusinessSpace, businessIdentityVersion, hideMenuButton, portalActivityVersion, onPortalActivityChange, isPlatformAdmin, onOpenCommunity }) {
  const isMobile = useIsNotDesktop()
  const isDesktop = !isMobile
  const [firstName, setFirstName] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
  const { isDark, toggleDark } = useThemeMode()

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('user_settings')
      .select('first_name')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => { if (data?.first_name) setFirstName(data.first_name) })
  }, [session])

  const initials = (firstName || session?.user?.email || 'U').charAt(0).toUpperCase()

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile
        ? 'env(safe-area-inset-top) max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left))'
        : '0 24px',
      height: isMobile ? 'calc(60px + env(safe-area-inset-top))' : '60px',
      backgroundColor: t.colors.bgCard,
      borderBottom: `1px solid ${t.colors.borderLight}`,
      fontFamily: t.fonts.sans,
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', minWidth: 0 }}>
        {!isDesktop && !hideMenuButton && (
  <button
    onClick={onMenuClick}
    style={{
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: t.colors.textSecondary,
      padding: '4px 6px',
      borderRadius: t.radius.full,
      display: 'flex',
      alignItems: 'center',
    }}
    aria-label="Open menu"
  >
    <Icon name="menu" size="lg" />
  </button>
)}
        <BusinessSpaceSwitcher isMobile={isMobile} onNavigate={onNavigate} session={session} businessSpaceId={businessSpaceId} onSwitch={onSwitchBusinessSpace} onOpenCreate={onOpenCreateBusinessFlow} onRestore={onRestoreBusinessSpace} refreshKey={businessIdentityVersion} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '12px', flexShrink: 0 }}>
        <NotificationsPanel businessSpaceId={businessSpaceId} onNavigate={onNavigate} isMobile={isMobile} portalActivityVersion={portalActivityVersion} onPortalActivityChange={onPortalActivityChange} session={session} onSwitchBusinessSpace={onSwitchBusinessSpace} onOpenCommunity={onOpenCommunity} />

        <div ref={profileRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={() => setProfileOpen(prev => !prev)}
            title={session?.user?.email}
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
            }}
          >
            {initials}
          </div>

          {profileOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: '180px',
              backgroundColor: t.colors.bgCard,
              borderRadius: t.radius.lg,
              border: `1px solid ${t.colors.borderLight}`,
              boxShadow: t.shadows.lg,
              zIndex: 100,
              fontFamily: t.fonts.sans,
              padding: '6px',
            }}>
              <ProfileMenuItem icon="home" label="Home" onClick={() => { setProfileOpen(false); onNavigate('home') }} />
              <ProfileMenuItem icon="tutorials" label="Tutorials" onClick={() => { setProfileOpen(false); onNavigate('tutorials') }} />
              <ProfileMenuItem icon={isDark ? 'sun' : 'moon'} label="Dark mode" active={isDark} onClick={() => { setProfileOpen(false); toggleDark() }} />
              <ProfileMenuItem icon="settings" label="Settings" onClick={() => { setProfileOpen(false); onNavigate('settings') }} />
              {isPlatformAdmin && (
                <ProfileMenuItem icon="star" label="Admin" onClick={() => { setProfileOpen(false); onNavigate('admin') }} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileMenuItem({ icon, label, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 10px',
        borderRadius: t.radius.md,
        fontSize: t.fontSizes.sm,
        fontWeight: '500',
        color: t.colors.textPrimary,
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = t.colors.bg}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <Icon name={icon} size="sm" />
      {label}
      {active && (
        <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: t.colors.primary }} />
      )}
    </div>
  )
}