import { useState, useEffect } from 'react'
import { theme as t } from '../theme'
import { supabase } from '../supabaseClient'

export default function TopBar({ session, onLogout, currentPage, onMenuClick, onNavigate }) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  const [firstName, setFirstName] = useState('')

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
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {!isDesktop && (
          <button
            onClick={onMenuClick}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              color: t.colors.textSecondary,
              padding: '4px 6px',
              borderRadius: t.radius.md,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ☰
          </button>
        )}
        <div>
          <div style={{
            fontSize: '17px',
            fontWeight: '700',
            color: t.colors.textPrimary,
            letterSpacing: '-0.4px',
            lineHeight: 1.2,
            fontFamily: t.fonts.sans,
          }}>
            gabspace
          </div>
          <div style={{
            fontSize: t.fontSizes.xs,
            color: t.colors.textTertiary,
            fontFamily: t.fonts.sans,
          }}>
            Clarity meets creativity
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: t.colors.bg,
          borderRadius: t.radius.xl,
          padding: '8px 14px',
          border: `1px solid ${t.colors.borderLight}`,
        }}>
          <span style={{ fontSize: '13px', color: t.colors.textTertiary }}>🔍</span>
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