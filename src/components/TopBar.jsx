import { useState, useEffect } from 'react'
import { theme as t } from '../theme'
import { supabase } from '../supabaseClient'
import { Icon } from './Icon'
import { useThemeMode } from '../ThemeContext'
import { useIsNotDesktop } from '../hooks/useMediaQuery'
import BusinessSpaceSwitcher from './BusinessSpaceSwitcher'
import NotificationsPanel from './NotificationsPanel'

export default function TopBar({ session, onLogout, currentPage, onMenuClick, onNavigate, businessSpaceId, onSwitchBusinessSpace, onOpenCreateBusinessFlow, onRestoreBusinessSpace, businessIdentityVersion, hideMenuButton, portalActivityVersion, onPortalActivityChange }) {
  const isMobile = useIsNotDesktop()
  const isDesktop = !isMobile
  const [firstName, setFirstName] = useState('')
  const { isDark, toggleDark } = useThemeMode()

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
        {/* Home — back to the landing screen */}
        <button
          onClick={() => onNavigate('home')}
          title="Home"
          style={{
            background: currentPage === 'home' ? 'var(--color-primary)' : 'var(--color-bg)',
            border: `1px solid var(--color-border)`,
            borderRadius: t.radius.full,
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: currentPage === 'home' ? '#fff' : t.colors.textSecondary,
            flexShrink: 0,
          }}
        >
          <Icon name="home" size="sm" />
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            background: isDark ? 'var(--color-primary)' : 'var(--color-bg)',
            border: `1px solid var(--color-border)`,
            borderRadius: t.radius.full,
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: isDark ? '#fff' : t.colors.textSecondary,
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
        >
          <Icon name={isDark ? 'sun' : 'moon'} size="sm" />
        </button>

        <NotificationsPanel businessSpaceId={businessSpaceId} onNavigate={onNavigate} isMobile={isMobile} portalActivityVersion={portalActivityVersion} onPortalActivityChange={onPortalActivityChange} session={session} onSwitchBusinessSpace={onSwitchBusinessSpace} />

        <div
          onClick={() => onNavigate('settings')}
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
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
      </div>
    </div>
  )
}