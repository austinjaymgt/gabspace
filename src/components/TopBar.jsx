import { useState, useEffect } from 'react'
import { theme as t } from '../theme'
import { supabase } from '../supabaseClient'
import { Icon } from './Icon'
import { useThemeMode } from '../ThemeContext'

export default function TopBar({ session, onLogout, currentPage, onMenuClick, onNavigate }) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  const [firstName, setFirstName] = useState('')
  const { isDark, toggleDark } = useThemeMode()

  useEffect(() => {
    function handle() { setIsDesktop(window.innerWidth >= 1024) }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
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
      padding: '0 24px',
      height: '60px',
      backgroundColor: t.colors.bgCard,
      borderBottom: `1px solid ${t.colors.borderLight}`,
      fontFamily: t.fonts.sans,
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {!isDesktop && (
  <button
    onClick={onMenuClick}
    style={{
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: t.colors.textSecondary,
      padding: '4px 6px',
      borderRadius: t.radius.md,
      display: 'flex',
      alignItems: 'center',
    }}
    aria-label="Open menu"
  >
    <Icon name="menu" size="lg" />
  </button>
)}
        <div>
          <div style={{
            fontSize: '17px',
            fontWeight: '800',
            color: t.colors.textPrimary,
            letterSpacing: '-0.4px',
            lineHeight: 1.2,
            fontFamily: t.fonts.heading,
          }}>
            gabspace
          </div>
          <div style={{
            fontSize: t.fontSizes.xs,
            color: t.colors.textTertiary,
            fontFamily: t.fonts.sans,
          }}>
            creativity meets clarity
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: t.colors.bg,
          borderRadius: t.radius.xl,
          padding: '8px 14px',
          border: `1px solid ${t.colors.borderLight}`,
        }}>
<span style={{ display: 'flex', alignItems: 'center', color: t.colors.textTertiary }}>
  <Icon name="search" size="sm" />
</span>
          <input
            style={{
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: t.fontSizes.base,
              color: t.colors.textSecondary,
              width: '160px',
              fontFamily: t.fonts.sans,
            }}
            placeholder="Search..."
          />
        </div>

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